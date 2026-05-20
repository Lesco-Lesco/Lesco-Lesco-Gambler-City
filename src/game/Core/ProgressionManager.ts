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
 *   arcade_pong (always) ──1──▶ arcade_faroeste ──1──▶ arcade_risca ──1──▶ arcade_tank
 *   arcade_tank ──1──▶ arcade_pinball ──1──▶ arcade_valorium ──1──▶ arcade_sinuca ──1──▶ arcade_botao
 */

import { GameEventEmitter } from './EventEmitter';
import { SoundManager } from './SoundManager';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** All game identifiers that can be gated */
export type GameType = 'arcade' | 'horse_racing' | 'dog_racing' | 'video_bingo'
    | 'dados' | 'ronda' | 'domino' | 'ludo' | 'damas' | 'resta_um'
    | 'cara_coroa' | 'jokenpo' | 'purrinha' | 'palitinho' | 'fan_tan'
    | 'slots' | 'bicho'
    | 'casino_station' | 'blackjack' | 'poker'
    | 'arcade_pong' | 'arcade_faroeste' | 'arcade_risca' | 'arcade_tank' | 'arcade_pinball' | 'arcade_valorium' | 'arcade_sinuca' | 'arcade_botao'
    | 'bar_games';

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
    dados:       {},
    cara_coroa:  {},
    ronda:       { requiresPlays: { game: 'dados',      count: 1 } },
    domino:      { requiresPlays: { game: 'ronda',      count: 7 } },
    ludo:        { requiresPlays: { game: 'domino',     count: 1 } },
    damas:       { requiresPlays: { game: 'ludo',       count: 1 } },
    resta_um:    { requiresPlays: { game: 'damas',      count: 1 } },
    jokenpo:     { requiresPlays: { game: 'cara_coroa', count: 1 } },
    purrinha:    { requiresPlays: { game: 'jokenpo',    count: 1 } },
    palitinho:   { requiresPlays: { game: 'purrinha',   count: 1 } },
    fan_tan:     { requiresPlays: { game: 'palitinho',  count: 1 } },

    // ── SHOPPING ──
    slots:      {},
    bicho:      { requiresPlays: { game: 'slots',      count: 10 } },

    // ── ESTAÇÃO ──
    casino_station: { requiresPlays: { game: 'domino', count: 4  } },
    blackjack:  {},
    poker:      {},

    // ── BAR ──
    video_bingo:  {},
    horse_racing: { requiresPlays: { game: 'video_bingo',  count: 1 } },
    dog_racing:   { requiresPlays: { game: 'horse_racing', count: 1 } },

    // ── FLIPERAMA ──
    arcade:          {},
    arcade_pong:     {},
    arcade_faroeste: { requiresPlays: { game: 'arcade_pong',     count: 1  } },
    arcade_risca:    { requiresPlays: { game: 'arcade_faroeste', count: 1  } },
    arcade_tank:     { requiresPlays: { game: 'arcade_risca',    count: 1  } },
    arcade_pinball:  { requiresPlays: { game: 'arcade_tank',     count: 1  } },
    arcade_valorium: { requiresPlays: { game: 'arcade_pinball',  count: 1  } },
    arcade_sinuca:   { requiresPlays: { game: 'arcade_valorium', count: 1  } },
    arcade_botao:    { requiresPlays: { game: 'arcade_sinuca',   count: 1  } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Unlock messages per game (shown as notification when a game is unlocked)
// ─────────────────────────────────────────────────────────────────────────────

const UNLOCK_MESSAGES: Partial<Record<GameType, string>> = {
    ronda:          '🃏 O pessoal da Ronda ouviu falar de você. Vai lá!',
    jokenpo:        '🥊 Um cara quer te desafiar no Jokenpô. Não foge não.',
    domino:         '🎲 A mesa do Dominó tá te esperando. Não vai deixar os velhos no vácuo...',
    ludo:           '🎲 Liberaram uma mesa de Ludo na praça. Cuidado com as capturas!',
    damas:          '🎲 Tem gente apostando alto nas Damas ali na praça. Vai encarar?',
    resta_um:       '🎲 Um quebra-cabeça de Resta Um valendo grana. Será que cê tem cabeça pra isso?',
    purrinha:       '✊ Purrinha liberada! Quantas pedras você acha que eu tenho?',
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
    arcade_pinball: '🕹️ Pinball Neon liberado! Mostra teus reflexos na luz.',
    arcade_sinuca:  '🎱 A mesa de Sinuca tá pronta. Quem manda no taco é você.',
    arcade_valorium:'🐉 Valorium Titan\'s Fury ligado. Mostre seus combos!',
    arcade_botao:   '⚽ Futebol de Botão liberado! Prepara o dedo e o efeito.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Locked hint messages per game
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_HINTS: Partial<Record<GameType, (n: number) => string>> = {
    ronda:          (n) => `Ainda falta ${n} partida nos Dados pra você chegar na Ronda.`,
    jokenpo:        (n) => `Joga mais ${n} Cara ou Coroa e o Jokenpô te aceita.`,
    domino:         (n) => `${n} partidas de Ronda ainda. O Dominó não é pra qualquer um.`,
    ludo:           (n) => `Falta ${n} partida de Dominó pra deixarem você jogar Ludo.`,
    damas:          (n) => `Joga mais ${n} Ludo pra poder sentar na mesa de Damas.`,
    resta_um:       (n) => `Treina mais nas Damas. ${n} vez pra jogar Resta Um.`,
    purrinha:       (n) => `Falta jogar ${n} vez no Jokenpô. A Purrinha exige respeito.`,
    palitinho:      (n) => `Ainda tem ${n} rodada de Purrinha pela frente. Depois vem o palitinho.`,
    fan_tan:        (n) => `O palitinho treina a mente. Jogue ${n} vez para desbloquear o Fan Tan.`,
    bicho:          (n) => `${n} jogadas em qualquer Caça-Níquel ainda. A banca do Bicho é exigente.`,
    casino_station: (n) => `Dominó ${n} vez${n === 1 ? '' : 'es'} ainda. O Cassino da Estação não é pra todo mundo.`,
    blackjack:      ()  => `Entra no Cassino da Estação primeiro. Ele tem pré-requisito.`,
    poker:      ()  => `Entra no Cassino da Estação primeiro. Ele tem pré-requisito.`,
    horse_racing:   (n) => `Termina mais ${n} Bingo. Os cavalos não esperam amador.`,
    dog_racing:     (n) => `${n} corrida de Cavalos ainda. Os Galgos são pra veterano.`,
    arcade_faroeste:(n) => `${n} sessão${n === 1 ? '' : 'ões'} de Air Pong ainda. O Faroeste não liga pra novato.`,
    arcade_risca:   (n) => `Joga mais ${n} no Faroeste. Risca Faca é pra mão firme.`,
    arcade_tank:    (n) => `${n} rodada${n === 1 ? '' : 's'} de Risca Faca ainda. O tanque tá esperando.`,
    arcade_pinball: (n) => `Mais ${n} partida${n === 1 ? '' : 's'} de Tank Attack pro Sunset Paradise.`,
    arcade_valorium:(n) => `Mais ${n} partida${n === 1 ? '' : 's'} de Sunset Paradise pro Valorium. O dragão dorme.`,
    arcade_sinuca:  (n) => `Valorium Titan's Fury mais ${n} vez${n === 1 ? '' : 'es'}. A mesa da Sinuca tem moral.`,
    arcade_botao:   (n) => `Sinuca mais ${n} vez${n === 1 ? '' : 'es'}. O campo tá sendo polido.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// ProgressionManager
// ─────────────────────────────────────────────────────────────────────────────

export class ProgressionManager {
    private static instance: ProgressionManager;

    private unlockedGames: Set<string> = new Set();
    private cooldowns: Map<string, number> = new Map();

    private constructor() {
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

    public checkUnlocks(
        playsByGame: Record<string, number>,
        maxMoneyEver: number
    ): void {
        for (const [gameId, condition] of Object.entries(UNLOCK_TREE)) {
            if (this.unlockedGames.has(gameId)) continue;
            if (!condition) continue;

            let satisfied = false;
            if (Object.keys(condition).length === 0) {
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
        const message = UNLOCK_MESSAGES[gameId as GameType];
        if (message) {
            GameEventEmitter.getInstance().emit('GAME_UNLOCKED', { gameId, message });
            SoundManager.getInstance().play('achievement_unlock');
        }
    }

    public unlockAllGamesForCheat(): void {
        const games: GameType[] = [
            'dados', 'ronda', 'domino', 'ludo', 'damas', 'resta_um',
            'cara_coroa', 'jokenpo', 'purrinha', 'palitinho', 'fan_tan',
            'slots', 'bicho', 'blackjack', 'poker', 'casino_station',
            'arcade', 'video_bingo', 'horse_racing', 'dog_racing',
            'arcade_pong', 'arcade_faroeste', 'arcade_risca', 'arcade_tank', 'arcade_pinball', 'arcade_valorium', 'arcade_sinuca', 'arcade_botao'
        ];
        games.forEach(g => this.unlockedGames.add(g));
    }

    public isGameUnlocked(gameType: string): boolean {
        if (gameType === 'bar_games') return this.unlockedGames.has('video_bingo');
        return this.unlockedGames.has(gameType);
    }

    public getLockedHint(
        gameType: string,
        playsByGame: Record<string, number>,
        _winCount: number
    ): string {
        const condition = UNLOCK_TREE[gameType];
        if (!condition) return `Esse jogo não é pra você ainda. Vaza.`;

        const hintFn = LOCKED_HINTS[gameType as GameType];
        if (!hintFn) return `Ainda não liberado. Joga mais pra desbloquear.`;

        if (condition.requiresPlays) {
            const { game, count } = condition.requiresPlays;
            const done = playsByGame[game] || 0;
            const left = Math.max(0, count - done);
            return hintFn(left);
        }

        return `Ainda não liberado. Joga mais pra desbloquear.`;
    }

    public getBarLockedHint(): string {
        return `Esse bar tem jogos exclusivos. Começa pelo Bingo pra abrir o resto.`;
    }

    public getArcadeLockedHint(): string {
        return `Aguarde um momento, as máquinas estão sendo ligadas.`;
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

    public startCooldown(id: string, type: CooldownType): void {
        const durations: Record<CooldownType, number> = {
            street_npc: 30, bar: 0, slots: 0, blackjack: 0, poker: 0,
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

    public localizeGameName(type: GameType): string {
        const names: Record<GameType, string> = {
            arcade: 'Fliperama', horse_racing: 'Corrida de Cavalo', dog_racing: 'Corrida de Galgos', video_bingo: 'Vídeo Bingo',
            dados: 'Dados', ronda: 'Ronda', domino: 'Dominó', ludo: 'Ludo', damas: 'Damas', resta_um: 'Resta Um',
            cara_coroa: 'Cara ou Coroa', jokenpo: 'Jokenpô',
            purrinha: 'Purrinha', palitinho: 'Palitinho', fan_tan: 'Fan Tan',
            casino_station: 'Cassino da Estação', bicho: 'Jogo do Bicho',
            blackjack: 'Blackjack', poker: 'Poker',
            slots: 'Caça-Níquel', bar_games: 'Jogos de Bar',
            arcade_pong: 'Air Pong', arcade_faroeste: 'Faroeste',
            arcade_risca: 'Risca Faca', arcade_tank: 'Tank Attack',
            arcade_pinball: 'Sunset Paradise', arcade_valorium: "Valorium Titan's Fury",
            arcade_sinuca: 'Sinuca', arcade_botao: 'Futebol de Botão'
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
