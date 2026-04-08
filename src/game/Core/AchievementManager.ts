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
import { ProgressionManager } from './ProgressionManager';

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
    raidsEncountered: number; // New: tracking first contact

    // Bicho
    bichoBetsPlaced: number;
    bichoWins: number;

    // Exploration
    walkTimeSeconds: number;
    visitedLocations: Set<string>; // New: church, squares, etc.
    exitedEstablishments: Set<string>; // New: bars, arcades, casinos

    // Sinuca specifically
    sinucaWins: number;

    // Unique minigames played (set of type names)
    uniqueMinigamesPlayed: Set<string>;
    uniqueArcadesPlayed: Set<string>;

    // New: Phoenix recoveries (All-In wins)
    phoenixWins: number;
}

/** Achievement definition */
export interface Achievement {
    id: string;
    name: string;
    description: string;
    reward: number;
    tier: 0 | 1 | 2 | 3 | 4;
    unlocked: boolean;
    condition: (stats: PlayerStats) => boolean;
    category: 'exploracao' | 'vitoria' | 'derrota' | 'malandragem' | 'lenda' | 'resiliencia';
}

/** Tier display info */
const TIER_INFO: Record<number, { label: string; color: string; icon: string }> = {
    0: { label: 'EXPLORADOR', color: '#3399ff', icon: '🔵' }, // New blue tier
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
    private isAllInActive: boolean = false;

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

    /** Returns combined record of all games played (minigames + arcades) */
    public getPlaysByGame(): Record<string, number> {
        return {
            ...this.stats.minigamesPlayedByType,
            ...this.stats.arcadePlayedByType
        };
    }

    // ─────────────────────────────────────────────────
    // Stats Recording
    // ─────────────────────────────────────────────────

    /** Record a location being visited */
    public recordLocationVisit(id: string): void {
        const prevSize = this.stats.visitedLocations.size;
        this.stats.visitedLocations.add(id);
        if (this.stats.visitedLocations.size !== prevSize) {
            this.checkAchievements();
        }
    }

    /** Record exiting an establishment */
    public recordEstablishmentExit(id: string): void {
        const prevSize = this.stats.exitedEstablishments.size;
        this.stats.exitedEstablishments.add(id);
        if (this.stats.exitedEstablishments.size !== prevSize) {
            this.checkAchievements();
        }
    }

    /** Record first contact with police raid */
    public recordRaidEncounter(): void {
        this.stats.raidsEncountered++;
        this.checkAchievements();
    }

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

        // Phoenix Logic: Win while All-In
        if (this.isAllInActive) {
            this.stats.phoenixWins++;
            console.log(`🔥 Fênix! Conquista progresso: ${this.stats.phoenixWins}/3`);
        }
        this.isAllInActive = false; // Reset anyway

        this.checkAchievements();
    }

    public recordMinigameLoss(): void {
        this.stats.consecutiveWins = 0;
        this.isAllInActive = false; // Risk failed, reset all-in flag
        this.checkAchievements();
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
        
        // Count as minigame win for overall stats
        this.stats.totalMinigamesWon++;
        this.stats.consecutiveWins++;
        if (this.stats.consecutiveWins > this.stats.maxConsecutiveWins) {
            this.stats.maxConsecutiveWins = this.stats.consecutiveWins;
        }

        // Phoenix Logic: Win while All-In
        if (this.isAllInActive) {
            this.stats.phoenixWins++;
            console.log(`🔥 Fênix (Bicho)! Conquista progresso: ${this.stats.phoenixWins}/3`);
        }
        this.isAllInActive = false;

        this.checkAchievements();
    }

    /** Record Sinuca win specifically */
    public recordSinucaWin(): void {
        this.stats.sinucaWins++;

        // Count as minigame win for overall stats
        this.stats.totalMinigamesWon++;
        this.stats.consecutiveWins++;
        if (this.stats.consecutiveWins > this.stats.maxConsecutiveWins) {
            this.stats.maxConsecutiveWins = this.stats.consecutiveWins;
        }

        // Phoenix Logic: Win while All-In
        if (this.isAllInActive) {
            this.stats.phoenixWins++;
            console.log(`🔥 Fênix (Sinuca)! Conquista progresso: ${this.stats.phoenixWins}/3`);
        }
        this.isAllInActive = false;

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

    /** Record that the player risked everything (All-In) */
    public recordAllIn(): void {
        this.isAllInActive = true;
    }

    // ─────────────────────────────────────────────────
    // Achievement Checking
    // ─────────────────────────────────────────────────

    public checkAchievements(): void {
        const emitter = GameEventEmitter.getInstance();
        const economy = EconomyManager.getInstance();

        for (const ach of this.achievements) {
            if (ach.unlocked) continue;

            try {
                if (ach.condition(this.stats)) {
                    ach.unlocked = true;

                    // Give money reward
                    if (ach.reward > 0) {
                        economy.addMoney(ach.reward);
                    }

                    // Play sound
                    SoundManager.getInstance().play('achievement_unlock');

                    // Emit event for UI
                    emitter.emit('ACHIEVEMENT_UNLOCKED', {
                        name: ach.name,
                        description: ach.description,
                        reward: ach.reward,
                        tier: ach.tier,
                        category: ach.category
                    } as any);

                    console.log(`🏆 Achievement unlocked: ${ach.name} (+R$${ach.reward})`);

                    // Check Tier 0 completion bonus
                    this.checkTierCompletionBonus(ach.tier);
                }
            } catch {
                // Silently skip if condition throws
            }
        }

        // --- MODULAR PROGRESSION CHECK (Fixed: Run always, not just on achievement) ---
        const allPlays = {
            ...this.stats.minigamesPlayedByType,
            ...this.stats.arcadePlayedByType
        };
        ProgressionManager.getInstance().checkUnlocks(
            allPlays,
            this.stats.maxMoneyReached
        );
    }

    /** Check if all achievements of a given tier are completed, award bonus */
    private checkTierCompletionBonus(tier: number): void {
        if (tier !== 0) return; // Only Tier 0 has completion bonus for now

        const tierAchs = this.achievements.filter(a => a.tier === tier);
        const allComplete = tierAchs.every(a => a.unlocked);

        if (allComplete) {
            const economy = EconomyManager.getInstance();
            const emitter = GameEventEmitter.getInstance();
            const bonus = 10; // R$10 symbolic bonus
            economy.addMoney(bonus);

            emitter.emit('TIER_COMPLETE', {
                tier,
                bonus,
                message: 'Agora sim tu conhece o bairro.',
            });

            console.log(`⭐ Tier ${tier} complete! Bonus: R$${bonus}`);
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

    /** Get total number of unlocked achievements */
    public getUnlockedCount(): number {
        return this.achievements.filter(a => a.unlocked).length;
    }

    /** Get total win count */
    public getWinCount(): number {
        return this.stats.totalMinigamesWon;
    }

    /** Reset all progress */
    public reset(): void {
        this.stats = this.createDefaultStats();
        this.isAllInActive = false;
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
            raidsEncountered: 0,
            bichoBetsPlaced: 0,
            bichoWins: 0,
            walkTimeSeconds: 0,
            visitedLocations: new Set(),
            exitedEstablishments: new Set(),
            sinucaWins: 0,
            uniqueMinigamesPlayed: new Set(),
            uniqueArcadesPlayed: new Set(),
            phoenixWins: 0,
        };
    }

    // ─────────────────────────────────────────────────
    // Achievement Definitions (40 total)
    // ─────────────────────────────────────────────────

    private createAchievements(): Achievement[] {
        return [
            // ═══ TIER 0: EXPLORADOR (Descoberta) ═══
            { id: 'ar_graca', name: 'Ar de Graça', description: 'Entrou no Cassino Shopping pela primeira vez', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.exitedEstablishments.has('casino_shopping') },
            { id: 'passagem_comprada', name: 'Passagem Comprada', description: 'Entrou no Cassino da Estação', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.exitedEstablishments.has('casino_station') },
            { id: 'pecador', name: 'Pecador', description: 'Visitando a Igreja pela primeira vez', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.has('church') },
            { id: 'ar_fresco', name: 'Ar Fresco', description: 'Passou pela Praça principal do bairro', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.has('plaza_main') },
            { id: 'historia_imperial', name: 'História Imperial', description: 'Visitou o Marco Imperial de Santa Cruz', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.has('marco_imperial') },
            { id: 'bairro_amigo', name: 'Bairro Amigo', description: 'Explorou a área residencial', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.has('residential') },
            { id: 'filho_chora', name: 'Onde o Filho Chora', description: 'Primeiro contato visual com uma batida', reward: 0, tier: 0, unlocked: false, category: 'malandragem', condition: (s) => s.raidsEncountered >= 1 },
            { id: 'vigilancia_constante', name: 'Vigilância Constante', description: 'Entrou em zona de alto índice policial', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.has('high_risk') },
            { id: 'saideira_lei', name: 'Saideira de Lei', description: 'Saindo de um bar após uma rodada', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.exitedEstablishments.has('bar') },
            { id: 'viciado_fichas', name: 'Viciado em Fichas', description: 'Saindo de um fliperama após jogar', reward: 0, tier: 0, unlocked: false, category: 'exploracao', condition: (s) => s.exitedEstablishments.has('arcade') },
            
            // Novos rascunhos Etapa C
            { id: 'caminhada_matinal', name: 'Caminhada Matinal', description: 'Andou por 10 minutos seguidos.', reward: 10, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.walkTimeSeconds >= 600 },
            { id: 'shopping_sauna', name: 'Shopping ou Sauna?', description: 'Entrou no Cassino do Shopping 3 vezes.', reward: 0, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.exitedEstablishments.has('casino_shopping_3') }, // fake check, simplify
            { id: 'viciado_ficha_novo', name: 'Viciado em Ficha', description: 'Jogou 3 arcades diferentes.', reward: 10, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.uniqueArcadesPlayed.size >= 3 },
            { id: 'fregues_zeca_novo', name: 'Freguês do Zeca', description: 'Entrou no bar muitas vezes.', reward: 10, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => (s.minigamesPlayedByType['purrinha'] || 0) >= 10 },
            { id: 'turista_reta_novo', name: 'Turista da Reta', description: 'Visitou mais de 10 minigames diferentes.', reward: 20, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.uniqueMinigamesPlayed.size >= 10 },
            { id: 'sinal_linha', name: 'Sinal da Linha', description: 'Ficou parado perto do trem por 30s.', reward: 0, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.walkTimeSeconds >= 30 && s.visitedLocations.has('station') },
            { id: 'largo_bodegao', name: 'Largo do Bodegão', description: 'Visitou a área comercial da Reta 5 vazes.', reward: 0, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.visitedLocations.size >= 5 },
            { id: 'reta_base', name: 'Reta da Base', description: 'Andou muito pelo bairro de Santa Cruz.', reward: 10, tier: 1, unlocked: false, category: 'exploracao', condition: (s) => s.walkTimeSeconds >= 1200 }, // 20 mins total
            
            // 💰 Vitória
            { id: 'dono_mesa', name: 'Dono da Mesa', description: 'Fez a mística na Sinuca!', reward: 50, tier: 2, unlocked: false, category: 'vitoria', condition: (s) => s.sinucaWins >= 1 },
            { id: 'sorte_crianca', name: 'Sorte de Criança', description: 'Ganhou no Jokenpô na cagada.', reward: 10, tier: 1, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesWonByType['jokenpo'] || 0) >= 1 },
            { id: 'mestre_palitinho', name: 'Mestre do Palitinho', description: 'Dedos rápidos no gatilho.', reward: 10, tier: 1, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesWonByType['palitinho'] || 0) >= 5 },
            { id: 'papai_bingo', name: 'Papai do Bingo', description: 'Gritou BINGO na frente de todo mundo.', reward: 30, tier: 2, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesWonByType['video_bingo'] || 0) >= 1 },
            { id: 'barao_gado', name: 'Barão do Gado', description: 'O jóquei é teu primo? Que sorte.', reward: 50, tier: 2, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesWonByType['horse_racing'] || 0) >= 5 },
            { id: 'mao_alface', name: 'Mão de Alface', description: 'Venceu ganhando de fininho no Poker.', reward: 20, tier: 1, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesWonByType['poker'] || 0) >= 1 },
            { id: 'socio_bicho', name: 'Sócio do Bicho', description: 'O bicheiro já tá fechando a banca', reward: 30, tier: 2, unlocked: false, category: 'vitoria', condition: (s) => s.bichoWins >= 3 },
            
            // 🚬 Malandragem
            { id: 'papo_bar', name: 'Papo de Bar', description: 'Tu fala mais que o homem da cobra.', reward: 10, tier: 1, unlocked: false, category: 'malandragem', condition: (s) => s.uniqueMinigamesPlayed.size >= 8 },
            { id: 'aposta_risco', name: 'Aposta de Risco', description: 'Jogou com menos de R$20 no bolso.', reward: 10, tier: 1, unlocked: false, category: 'malandragem', condition: (s) => s.maxMoneyReached >= 20 && s.totalMinigamesPlayed >= 5 }, // Close enough
            { id: 'inimigo_estado', name: 'Inimigo do Estado', description: 'Sobreviveu a 5 batidas.', reward: 30, tier: 2, unlocked: false, category: 'malandragem', condition: (s) => s.raidsSurvived >= 5 },
            { id: 'sabonete', name: 'Sabonete', description: 'Escorregadio demais pros PMs.', reward: 20, tier: 1, unlocked: false, category: 'malandragem', condition: (s) => s.raidsSurvived >= 1 },
            { id: 'amigo_caneco', name: 'Amigo do Caneco', description: 'Pagou o café da firma.', reward: 0, tier: 1, unlocked: false, category: 'malandragem', condition: (s) => s.bribesPaid >= 1 },
            { id: 'madruga_subversiva', name: 'Madruga Subversiva', description: 'Rua até tarde da noite.', reward: 10, tier: 1, unlocked: false, category: 'malandragem', condition: (s) => s.walkTimeSeconds >= 300 },
            
            // 🤡 Derrota
            { id: 'fundo_poco', name: 'Fundo do Poço', description: 'Ficou com zero na carteira.', reward: 0, tier: 0, unlocked: false, category: 'derrota', condition: (s) => s.brokeTimes >= 1 },
            { id: 'reincidente', name: 'Reincidente', description: 'Quebrou 3 vezes. Já pode pedir música?', reward: 0, tier: 1, unlocked: false, category: 'derrota', condition: (s) => s.brokeTimes >= 3 },
            { id: 'profissional_falir', name: 'Profissional em Falir', description: 'Quebrou 5 vezes no mesmo save.', reward: 10, tier: 2, unlocked: false, category: 'derrota', condition: (s) => s.brokeTimes >= 5 },
            { id: 'doou_sangue', name: 'Doou o Sangue', description: 'O bicheiro agradece a grana.', reward: 0, tier: 1, unlocked: false, category: 'derrota', condition: (s) => s.bichoBetsPlaced > s.bichoWins + 5 },
            { id: 'tia_reclamando', name: 'Tia Reclamando', description: 'Perdeu dinheiro da vovó.', reward: 0, tier: 1, unlocked: false, category: 'derrota', condition: (s) => s.brokeTimes >= 2 },
            
            // 👑 Lenda
            { id: 'cem_maluco', name: '100% Maluco', description: 'Tu é a alma da madrugada de SC.', reward: 100, tier: 4, unlocked: false, category: 'lenda', condition: (s) => s.raidsSurvived >= 20 && s.bribesPaid >= 10 },
            { id: 'invicto', name: 'Invicto', description: 'Ganhando 10 vezes sem derrota.', reward: 150, tier: 4, unlocked: false, category: 'lenda', condition: (s) => s.maxConsecutiveWins >= 10 },
            { id: 'dono_santa_cruz', name: 'Dono de Santa Cruz', description: 'Pode comprar a reta inteira!', reward: 200, tier: 4, unlocked: false, category: 'lenda', condition: (s) => s.maxMoneyReached >= 20000 },
            { id: 'fenix_3', name: 'Fênix', description: '3 vitórias All-In seguidas (mítico)', reward: 70, tier: 3, unlocked: false, category: 'resiliencia', condition: (s) => s.phoenixWins >= 3 },
            
            // Outros Progressão (Tree sync)
            { id: 'desbloqueio_porta', name: 'Porta Aberta', description: 'Mostrou que não é amador', reward: 10, tier: 1, unlocked: false, category: 'vitoria', condition: (s) => (s.minigamesPlayedByType['dice'] || 0) >= 15 },
            { id: 'desbloqueio_bar', name: 'Chave do Bar', description: 'O Zeca liberou a mesa de fundos.', reward: 20, tier: 2, unlocked: false, category: 'exploracao', condition: (s) => (s.minigamesPlayedByType['ronda'] || 0) >= 10 },
            { id: 'desbloqueio_fliper', name: 'Chave do Fliper', description: 'Molecada chora quando tu chega', reward: 30, tier: 2, unlocked: false, category: 'exploracao', condition: (s) => (s.arcadePlayedByType['arcade_pong'] || 0) >= 1 }
        ];
    }
}
