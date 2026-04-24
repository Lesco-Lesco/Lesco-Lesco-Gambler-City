/**
 * RankingAPI — Dual-storage ranking service.
 *
 * Storage strategy:
 *  1. localStorage (always) — personal history, cached ranking, pending offline submits
 *  2. Vercel API (when online) — global top-100 ranking
 *
 * The game never blocks or crashes due to network failures.
 * Offline scores are queued and synced on the next session.
 */

import type { ScoreBreakdown } from '../Core/ScoreCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface RankingEntry {
    position:   number;   // 1–100
    initials:   string;   // 3 letters, e.g. "RDG"
    score:      number;   // 0–1000
    fortuna:    number;
    maestria:   number;
    progressao: number;
    ousadia:    number;
    pvpRaw:     number;
    peakMoney:  number;
    maxStreak:  number;
    timestamp:  string;   // ISO 8601
}

export interface SubmitResult {
    accepted: boolean;
    position: number | null;    // null if score didn't make top 100
    ranking:  RankingEntry[];   // full updated ranking
}

export interface LocalSession {
    score:     number;
    initials:  string;
    breakdown: ScoreBreakdown;
    position:  number | null;  // global position if accepted
    date:      string;         // ISO 8601
    synced:    boolean;        // false = waiting for online sync
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal localStorage structure
// ─────────────────────────────────────────────────────────────────────────────

interface LocalStore {
    myBestScore:     LocalSession | null;
    recentSessions:  LocalSession[];      // last 5 sessions
    pendingSubmits:  LocalSession[];      // queued offline
    cachedRanking:   RankingEntry[];      // last known online ranking
    cachedRankingAt: string | null;       // ISO timestamp of last fetch
}

const LS_KEY             = 'gamblerCity_v1';
const CACHE_TTL_MS       = 0;               // Always fetch fresh when online
const REQUEST_TIMEOUT_MS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// RankingAPI singleton
// ─────────────────────────────────────────────────────────────────────────────

export class RankingAPI {
    private static instance: RankingAPI;

    // '' = same origin (works in production); override for local dev if needed
    private baseUrl = '';

    private constructor() {}

    public static getInstance(): RankingAPI {
        if (!RankingAPI.instance) {
            RankingAPI.instance = new RankingAPI();
        }
        return RankingAPI.instance;
    }

    // ─────────────────────────────────────────────────
    // Public read methods
    // ─────────────────────────────────────────────────

    /**
     * Fetch the global ranking.
     * Returns cached copy if cache is fresh (<5 min) or if network fails.
     */
    async getRanking(): Promise<RankingEntry[]> {
        const store = this.loadStore();

        // Use cache if fresh
        if (store.cachedRankingAt) {
            const age = Date.now() - new Date(store.cachedRankingAt).getTime();
            if (age < CACHE_TTL_MS && store.cachedRanking.length > 0) {
                return store.cachedRanking;
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(`${this.baseUrl}/api/ranking`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            
            const data = await res.json();
            
            if (!Array.isArray(data)) {
                console.warn('[RankingAPI] API returned non-array:', data);
                throw new Error('API returned invalid format');
            }

            store.cachedRanking   = data;
            store.cachedRankingAt = new Date().toISOString();
            this.saveStore(store);
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            console.error('[RankingAPI] getRanking failed:', err);
            return store.cachedRanking;
        }
    }

    /**
     * Check what position a given score would occupy in the ranking.
     * Returns null if score wouldn't make top 100.
     */
    async checkPosition(score: number): Promise<number | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(
                `${this.baseUrl}/api/ranking?check=${score}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            const data = await res.json();
            return (typeof data.position === 'number') ? data.position : null;
        } catch (err) {
            clearTimeout(timeoutId);
            console.warn('[RankingAPI] checkPosition failed:', err);
            const store = this.loadStore();
            return this.estimatePositionFromCache(score, store.cachedRanking);
        }
    }

    /** Return the best personal session ever (from localStorage). */
    getMyBestScore(): LocalSession | null {
        return this.loadStore().myBestScore;
    }

    /** Return the last N personal sessions (from localStorage). */
    getRecentSessions(n = 5): LocalSession[] {
        return this.loadStore().recentSessions.slice(0, n);
    }

    /** Return how many submits are waiting for online sync. */
    getPendingCount(): number {
        return this.loadStore().pendingSubmits.length;
    }

    // ─────────────────────────────────────────────────
    // Public write methods
    // ─────────────────────────────────────────────────

    /**
     * Submit a score.
     * Step 1: Always save to localStorage.
     * Step 2: Try to POST to Vercel API.
     * Step 3: On failure, queue for later sync.
     */
    async submitScore(initials: string, breakdown: ScoreBreakdown): Promise<SubmitResult> {
        const session: LocalSession = {
            score:     breakdown.total,
            initials:  initials.toUpperCase().slice(0, 3),
            breakdown,
            position:  null,
            date:      new Date().toISOString(),
            synced:    false,
        };

        // ── STEP 1: Save locally ALWAYS ──────────────────────────────────────
        const store = this.loadStore();

        if (!store.myBestScore || breakdown.total > store.myBestScore.score) {
            store.myBestScore = session;
        }

        store.recentSessions.unshift(session);
        store.recentSessions = store.recentSessions.slice(0, 5);
        this.saveStore(store);

        // ── STEP 2: Try to POST online ────────────────────────────────────────
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(`${this.baseUrl}/api/ranking-submit`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ initials: session.initials, breakdown }),
                signal:  controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            const result = await res.json();
            
            if (!result || !Array.isArray(result.ranking)) {
                throw new Error('API returned invalid result structure');
            }

            session.synced   = true;
            session.position = result.position;

            const freshStore = this.loadStore();
            if (freshStore.myBestScore?.score === breakdown.total) {
                freshStore.myBestScore = session;
            }
            if (freshStore.recentSessions[0]?.date === session.date) {
                freshStore.recentSessions[0] = session;
            }
            freshStore.cachedRanking   = result.ranking;
            freshStore.cachedRankingAt = new Date().toISOString();
            this.saveStore(freshStore);

            return result;

        } catch (err) {
            clearTimeout(timeoutId);
            console.error('[RankingAPI] submitScore failed:', err);
            // ── STEP 3: Offline — queue for later, build local ranking ────────
            console.warn('[RankingAPI] Offline — score saved locally, sync pending.');
            const freshStore = this.loadStore();
            freshStore.pendingSubmits.push(session);

            // Insert into local cached ranking so the player sees their score
            // immediately and on the next session (until a real sync overwrites it)
            const localEntry: RankingEntry = {
                position:   1,  // recalculated below
                initials:   session.initials,
                score:      breakdown.total,
                fortuna:    breakdown.fortuna,
                maestria:   breakdown.maestria,
                progressao: breakdown.progressao,
                ousadia:    breakdown.ousadia,
                pvpRaw:     breakdown.pvpRaw,
                peakMoney:  breakdown.peakMoney,
                maxStreak:  breakdown.maxStreak,
                timestamp:  session.date,
            };

            let localRanking = [...freshStore.cachedRanking];
            let insertAt = localRanking.length;

            for (let i = 0; i < localRanking.length; i++) {
                const entry = localRanking[i];
                if (breakdown.total > entry.score) {
                    insertAt = i;
                    break;
                }
                if (breakdown.total === entry.score) {
                    if (breakdown.maestria > entry.maestria) {
                        insertAt = i;
                        break;
                    }
                }
            }

            if (insertAt < localRanking.length) {
                localRanking.splice(insertAt, 0, localEntry);
            } else {
                localRanking.push(localEntry);
            }

            localRanking = localRanking
                .slice(0, 100)
                .map((e, i) => ({ ...e, position: i + 1 }));

            freshStore.cachedRanking = localRanking;
            // Do NOT set cachedRankingAt — keep it null so the next getRanking()
            // still attempts a real server fetch (and overwrites if online then)
            this.saveStore(freshStore);

            const insertedPos = localRanking.findIndex(
                e => e.initials === session.initials &&
                     e.score    === breakdown.total   &&
                     e.timestamp === session.date
            ) + 1;

            return {
                accepted: true,
                position: insertedPos || 1,
                ranking:  localRanking,
            };
        }
    }

    /**
     * Attempt to sync queued offline submits.
     * Call this on ScoreBreakdownScene.onEnter() — fire-and-forget.
     */
    async syncPending(): Promise<void> {
        const store = this.loadStore();
        if (store.pendingSubmits.length === 0) return;

        const stillPending: LocalSession[] = [];

        for (const session of store.pendingSubmits) {
            try {
                const res = await fetch(`${this.baseUrl}/api/ranking-submit`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        initials:  session.initials,
                        breakdown: session.breakdown,
                    }),
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`HTTP ${res.status}: ${text}`);
                }
                
                const result = await res.json();
                if (!result || !Array.isArray(result.ranking)) throw new Error('Invalid response');

                session.synced   = true;
                session.position = result.position;
                store.cachedRanking   = result.ranking;
                store.cachedRankingAt = new Date().toISOString();
            } catch (err) {
                console.warn('[RankingAPI] syncPending failed for session:', session.date, err);
                stillPending.push(session);
            }
        }

        store.pendingSubmits = stillPending;
        this.saveStore(store);
    }

    // ─────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────

    private loadStore(): LocalStore {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return this.defaultStore();
            const parsed = JSON.parse(raw);
            const merged = { ...this.defaultStore(), ...parsed };
            // Sanitize: ensure array fields are actually arrays.
            // Old bug could have stored a { error: '...' } object here.
            if (!Array.isArray(merged.cachedRanking))   merged.cachedRanking   = [];
            if (!Array.isArray(merged.recentSessions))  merged.recentSessions  = [];
            if (!Array.isArray(merged.pendingSubmits))  merged.pendingSubmits  = [];
            return merged;
        } catch {
            return this.defaultStore();
        }
    }

    private saveStore(store: LocalStore): void {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(store));
        } catch {
            // localStorage quota exceeded — fail silently
        }
    }

    private defaultStore(): LocalStore {
        return {
            myBestScore:     null,
            recentSessions:  [],
            pendingSubmits:  [],
            cachedRanking:   [],
            cachedRankingAt: null,
        };
    }

    private estimatePositionFromCache(
        score: number,
        cache: RankingEntry[]
    ): number | null {
        if (cache.length === 0) return 1;
        const idx = cache.findIndex(e => score > e.score);
        if (idx === -1) {
            // Score is lower than everything in cache
            return cache.length < 100 ? cache.length + 1 : null;
        }
        return idx + 1;
    }
}
