/**
 * AchievementManager — Tracks player stats and unlocks achievements.
 * Singleton. Emits ACHIEVEMENT_UNLOCKED events for UI toast display.
 * 
 * 30 achievements across 4 tiers:
 *   Tier 1 (Curioso)   — Easy, exploration-focused
 *   Tier 2 (Frequente) — Medium, requires dedication
 *   Tier 3 (Veterano)  — Hard, skill + persistence
 *   Tier 4 (Lenda)     — Near-impossible prestige goals
 */

import { GameEventEmitter } from './EventEmitter';
import { EconomyManager } from './EconomyManager';
import { SoundManager } from './SoundManager';

/** All tracked player statistics */
export interface PlayerStats {
    // Minigame tracking
    minigamesPlayedByType: Record<string, number>;
    minigamesWonByType: Record<string, number>;
    totalMinigamesPlayed: number;
    totalMinigamesWon: number;
    consecutiveWins: number;
    maxConsecutiveWins: number;

    // Arcade tracking
    arcadePlayedByType: Record<string, number>;
    arcadeHighScores: Record<string, number>;
    totalArcadePlayed: number;

    // Economy
    maxMoneyReached: number;
    brokeTimes: number;

    // Police
    raidsSurvived: number;
    bribesPaid: number;

    // Bicho
    bichoBetsPlaced: number;
    bichoWins: number;

    // Exploration
    walkTimeSeconds: number;

    // Sinuca specifically
    sinucaWins: number;

    // Unique minigames played (set of type names)
    uniqueMinigamesPlayed: Set<string>;
    uniqueArcadesPlayed: Set<string>;
}

/** Achievement definition */
export interface Achievement {
    id: string;
    name: string;
    description: string;
    reward: number;
    tier: 1 | 2 | 3 | 4;
    unlocked: boolean;
    condition: (stats: PlayerStats) => boolean;
}

/** Tier display info */
const TIER_INFO: Record<number, { label: string; color: string; icon: string }> = {
    1: { label: 'CURIOSO', color: '#44ff88', icon: '🟢' },
    2: { label: 'FREQUENTE', color: '#ffcc00', icon: '🟡' },
    3: { label: 'VETERANO', color: '#ff4444', icon: '🔴' },
    4: { label: 'LENDA', color: '#cc66ff', icon: '🟣' },
};

export { TIER_INFO };

export class AchievementManager {
    private static instance: AchievementManager;

    private stats: PlayerStats;
    private achievements: Achievement[];

    private constructor() {
        this.stats = this.createDefaultStats();
        this.achievements = this.createAchievements();
    }

    public static getInstance(): AchievementManager {
        if (!AchievementManager.instance) {
            AchievementManager.instance = new AchievementManager();
        }
        return AchievementManager.instance;
    }

    // ─────────────────────────────────────────────────
    // Stats Recording
    // ─────────────────────────────────────────────────

    /** Record a minigame being played */
    public recordMinigamePlay(type: string): void {
        this.stats.minigamesPlayedByType[type] = (this.stats.minigamesPlayedByType[type] || 0) + 1;
        this.stats.totalMinigamesPlayed++;
        this.stats.uniqueMinigamesPlayed.add(type);
        this.checkAchievements();
    }

    /** Record a minigame win */
    public recordMinigameWin(type: string): void {
        this.stats.minigamesWonByType[type] = (this.stats.minigamesWonByType[type] || 0) + 1;
        this.stats.totalMinigamesWon++;
        this.stats.consecutiveWins++;
        if (this.stats.consecutiveWins > this.stats.maxConsecutiveWins) {
            this.stats.maxConsecutiveWins = this.stats.consecutiveWins;
        }
        this.checkAchievements();
    }

    /** Record a minigame loss (breaks consecutive wins) */
    public recordMinigameLoss(): void {
        this.stats.consecutiveWins = 0;
    }

    /** Record an arcade game ending */
    public recordArcadeEnd(type: string, score: number): void {
        this.stats.arcadePlayedByType[type] = (this.stats.arcadePlayedByType[type] || 0) + 1;
        this.stats.totalArcadePlayed++;
        this.stats.uniqueArcadesPlayed.add(type);

        // Track high score
        const prev = this.stats.arcadeHighScores[type] || 0;
        if (score > prev) {
            this.stats.arcadeHighScores[type] = score;
        }

        this.checkAchievements();
    }

    /** Record surviving a police raid */
    public recordRaidSurvived(): void {
        this.stats.raidsSurvived++;
        this.checkAchievements();
    }

    /** Record paying a bribe */
    public recordBribePaid(): void {
        this.stats.bribesPaid++;
        this.checkAchievements();
    }

    /** Record a Jogo do Bicho bet */
    public recordBichoBet(): void {
        this.stats.bichoBetsPlaced++;
        this.checkAchievements();
    }

    /** Record a Jogo do Bicho win */
    public recordBichoWin(): void {
        this.stats.bichoWins++;
        this.checkAchievements();
    }

    /** Record Sinuca win specifically */
    public recordSinucaWin(): void {
        this.stats.sinucaWins++;
        this.checkAchievements();
    }

    /** Add walk time (call periodically from exploration) */
    public addWalkTime(seconds: number): void {
        this.stats.walkTimeSeconds += seconds;
        this.checkAchievements();
    }

    /** Update max money reached */
    public updateMaxMoney(amount: number): void {
        if (amount > this.stats.maxMoneyReached) {
            this.stats.maxMoneyReached = amount;
            this.checkAchievements();
        }
    }

    /** Record player going broke */
    public recordBroke(): void {
        this.stats.brokeTimes++;
        this.checkAchievements();
    }

    // ─────────────────────────────────────────────────
    // Arcade Score-to-Money (Option B: Diminishing Returns)
    // ─────────────────────────────────────────────────

    /**
     * Calculate money reward for an arcade score.
     * 0-500 pts:    R$0.04/pt  (max R$20)
     * 500-1000 pts: R$0.02/pt  (max R$10)
     * 1000+ pts:    R$0.01/pt  (max R$10)
     * Total cap: R$40
     */
    public calculateArcadeReward(score: number): number {
        let reward = 0;

        // Tier 1: first 500 points at R$0.04/pt
        const t1Points = Math.min(score, 500);
        reward += t1Points * 0.04;

        // Tier 2: 500-1000 at R$0.02/pt
        if (score > 500) {
            const t2Points = Math.min(score - 500, 500);
            reward += t2Points * 0.02;
        }

        // Tier 3: 1000+ at R$0.01/pt
        if (score > 1000) {
            const t3Points = Math.min(score - 1000, 1000);
            reward += t3Points * 0.01;
        }

        // Round to nearest 10 (game's money unit)
        reward = Math.floor(reward / 10) * 10;

        // Clamp to R$40 max
        return Math.min(reward, 40);
    }

    // ─────────────────────────────────────────────────
    // Achievement Checking
    // ─────────────────────────────────────────────────

    private checkAchievements(): void {
        const emitter = GameEventEmitter.getInstance();
        const economy = EconomyManager.getInstance();

        for (const ach of this.achievements) {
            if (ach.unlocked) continue;

            try {
                if (ach.condition(this.stats)) {
                    ach.unlocked = true;

                    // Give money reward
                    economy.addMoney(ach.reward);

                    // Play sound
                    SoundManager.getInstance().play('achievement_unlock');

                    // Emit event for UI
                    emitter.emit('ACHIEVEMENT_UNLOCKED', {
                        name: ach.name,
                        description: ach.description,
                        reward: ach.reward,
                        tier: ach.tier,
                    });

                    console.log(`🏆 Achievement unlocked: ${ach.name} (+R$${ach.reward})`);
                }
            } catch {
                // Silently skip if condition throws
            }
        }
    }

    /** Get all achievements (for UI display etc.) */
    public getAchievements(): Achievement[] {
        return this.achievements;
    }

    /** Get current stats (read-only) */
    public getStats(): PlayerStats {
        return this.stats;
    }

    /** Reset all progress */
    public reset(): void {
        this.stats = this.createDefaultStats();
        for (const ach of this.achievements) {
            ach.unlocked = false;
        }
    }

    // ─────────────────────────────────────────────────
    // Default Stats
    // ─────────────────────────────────────────────────

    private createDefaultStats(): PlayerStats {
        return {
            minigamesPlayedByType: {},
            minigamesWonByType: {},
            totalMinigamesPlayed: 0,
            totalMinigamesWon: 0,
            consecutiveWins: 0,
            maxConsecutiveWins: 0,
            arcadePlayedByType: {},
            arcadeHighScores: {},
            totalArcadePlayed: 0,
            maxMoneyReached: 100,
            brokeTimes: 0,
            raidsSurvived: 0,
            bribesPaid: 0,
            bichoBetsPlaced: 0,
            bichoWins: 0,
            walkTimeSeconds: 0,
            sinucaWins: 0,
            uniqueMinigamesPlayed: new Set(),
            uniqueArcadesPlayed: new Set(),
        };
    }

    // ─────────────────────────────────────────────────
    // Achievement Definitions (30 total)
    // ─────────────────────────────────────────────────

    private createAchievements(): Achievement[] {
        return [
            // ═══ TIER 1: CURIOSO (Exploração) ═══
            {
                id: 'primeiro_passo',
                name: 'Primeiro Passo',
                description: 'Jogue qualquer minigame pela primeira vez',
                reward: 20,
                tier: 1,
                unlocked: false,
                condition: (s) => s.totalMinigamesPlayed >= 1 || s.totalArcadePlayed >= 1,
            },
            {
                id: 'turista',
                name: 'Turista',
                description: 'Jogue 5 minigames diferentes',
                reward: 50,
                tier: 1,
                unlocked: false,
                condition: (s) => s.uniqueMinigamesPlayed.size >= 5,
            },
            {
                id: 'conhecedor',
                name: 'Conhecedor',
                description: 'Jogue todos os 14 minigames pelo menos uma vez',
                reward: 150,
                tier: 1,
                unlocked: false,
                condition: (s) => s.uniqueMinigamesPlayed.size >= 14,
            },
            {
                id: 'fliperameiro',
                name: 'Fliperameiro',
                description: 'Jogue todos os 5 jogos de fliperama',
                reward: 100,
                tier: 1,
                unlocked: false,
                condition: (s) => s.uniqueArcadesPlayed.size >= 5,
            },
            {
                id: 'caminhante',
                name: 'Caminhante',
                description: 'Ande pelo mapa por 5 minutos',
                reward: 30,
                tier: 1,
                unlocked: false,
                condition: (s) => s.walkTimeSeconds >= 300,
            },
            {
                id: 'apostador_bicho',
                name: 'Apostador do Bicho',
                description: 'Faça uma aposta no Jogo do Bicho',
                reward: 20,
                tier: 1,
                unlocked: false,
                condition: (s) => s.bichoBetsPlaced >= 1,
            },

            // ═══ TIER 2: FREQUENTE (Dedicação) ═══
            {
                id: 'viciado',
                name: 'Viciado em Jogos',
                description: 'Jogue 50 partidas de minigames',
                reward: 200,
                tier: 2,
                unlocked: false,
                condition: (s) => s.totalMinigamesPlayed >= 50,
            },
            {
                id: 'maratonista',
                name: 'Maratonista',
                description: 'Jogue 100 partidas de minigames',
                reward: 500,
                tier: 2,
                unlocked: false,
                condition: (s) => s.totalMinigamesPlayed >= 100,
            },
            {
                id: 'sortudo',
                name: 'Sortudo',
                description: 'Ganhe 10 partidas',
                reward: 200,
                tier: 2,
                unlocked: false,
                condition: (s) => s.totalMinigamesWon >= 10,
            },
            {
                id: 'mao_quente',
                name: 'Mão Quente',
                description: 'Ganhe 3 partidas seguidas',
                reward: 150,
                tier: 2,
                unlocked: false,
                condition: (s) => s.maxConsecutiveWins >= 3,
            },
            {
                id: 'ficha_arcade',
                name: 'Ficha Arcade',
                description: 'Jogue 20 partidas de fliperama',
                reward: 200,
                tier: 2,
                unlocked: false,
                condition: (s) => s.totalArcadePlayed >= 20,
            },
            {
                id: 'profeta_bicho',
                name: 'Profeta do Bicho',
                description: 'Acerte 3 apostas no Jogo do Bicho',
                reward: 100,
                tier: 2,
                unlocked: false,
                condition: (s) => s.bichoWins >= 3,
            },

            // ═══ TIER 3: VETERANO (Habilidade + Persistência) ═══
            {
                id: 'economista',
                name: 'Economista',
                description: 'Acumule R$2.000',
                reward: 500,
                tier: 3,
                unlocked: false,
                condition: (s) => s.maxMoneyReached >= 2000,
            },
            {
                id: 'magnata',
                name: 'Magnata',
                description: 'Acumule R$5.000',
                reward: 1000,
                tier: 3,
                unlocked: false,
                condition: (s) => s.maxMoneyReached >= 5000,
            },
            {
                id: 'fenix',
                name: 'Fênix',
                description: 'Recupere de R$0 três vezes',
                reward: 150,
                tier: 3,
                unlocked: false,
                condition: (s) => s.brokeTimes >= 3,
            },
            {
                id: 'sobrevivente',
                name: 'Sobrevivente',
                description: 'Escape de 5 batidas policiais',
                reward: 400,
                tier: 3,
                unlocked: false,
                condition: (s) => s.raidsSurvived >= 5,
            },
            {
                id: 'corruptivel',
                name: 'Corruptível',
                description: 'Pague suborno 3 vezes',
                reward: 50,
                tier: 3,
                unlocked: false,
                condition: (s) => s.bribesPaid >= 3,
            },
            {
                id: 'mestre_pong',
                name: 'Mestre do Pong',
                description: 'Faça 500+ pontos no Air Pong',
                reward: 300,
                tier: 3,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['air_pong'] || 0) >= 500,
            },
            {
                id: 'pistoleiro',
                name: 'Pistoleiro',
                description: 'Faça 1000+ pontos no Faroeste',
                reward: 400,
                tier: 3,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['faroeste'] || 0) >= 1000,
            },
            {
                id: 'lamina_afiada',
                name: 'Lâmina Afiada',
                description: 'Faça 1000+ pontos no Risca Faca',
                reward: 400,
                tier: 3,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['risca_faca'] || 0) >= 1000,
            },
            {
                id: 'rei_da_mesa',
                name: 'Rei da Mesa',
                description: 'Vença uma partida de Sinuca',
                reward: 500,
                tier: 3,
                unlocked: false,
                condition: (s) => s.sinucaWins >= 1,
            },
            {
                id: 'tanque_guerra',
                name: 'Tanque de Guerra',
                description: 'Faça 1000+ pontos no Tank Attack',
                reward: 400,
                tier: 3,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['tank_attack'] || 0) >= 1000,
            },

            // ═══ TIER 4: LENDA (Quase impossível) ═══
            {
                id: 'imparavel',
                name: 'O Imparável',
                description: 'Faça 1500+ pontos no Air Pong',
                reward: 1500,
                tier: 4,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['air_pong'] || 0) >= 1500,
            },
            {
                id: 'clint_eastwood',
                name: 'Clint Eastwood',
                description: 'Faça 3000+ pontos no Faroeste',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['faroeste'] || 0) >= 3000,
            },
            {
                id: 'cangaceiro',
                name: 'Cangaceiro Lendário',
                description: 'Faça 3000+ pontos no Risca Faca',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['risca_faca'] || 0) >= 3000,
            },
            {
                id: 'general',
                name: 'General',
                description: 'Faça 3000+ pontos no Tank Attack',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => (s.arcadeHighScores['tank_attack'] || 0) >= 3000,
            },
            {
                id: 'as_cassino',
                name: 'Ás do Cassino',
                description: 'Ganhe 50 partidas de minigames',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => s.totalMinigamesWon >= 50,
            },
            {
                id: 'imperador',
                name: 'Imperador',
                description: 'Acumule R$20.000',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => s.maxMoneyReached >= 20000,
            },
            {
                id: 'intocavel',
                name: 'Intocável',
                description: 'Escape de 15 batidas policiais',
                reward: 2000,
                tier: 4,
                unlocked: false,
                condition: (s) => s.raidsSurvived >= 15,
            },
            {
                id: 'cem_porcento',
                name: '100%',
                description: 'Desbloqueie todas as outras conquistas',
                reward: 3000,
                tier: 4,
                unlocked: false,
                condition: (_s) => {
                    // Check all other achievements (all except this one)
                    return this.achievements
                        .filter(a => a.id !== 'cem_porcento')
                        .every(a => a.unlocked);
                },
            },
        ];
    }
}
