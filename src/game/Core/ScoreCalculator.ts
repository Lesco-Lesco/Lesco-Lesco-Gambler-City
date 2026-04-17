/**
 * ScoreCalculator — Stateless, pure scoring engine for the global ranking.
 *
 * Formula:
 *   SCORE (0–1000) = FORTUNA×0.30 + MAESTRIA×0.30 + PROGRESSÃO×0.20 + OUSADIA×0.20
 *
 * Each pillar is internally normalized to its own max (300, 300, 200, 200).
 *
 * Tiebreak order (applied server-side too):
 *   total → maestria → pvpRaw → peakMoney → maxStreak → incumbent keeps position
 */

import type { PlayerStats } from './AchievementManager';

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty coefficients per minigame
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_COEF: Record<string, number> = {
    // Normal (1.0) — luck-based or simple skill
    cara_coroa: 1.0, dados: 1.0, slots: 1.0, fan_tan: 1.0,
    jokenpo: 1.0, video_bingo: 1.0, palitinho: 1.0,
    purrinha: 1.0, ronda: 1.0, horse_racing: 1.0,
    dog_racing: 1.0, bicho: 1.0,
    // Hard (2.0)
    domino: 2.0, blackjack: 2.0,
    // Expert (3.0)
    poker: 3.0,
};

// Reference "good" scores per arcade to normalize high scores to 0–1
const ARCADE_REF_SCORES: Record<string, number> = {
    arcade_pong:     15,
    arcade_faroeste: 20,
    arcade_risca:    25,
    arcade_tank:     30,
    arcade_sinuca:   10,
};

// Normalization targets
const TARGET_PVP       = 60;   // "very good session" PVP
const TARGET_MONEY     = 20000; // "Dono de Santa Cruz" peak
const TOTAL_MINIGAMES  = 15;   // Total unique minigames available
const TOTAL_ARCADES    = 5;    // Total unique arcades available

// ─────────────────────────────────────────────────────────────────────────────
// Output interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
    /** FORTUNA pillar — 0 to 300 */
    fortuna: number;
    /** MAESTRIA pillar — 0 to 300 */
    maestria: number;
    /** PROGRESSÃO pillar — 0 to 200 */
    progressao: number;
    /** OUSADIA pillar — 0 to 200 */
    ousadia: number;
    /** Final total — 0 to 1000 */
    total: number;
    /** Raw Pontos de Vitória Ponderados (for tiebreak) */
    pvpRaw: number;
    /** Peak money reached (for tiebreak) */
    peakMoney: number;
    /** Max consecutive wins (for tiebreak) */
    maxStreak: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreCalculator
// ─────────────────────────────────────────────────────────────────────────────

export class ScoreCalculator {

    /**
     * Calculate the full score breakdown from player stats.
     * @param stats PlayerStats from AchievementManager.getInstance().getStats()
     * @param achievementsUnlocked Number of unlocked achievements (from getUnlockedCount())
     * @param totalAchievements Total achievements in the game (default: 42)
     */
    static calculate(
        stats: PlayerStats,
        achievementsUnlocked: number,
        totalAchievements: number = 42
    ): ScoreBreakdown {

        // ── PVP (Pontos de Vitória Ponderados) ──────────────────────────────
        // Sum of (wins × difficulty coefficient) for each minigame
        let pvpRaw = 0;
        for (const [game, coef] of Object.entries(DIFFICULTY_COEF)) {
            pvpRaw += (stats.minigamesWonByType[game] || 0) * coef;
        }

        // ── FORTUNA (0–300) ─────────────────────────────────────────────────
        // 70% based on peak money, 30% bonus from PVP
        // (same money but won it harder = scores higher)
        const moneyBase = Math.min(stats.maxMoneyReached / TARGET_MONEY, 1.0);
        const pvpBonus  = Math.min(pvpRaw / TARGET_PVP, 1.0) * 0.3;
        const fortuna   = Math.floor((moneyBase * 0.7 + pvpBonus) * 300);

        // ── MAESTRIA (0–300) ─────────────────────────────────────────────────
        // Split: 60% Mesa (minigames) + 40% Fliperama (arcades)

        // Mesa
        const pvpNorm    = Math.min(pvpRaw / TARGET_PVP, 1.0);
        const winRate    = stats.totalMinigamesPlayed > 0
            ? Math.min(stats.totalMinigamesWon / stats.totalMinigamesPlayed, 1.0)
            : 0;
        const streakBonus = Math.min(stats.maxConsecutiveWins / 10, 1.0);
        const maestriaMesa = pvpNorm * 0.50 + winRate * 0.25 + streakBonus * 0.25;

        // Fliperama — average normalized high score across played arcades only
        const arcadesPlayed = Object.keys(stats.arcadePlayedByType)
            .filter(k => (stats.arcadePlayedByType[k] || 0) > 0);

        let maestriaFlip = 0;
        if (arcadesPlayed.length > 0) {
            let sum = 0;
            for (const arcade of arcadesPlayed) {
                const ref   = ARCADE_REF_SCORES[arcade] || 10;
                const hs    = stats.arcadeHighScores[arcade] || 0;
                sum += Math.min(hs / ref, 1.0);
            }
            maestriaFlip = sum / arcadesPlayed.length;
        }

        const maestria = Math.floor((maestriaMesa * 0.60 + maestriaFlip * 0.40) * 300);

        // ── PROGRESSÃO (0–200) ───────────────────────────────────────────────
        const gamesExplored    = Math.min(stats.uniqueMinigamesPlayed.size / TOTAL_MINIGAMES, 1.0);
        const arcadesExplored  = Math.min(stats.uniqueArcadesPlayed.size  / TOTAL_ARCADES,   1.0);
        const achievementRatio = Math.min(achievementsUnlocked / totalAchievements,           1.0);
        const progressao = Math.floor(
            (gamesExplored   * 0.30 +
             arcadesExplored * 0.30 +
             achievementRatio * 0.40) * 200
        );

        // ── OUSADIA (0–200) ──────────────────────────────────────────────────
        const raidSurv = Math.min(stats.raidsSurvived / 10, 1.0);
        const phoenix  = Math.min(stats.phoenixWins   / 3,  1.0);
        const brokeRec = Math.min(stats.brokeTimes    / 5,  1.0);
        const ousadia  = Math.floor(
            (raidSurv * 0.35 + phoenix * 0.35 + brokeRec * 0.30) * 200
        );

        // ── TOTAL ────────────────────────────────────────────────────────────
        const total = Math.min(fortuna + maestria + progressao + ousadia, 1000);

        return {
            fortuna,
            maestria,
            progressao,
            ousadia,
            total,
            pvpRaw:   Math.round(pvpRaw * 10) / 10,   // 1 decimal
            peakMoney: stats.maxMoneyReached,
            maxStreak: stats.maxConsecutiveWins,
        };
    }
}
