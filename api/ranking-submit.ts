/**
 * POST /api/ranking-submit
 *
 * Accepts a score submission and inserts it into the global top-100 if it qualifies.
 *
 * Request body: { initials: string, breakdown: ScoreBreakdown }
 *
 * Tiebreak order (when scores are equal):
 *   maestria → pvpRaw → peakMoney → maxStreak → incumbent keeps their position
 *
 * Returns: { accepted: boolean, position: number | null, ranking: RankingEntry[] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const RANKING_KEY = 'gambler_city_ranking_v1';
const MAX_ENTRIES = 100;

interface ScoreBreakdown {
    fortuna:    number;
    maestria:   number;
    progressao: number;
    ousadia:    number;
    total:      number;
    pvpRaw:     number;
    peakMoney:  number;
    maxStreak:  number;
}

interface RankingEntry {
    position:   number;
    initials:   string;
    score:      number;
    fortuna:    number;
    maestria:   number;
    progressao: number;
    ousadia:    number;
    pvpRaw:     number;
    peakMoney:  number;
    maxStreak:  number;
    timestamp:  string;
}

function getRedis() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
    return new Redis({ url, token });
}

/**
 * Compare a new submission against an existing entry at the same total score.
 * Returns true if newEntry should displace existing entry (comes before it).
 */
function newBeatsIncumbent(newBD: ScoreBreakdown, existing: RankingEntry): boolean {
    if (newBD.maestria  > existing.maestria)  return true;
    if (newBD.maestria  < existing.maestria)  return false;
    if (newBD.pvpRaw    > existing.pvpRaw)    return true;
    if (newBD.pvpRaw    < existing.pvpRaw)    return false;
    if (newBD.peakMoney > existing.peakMoney) return true;
    if (newBD.peakMoney < existing.peakMoney) return false;
    if (newBD.maxStreak > existing.maxStreak) return true;
    // All equal — incumbent keeps position (return false)
    return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { initials, breakdown }: { initials: string; breakdown: ScoreBreakdown } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        if (!initials || typeof initials !== 'string' || initials.trim().length === 0) {
            return res.status(400).json({ error: 'initials required (1–3 chars)' });
        }
        if (!breakdown || typeof breakdown.total !== 'number') {
            return res.status(400).json({ error: 'breakdown.total required' });
        }
        if (breakdown.total < 0 || breakdown.total > 1000) {
            return res.status(400).json({ error: 'score out of range (0–1000)' });
        }

        const cleanInitials = initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');

        // ── Fetch current ranking ─────────────────────────────────────────────
        const redis  = getRedis();
        let ranking: RankingEntry[] = (await redis.get<RankingEntry[]>(RANKING_KEY)) || [];

        // ── Find insertion point ──────────────────────────────────────────────
        let insertAt = ranking.length; // default: append (won't make top 100)

        for (let i = 0; i < ranking.length; i++) {
            const entry = ranking[i];

            if (breakdown.total > entry.score) {
                // Higher score → insert here unconditionally
                insertAt = i;
                break;
            }

            if (breakdown.total === entry.score) {
                // Same score — apply tiebreak
                if (newBeatsIncumbent(breakdown, entry)) {
                    insertAt = i;
                    break;
                }
                // Incumbent wins at this position; continue to look for a later slot
            }
        }

        // ── Score doesn't make top 100 ────────────────────────────────────────
        if (insertAt >= MAX_ENTRIES) {
            return res.status(200).json({
                accepted: false,
                position: null,
                ranking,
            });
        }

        // ── Build new entry ───────────────────────────────────────────────────
        const newEntry: RankingEntry = {
            position:   insertAt + 1,
            initials:   cleanInitials,
            score:      breakdown.total,
            fortuna:    breakdown.fortuna    || 0,
            maestria:   breakdown.maestria   || 0,
            progressao: breakdown.progressao || 0,
            ousadia:    breakdown.ousadia    || 0,
            pvpRaw:     breakdown.pvpRaw     || 0,
            peakMoney:  breakdown.peakMoney  || 0,
            maxStreak:  breakdown.maxStreak  || 0,
            timestamp:  new Date().toISOString(),
        };

        // ── Insert ────────────────────────────────────────────────────────────
        if (insertAt < ranking.length) {
            ranking.splice(insertAt, 0, newEntry);
        } else {
            ranking.push(newEntry);
        }

        ranking = ranking
            .slice(0, MAX_ENTRIES)
            .map((e, i) => ({ ...e, position: i + 1 }));

        // ── Persist ───────────────────────────────────────────────────────────
        await redis.set(RANKING_KEY, ranking);

        return res.status(200).json({
            accepted: true,
            position: insertAt + 1,
            ranking,
        });

    } catch (err: any) {
        console.error('[/api/ranking-submit POST]', err);
        return res.status(500).json({ error: 'Internal server error', message: err?.message });
    }
}
