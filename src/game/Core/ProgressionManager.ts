/**
 * ProgressionManager — Controls game content unlocking via a branching tree.
 * Singleton. Each game has its own unlock condition based on plays in related games.
 *
 * UNLOCK TREE (approved design):
 * ── RUA ──────────────────────────────────────────────────────────────────
 *   dice (always) ──12 plays──▶ ronda ──8 plays──▶ domino
 *   heads_tails (always) ──12 plays──▶ jokenpo ──8 plays──▶ purrinha
 *   purrinha ──5 plays──▶ palitinho ──8 plays──▶ fan_tan
 *
 * ── SHOPPING ─────────────────────────────────────────────────────────────
 *   slots (always) ──8 plays──▶ bicho
 *
 * ── ESTAÇÃO ──────────────────────────────────────────────────────────────
 *   casino_station: requires 5 domino plays
 *   blackjack: available on entry (no extra condition)
 *   poker: requires R$500 ever reached (only financial gate in the game)
 *
 * ── BAR ──────────────────────────────────────────────────────────────────
 *   video_bingo (always in bar) ──3 plays──▶ horse_racing ──4 plays──▶ dog_racing
 *
 * ── FLIPERAMA ─────────────────────────────────────────────────────────────
 *   arcade_pong (always) ──1──▶ arcade_faroeste ──1──▶ arcade_risca
 *   arcade_risca ──1──▶ arcade_tank ──1──▶ arcade_sinuca
 */

import { GameEventEmitter } from './EventEmitter';
import { SoundManager } from './SoundManager';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** All game identifiers that can be gated */
export type GateableGame =
    | 'dados' | 'ronda' | 'domino'
    | 'cara_coroa' | 'jokenpo' | 'purrinha' | 'palitinho' | 'fan_tan'
    | 'slots' | 'bicho'
    | 'casino_station' | 'blackjack' | 'poker'
    | 'video_bingo' | 'horse_racing' | 'dog_racing'
    | 'arcade_pong' | 'arcade_faroeste' | 'arcade_risca' | 'arcade_tank' | 'arcade_sinuca'
    | 'bar_games' | 'arcade';

/** Unlock condition for a single game */
interface UnlockCondition {
    /** Number of completed plays required in another game */
    requiresPlays?: { game: string; count: number };
    /** Maximum money ever reached (only used for poker) */
    requiresMaxMoney?: number;
}

/** Cooldown location types */
export type CooldownType = 'street_npc' | 'bar' | 'slots' | 'blackjack' | 'poker';

/** Kept for backward compatibility with event consumers */
export type GamePhase = 0 | 1 | 2 | 3 | 4;

export interface PhaseUnlockInfo {
    phase: GamePhase;
    title: string;
    description: string;
    unlocks: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Unlock Tree — single source of truth
// ─────────────────────────────────────────────────────────────────────────────

const UNLOCK_TREE: Partial<Record<string, UnlockCondition>> = {
    // ── RUA ──
    dados:       {},   // always available
    cara_coroa:{},   // always available
    ronda:      { requiresPlays: { game: 'dados',       count: 15 } },
    jokenpo:    { requiresPlays: { game: 'cara_coroa', count: 15 } },
    domino:     { requiresPlays: { game: 'ronda',      count: 10 } },
    purrinha:   { requiresPlays: { game: 'jokenpo',    count: 10 } },
    palitinho:  { requiresPlays: { game: 'purrinha',   count: 6  } }, // Purrinha is med duration
    fan_tan:    { requiresPlays: { game: 'palitinho',  count: 10 } },

    // ── SHOPPING ──
    slots:      {},   // always available
    bicho:      { requiresPlays: { game: 'slots',      count: 10 } },

    // ── ESTAÇÃO ──
    casino_station: { requiresPlays: { game: 'domino', count: 4  } }, // Domino is slow
    blackjack:  {},   // free once casino_station is unlocked
    poker:      { requiresMaxMoney: 1000 }, // Increased from 500 to match new economy

    // ── BAR ──
    video_bingo:  {},   // first game available in bar
    horse_racing: { requiresPlays: { game: 'video_bingo',  count: 5 } },
    dog_racing:   { requiresPlays: { game: 'horse_racing', count: 5 } },

    // ── FLIPERAMA ──
    arcade_pong:     {},   // always lit
    arcade_faroeste: { requiresPlays: { game: 'arcade_pong',     count: 1  } },
    arcade_risca:    { requiresPlays: { game: 'arcade_faroeste', count: 1  } },
    arcade_tank:     { requiresPlays: { game: 'arcade_risca',    count: 1  } },
    arcade_sinuca:   { requiresPlays: { game: 'arcade_tank',     count: 1  } }, // Tank can be long
};

// ─────────────────────────────────────────────────────────────────────────────
// Unlock messages per game (shown as notification when a game is unlocked)
// ─────────────────────────────────────────────────────────────────────────────

const UNLOCK_MESSAGES: Partial<Record<string, string>> = {
    ronda:          '🃏 O pessoal da Ronda ouviu falar de você. Vai lá!',
    jokenpo:        '✂️ Um cara quer te desafiar no Jokenpô. Não foge não.',
    domino:         '🀱 A mesa do Dominó tá te esperando. Não vai deixar...',
    purrinha:       '🤜 Purrinha liberada! Quantas pedras você acha que eu tenho?',
    palitinho:      '🥢 O palitinho apareceu. Torça pra não tirar o curto.',
    fan_tan:        '🀄 Fan Tan aberto. O dragão de ouro manda seus cumprimentos.',
    bicho:          '🐆 O Jogo do Bicho tá rolando no shopping. Qual bicho é o seu?',
    casino_station: '🎲 O Cassino da Estação abriu pra você. Desce com cuidado.',
    poker:          '♠️ A mesa do Poker liberou. Geraldo e Tião estão te esperando.',
    horse_racing:   '🏇 Corrida de Cavalos no bar! O favorito raramente ganha...',
    dog_racing:     '🐕 Os galgos estão na pista. Apostou no certo dessa vez?',
    arcade_faroeste:'🤠 O Faroeste ligou no fliperama. Aponta e não trema.',
    arcade_risca:   '🔪 Risca Faca tá no ar. Reflexo é tudo, playboy.',
    arcade_tank:    '🪖 Tank Attack desbloqueado! Destrói tudo que aparecer.',
    arcade_sinuca:  '🎱 A mesa de Sinuca tá pronta. Quem manda no taco é você.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Locked hint messages per game
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_HINTS: Partial<Record<string, (playsLeft: number, gameName: string) => string>> = {
    ronda:          (n) => `Ainda faltam ${n} partidas nos Dados pra você chegar na Ronda.`,
    jokenpo:        (n) => `Joga mais ${n} Cara ou Coroa e o Jokenpô te aceita.`,
    domino:         (n) => `${n} partidas de Ronda ainda. O Dominó não é pra qualquer um.`,
    purrinha:       (n) => `Falta jogar ${n} vezes no Jokenpô. A Purrinha exige respeito.`,
    palitinho:      (n) => `Ainda tem ${n} rodadas de Purrinha pela frente. Depois vem o palitinho.`,
    fan_tan:        (n) => `Joga mais ${n} no Palitinho. O Fan Tan é pra quem tem paciência.`,
    bicho:          (n) => `${n} jogadas em qualquer Caça-Níquel ainda. A banca do Bicho é exigente.`,
    casino_station: (n) => `Dominó ${n} vez${n === 1 ? '' : 'es'} ainda. O Cassino da Estação não é pra todo mundo.`,
    blackjack:      ()  => `Entra no Cassino da Estação primeiro. Ele tem pré-requisito.`,
    poker:          ()  => `O Poker é caro. Chega a R$1000 em caixa pra sentar nessa mesa.`,
    horse_racing:   (n) => `Termina mais ${n} Bingo${n === 1 ? '' : 's'}. Os cavalos não esperam amador.`,
    dog_racing:     (n) => `${n} corrida${n === 1 ? '' : 's'} de Cavalos ainda. Os Galgos são pra veterano.`,
    arcade_faroeste:(n) => `${n} sessão${n === 1 ? '' : 'ões'} de Pong ainda. O Faroeste não liga pra novato.`,
    arcade_risca:   (n) => `Joga mais ${n} no Faroeste. Risca Faca é pra mão firme.`,
    arcade_tank:    (n) => `${n} rodada${n === 1 ? '' : 's'} de Risca Faca ainda. O tanque tá esperando.`,
    arcade_sinuca:  (n) => `Tank Attack mais ${n} vezes. A mesa da Sinuca tem moral.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// ProgressionManager
// ─────────────────────────────────────────────────────────────────────────────

export class ProgressionManager {
    private static instance: ProgressionManager;

    private unlockedGames: Set<string> = new Set();
    private cooldowns: Map<string, number> = new Map();

    private constructor() {
        // Games with empty condition ({}) are unlocked from the start
        for (const [gameId, condition] of Object.entries(UNLOCK_TREE)) {
            if (condition && Object.keys(condition).length === 0) {
                this.unlockedGames.add(gameId);
            }
        }
    }

    public static getInstance(): ProgressionManager {
        if (!ProgressionManager.instance) {
            ProgressionManager.instance = new ProgressionManager();
        }
        return ProgressionManager.instance;
    }

    // ─────────────────────────────────────────────────
    // Core unlock check — call after every play/money update
    // ─────────────────────────────────────────────────

    /**
     * Re-evaluate the entire unlock tree with current stats.
     * Call after every minigame play and whenever money changes.
     * @param playsByGame  Record of plays per game id from AchievementManager
     * @param maxMoneyEver Maximum money the player has ever held
     */
    public checkUnlocks(
        playsByGame: Record<string, number>,
        maxMoneyEver: number
    ): void {
        for (const [gameId, condition] of Object.entries(UNLOCK_TREE)) {
            if (this.unlockedGames.has(gameId)) continue; // already unlocked
            if (!condition) continue;

            let satisfied = false;

            if (Object.keys(condition).length === 0) {
                // No condition = always available
                satisfied = true;
            } else if (condition.requiresPlays) {
                const { game, count } = condition.requiresPlays;
                satisfied = (playsByGame[game] || 0) >= count;
            } else if (condition.requiresMaxMoney !== undefined) {
                satisfied = maxMoneyEver >= condition.requiresMaxMoney;
            }

            if (satisfied) {
                this.unlockedGames.add(gameId);
                this.emitUnlock(gameId);
            }
        }
    }

    private emitUnlock(gameId: string): void {
        const message = UNLOCK_MESSAGES[gameId];
        if (message) {
            GameEventEmitter.getInstance().emit('GAME_UNLOCKED', { gameId, message });
            SoundManager.getInstance().play('achievement_unlock');
        }
    }

    // ─────────────────────────────────────────────────
    // Public queries
    // ─────────────────────────────────────────────────

    public isGameUnlocked(gameType: string): boolean {
        // Aliases for backward compatibility
        if (gameType === 'bar_games') return this.unlockedGames.has('video_bingo');
        if (gameType === 'arcade')    return this.unlockedGames.has('arcade_pong');
        return this.unlockedGames.has(gameType);
    }

    public isCasinoUnlocked(type: 'shopping' | 'station'): boolean {
        if (type === 'shopping') return true;
        return this.unlockedGames.has('casino_station');
    }

    // ─────────────────────────────────────────────────
    // Hint messages for locked games
    // ─────────────────────────────────────────────────

    public getLockedHint(
        gameType: string,
        playsByGame: Record<string, number>,
        _winCount: number  // kept for signature compat, unused
    ): string {
        const condition = UNLOCK_TREE[gameType];
        if (!condition) return `Esse jogo não é pra você ainda. Vaza.`;

        const hintFn = LOCKED_HINTS[gameType];
        if (!hintFn) return `Ainda não liberado. Joga mais pra desbloquear.`;

        if (condition.requiresPlays) {
            const { game, count } = condition.requiresPlays;
            const done = playsByGame[game] || 0;
            const left = Math.max(0, count - done);
            return hintFn(left, this.getGameDisplayName(gameType));
        }

        if (condition.requiresMaxMoney !== undefined) {
            return hintFn(0, this.getGameDisplayName(gameType));
        }

        return `Ainda não liberado. Joga mais pra desbloquear.`;
    }

    public getBarLockedHint(): string {
        return `Esse bar tem jogos exclusivos. Come\u00e7a pelo Bingo pra abrir o resto.`;
    }

    public getArcadeLockedHint(): string {
        return `Sem ficha pra amador. Termina mais partidas no Pong pra avançar.`;
    }

    public getStationCasinoLockedHint(playsByGame: Record<string, number>): string {
        const cond = UNLOCK_TREE['casino_station'];
        if (cond?.requiresPlays) {
            const done = playsByGame[cond.requiresPlays.game] || 0;
            const left = Math.max(0, cond.requiresPlays.count - done);
            if (left > 0) {
                return `Dominó mais ${left} vez${left === 1 ? '' : 'es'}. O cassino da estação é pra quem tem moral.`;
            }
        }
        return `O segurança não gostou da tua cara. Joga mais Dominó.`;
    }

    // ─────────────────────────────────────────────────
    // Cooldown System (unchanged from original)
    // ─────────────────────────────────────────────────

    public startCooldown(id: string, type: CooldownType): void {
        const durations: Record<CooldownType, number> = {
            street_npc: 30,
            bar: 0,
            slots: 0,
            blackjack: 0,
            poker: 0,
        };
        this.cooldowns.set(id, durations[type] ?? 30);
    }

    public isOnCooldown(id: string): boolean {
        return (this.cooldowns.get(id) || 0) > 0;
    }

    public updateCooldowns(dt: number): void {
        for (const [key, value] of this.cooldowns.entries()) {
            const newVal = value - dt;
            if (newVal <= 0) this.cooldowns.delete(key);
            else this.cooldowns.set(key, newVal);
        }
    }

    public getCooldownMessage(id: string, type: CooldownType): string {
        const remaining = this.cooldowns.get(id) || 0;
        const max = this.getMaxCooldown(type);
        const ratio = (max - remaining) / max;
        const seed = id;

        if (type === 'street_npc') {
            if (ratio < 0.33) return this.pickMsg(seed + 'r0', ['Calma aí, deixa eu guardar essa grana...', 'Peraí que tô contando os trocados.', 'Dá um tempo, parceiro.', 'Ô loco, tu joga rápido demais!']);
            if (ratio < 0.66) return this.pickMsg(seed + 'r1', ['Olha em volta, o bairro tá bonito hoje.', 'Enquanto espera, dá uma caminhada.', 'Vai ali no bar, toma uma.', 'Tu não para? Tem mais gente jogando por aí.']);
            return this.pickMsg(seed + 'r2', ['Quase pronto... mais um pouquinho.', 'Já já a gente joga.', 'Falta pouco, fica por perto.']);
        }
        if (type === 'bar')       return ratio < 0.5 ? 'A mesa tá sendo arrumada. Pede um café.' : 'Tá quase! Já organizei a mesa.';
        if (type === 'blackjack') return ratio < 0.5 ? 'O dealer tá embaralhando. No cassino, pressa é prejuízo.' : 'Cartas na mesa em instantes.';
        if (type === 'poker')     return ratio < 0.5 ? 'Geraldo foi buscar mais dinheiro/café. Calma.' : 'Geraldo voltou. A mesa tá quase pronta.';
        if (type === 'slots')     return ratio < 0.5 ? 'A máquina tá processando...' : 'Quase pronta! Mais uma moedinha e vai.';
        return 'Aguarde...';
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────

    private getMaxCooldown(type: CooldownType): number {
        const m: Record<CooldownType, number> = { street_npc: 30, bar: 0, slots: 0, blackjack: 0, poker: 0 };
        return m[type] ?? 30;
    }

    private pickMsg(seedStr: string, msgs: string[]): string {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        return msgs[Math.abs(hash) % msgs.length];
    }

    private getGameDisplayName(type: string): string {
        const names: Record<string, string> = {
            dados: 'Dados', ronda: 'Ronda', domino: 'Dominó',
            cara_coroa: 'Cara ou Coroa', jokenpo: 'Jokenpô',
            purrinha: 'Purrinha', palitinho: 'Palitinho', fan_tan: 'Fan Tan',
            slots: 'Caça-Níquel', bicho: 'Jogo do Bicho',
            blackjack: 'Blackjack', poker: 'Poker',
            horse_racing: 'Corrida de Cavalos', dog_racing: 'Corrida de Galgos',
            video_bingo: 'Vídeo Bingo',
            arcade_pong: 'Air Pong', arcade_faroeste: 'Faroeste',
            arcade_risca: 'Risca Faca', arcade_tank: 'Tank Attack',
            arcade_sinuca: 'Sinuca',
        };
        return names[type] || type;
    }

    public reset(): void {
        this.unlockedGames.clear();
        this.cooldowns.clear();
        // Re-unlock always-available games
        for (const [gameId, condition] of Object.entries(UNLOCK_TREE)) {
            if (condition && Object.keys(condition).length === 0) {
                this.unlockedGames.add(gameId);
            }
        }
    }

    // ─────────────────────────────────────────────────
    // Legacy compat — some callers still pass (achievementCount, winCount)
    // ─────────────────────────────────────────────────

    /** @deprecated Use checkUnlocks(playsByGame, maxMoney) instead */
    public checkPhaseTransition(
        _achievementCount: number,
        _winCount: number,
        _maxMoney: number
    ): PhaseUnlockInfo | null {
        // No longer drives unlocks — kept so callers don't crash
        return null;
    }

    /** @deprecated — always returns 0 now */
    public get currentPhase(): GamePhase { return 0; }

    public getUnlockedGames(): Set<string> { return new Set(this.unlockedGames); }
}
