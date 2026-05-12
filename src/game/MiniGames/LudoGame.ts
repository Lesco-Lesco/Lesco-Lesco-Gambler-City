import { EconomyManager } from '../Core/EconomyManager';
import { BuffManager } from '../Core/BuffManager';
import type { IMinigame } from './BaseMinigame';

/**
 * LudoGame — Ludo Simplificado (2 players: Human vs NPC)
 *
 * Rules (Simplified):
 * - 2 players, each has 2 pawns (instead of 4)
 * - Board: linear track of 40 squares + 6 home stretch squares per player
 * - Player 0 (Human) starts at 0, goes clockwise
 * - Player 1 (NPC) starts at 20, goes clockwise
 * - Roll dice (1-6) each turn. Must roll 6 to bring a pawn out of base.
 * - Move chosen pawn. Landing on opponent's pawn sends it back to base.
 * - First player to bring all their pawns home wins.
 */

export type LudoPhase = 'betting' | 'playing' | 'result';

export interface LudoPawn {
    pos: number;      // -1 = in base, 0-39 = on track, 40-45 = on home stretch
    isHome: boolean;  // finished
}

export interface LudoPlayer {
    name: string;
    isHuman: boolean;
    pawns: LudoPawn[];
    color: string;
    startOffset: number; // absolute start position on track
}

const TRACK_SIZE = 40;
const HOME_STRETCH_SIZE = 6;
const PAWNS_PER_PLAYER = 2;

export class LudoGame implements IMinigame {
    public isPeriphery: boolean = false;
    public phase: LudoPhase = 'betting';
    public players: LudoPlayer[] = [];
    public turnIndex: number = 0;
    public diceValue: number = 0;
    public hasRolled: boolean = false;
    public winner: LudoPlayer | null = null;
    public message: string = 'Faça sua aposta!';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;
    public selectedPawnIndex: number = 0;
    public npcMoveTimer: number = 0;

    constructor() {
        this.initPlayers();
        this.updateLimits(this.isPeriphery);
    }

    public updateLimits(isPeriphery: boolean = false) {
        this.isPeriphery = isPeriphery;
        const limits = isPeriphery
            ? EconomyManager.getInstance().getPeripheryBetLimits()
            : EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        this.betAmount = this.minBet;
    }

    private initPlayers() {
        this.players = [
            {
                name: 'Você',
                isHuman: true,
                color: '#e74c3c',
                startOffset: 0,
                pawns: Array.from({ length: PAWNS_PER_PLAYER }, () => ({ pos: -1, isHome: false })),
            },
            {
                name: 'Malandro',
                isHuman: false,
                color: '#2980b9',
                startOffset: 20,
                pawns: Array.from({ length: PAWNS_PER_PLAYER }, () => ({ pos: -1, isHome: false })),
            },
        ];
    }

    public startRound(bet: number) {
        this.betAmount = bet;
        this.phase = 'playing';
        this.winner = null;
        this.hasRolled = false;
        this.diceValue = 0;
        this.turnIndex = 0;
        this.selectedPawnIndex = 0;
        this.npcMoveTimer = 0;

        // Random NPC name
        const npcNames = ['Zeca', 'Beto', 'Tião', 'Dudu', 'Jão', 'Chico'];
        this.players[1].name = npcNames[Math.floor(Math.random() * npcNames.length)];

        // Reset all pawns
        for (const p of this.players) {
            for (const pawn of p.pawns) {
                pawn.pos = -1;
                pawn.isHome = false;
            }
        }

        this.message = 'Sua vez! Jogue os dados.';
    }

    public rollDice() {
        if (this.hasRolled || this.phase !== 'playing') return;
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        this.hasRolled = true;

        const player = this.players[this.turnIndex];
        const movable = this.getMovablePawns(this.turnIndex, this.diceValue);

        if (movable.length === 0) {
            this.message = `${player.name} tirou ${this.diceValue} mas não pode mover. Passou!`;
            setTimeout(() => this.nextTurn(), 900);
        } else {
            this.message = `${player.name} tirou ${this.diceValue}! Escolha uma peça.`;
            // Auto-select first movable
            this.selectedPawnIndex = movable[0];
        }
    }

    public getMovablePawns(playerIndex: number, dice: number): number[] {
        const player = this.players[playerIndex];
        const movable: number[] = [];

        for (let i = 0; i < player.pawns.length; i++) {
            const pawn = player.pawns[i];
            if (pawn.isHome) continue;

            if (pawn.pos === -1) {
                // Can only exit base with a 6
                if (dice === 6) movable.push(i);
            } else {
                // Can move if new position doesn't overflow beyond home
                const relative = this.getRelativePos(playerIndex, pawn.pos);
                const newRelative = relative + dice;
                if (newRelative <= TRACK_SIZE + HOME_STRETCH_SIZE - 1) {
                    movable.push(i);
                }
            }
        }

        return movable;
    }

    /** Convert absolute track position to relative (from player's start) */
    private getRelativePos(playerIndex: number, absPos: number): number {
        const offset = this.players[playerIndex].startOffset;
        if (absPos >= TRACK_SIZE) {
            // Home stretch: relative positions 40+
            return absPos;
        }
        return ((absPos - offset) + TRACK_SIZE) % TRACK_SIZE;
    }

    /** Convert relative position to absolute track position */
    private relativeToAbsolute(playerIndex: number, relativePos: number): number {
        if (relativePos >= TRACK_SIZE) return relativePos; // Home stretch stays absolute
        const offset = this.players[playerIndex].startOffset;
        return (relativePos + offset) % TRACK_SIZE;
    }

    public movePawn(playerIndex: number, pawnIndex: number) {
        if (!this.hasRolled) return;

        const player = this.players[playerIndex];
        const pawn = player.pawns[pawnIndex];
        const movable = this.getMovablePawns(playerIndex, this.diceValue);

        if (!movable.includes(pawnIndex)) return;

        if (pawn.pos === -1) {
            // Exit base — go to startOffset on track
            pawn.pos = this.players[playerIndex].startOffset;
        } else {
            const relative = this.getRelativePos(playerIndex, pawn.pos);
            const newRelative = relative + this.diceValue;

            if (newRelative >= TRACK_SIZE) {
                // Entering home stretch
                const homeStretchPos = newRelative; // 40, 41, ..., 45
                pawn.pos = homeStretchPos;
                if (homeStretchPos >= TRACK_SIZE + HOME_STRETCH_SIZE - 1) {
                    pawn.pos = TRACK_SIZE + HOME_STRETCH_SIZE - 1;
                    pawn.isHome = true;
                }
            } else {
                pawn.pos = this.relativeToAbsolute(playerIndex, newRelative);
            }
        }

        // Capture check (only on main track, not home stretch)
        if (!pawn.isHome && pawn.pos < TRACK_SIZE) {
            const opponentIndex = 1 - playerIndex;
            const opponent = this.players[opponentIndex];
            for (const op of opponent.pawns) {
                if (!op.isHome && op.pos === pawn.pos) {
                    // Send back to base
                    op.pos = -1;
                    this.message = `Captura! Peça de ${opponent.name} voltou para a base!`;
                }
            }
        }

        // Check win
        if (player.pawns.every(p => p.isHome)) {
            this.endGame(player);
            return;
        }

        // Rolled a 6 = extra turn
        if (this.diceValue === 6) {
            this.hasRolled = false;
            this.message = `${player.name} tirou 6! Jogue de novo.`;
        } else {
            this.nextTurn();
        }
    }

    private nextTurn() {
        this.turnIndex = 1 - this.turnIndex;
        this.hasRolled = false;
        this.diceValue = 0;
        const player = this.players[this.turnIndex];
        this.message = `Vez de ${player.name}!`;

        if (!player.isHuman) {
            this.npcMoveTimer = 1.0; // Will trigger after delay
        }
    }

    public updateNPC(dt: number) {
        if (this.phase !== 'playing') return;
        if (this.players[this.turnIndex].isHuman) return;

        if (this.npcMoveTimer > 0) {
            this.npcMoveTimer -= dt;
            if (this.npcMoveTimer <= 0) {
                this.executeNPCTurn();
            }
        }
    }

    private executeNPCTurn() {
        const playerIndex = this.turnIndex;
        this.diceValue = Math.floor(Math.random() * 6) + 1;
        this.hasRolled = true;
        this.message = `${this.players[playerIndex].name} tirou ${this.diceValue}!`;

        const movable = this.getMovablePawns(playerIndex, this.diceValue);

        if (movable.length === 0) {
            this.message = `${this.players[playerIndex].name} tirou ${this.diceValue} mas não pode mover.`;
            setTimeout(() => {
                if (this.phase === 'playing') this.nextTurn();
            }, 800);
            return;
        }

        // NPC strategy: prefer captures, then prefer pawns closest to home
        let bestPawnIndex = movable[0];
        let bestScore = -Infinity;

        for (const i of movable) {
            const pawn = this.players[playerIndex].pawns[i];
            let score = 0;

            // Simulate move
            let newPos: number;
            if (pawn.pos === -1) {
                newPos = this.players[playerIndex].startOffset;
            } else {
                const rel = this.getRelativePos(playerIndex, pawn.pos);
                const newRel = rel + this.diceValue;
                newPos = newRel >= TRACK_SIZE ? newRel : this.relativeToAbsolute(playerIndex, newRel);
            }

            // Check for capture
            const opponentIndex = 1 - playerIndex;
            for (const op of this.players[opponentIndex].pawns) {
                if (!op.isHome && op.pos === newPos && newPos < TRACK_SIZE) score += 50;
            }

            // Progress score
            if (pawn.pos >= 0) {
                score += this.getRelativePos(playerIndex, pawn.pos) + this.diceValue;
            } else {
                score += 5; // Getting out of base is good
            }

            // Luck modifier
            const luck = BuffManager.getInstance().getLuckBonus();
            if (luck > 0) score -= Math.random() * luck * 20; // Sabotage NPC slightly

            if (score > bestScore) {
                bestScore = score;
                bestPawnIndex = i;
            }
        }

        setTimeout(() => {
            if (this.phase === 'playing') {
                this.movePawn(playerIndex, bestPawnIndex);
                if (!this.players[playerIndex].isHuman && this.turnIndex === playerIndex) {
                    this.npcMoveTimer = 0.8;
                }
            }
        }, 600);
    }

    private endGame(winner: LudoPlayer) {
        this.winner = winner;
        this.phase = 'result';
        if (winner.isHuman) {
            this.message = 'VOCÊ GANHOU! Suas peças chegaram em casa!';
        } else {
            this.message = `${winner.name} ganhou! Melhor sorte na próxima.`;
        }
    }

    public settle(): number {
        if (!this.winner) return 0;
        return this.winner.isHuman ? this.betAmount * 2 : -this.betAmount;
    }

    public reset() {
        this.phase = 'betting';
        this.message = 'Faça sua aposta!';
        this.winner = null;
        this.hasRolled = false;
        this.diceValue = 0;
        this.turnIndex = 0;
        this.selectedPawnIndex = 0;
        this.npcMoveTimer = 0;
        for (const p of this.players) {
            for (const pawn of p.pawns) {
                pawn.pos = -1;
                pawn.isHome = false;
            }
        }
        this.updateLimits(this.isPeriphery);
    }
}
