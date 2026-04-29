import { BuffManager } from '../Core/BuffManager';
import type { IMinigame } from './BaseMinigame';

/**
 * RestaUmGame — Peg Solitaire (Resta Um)
 *
 * Rules:
 * - Classic cross-shaped or diamond board.
 * - Pieces jump over adjacent piece (horizontally or vertically) into empty hole.
 * - The jumped piece is removed.
 * - Goal: leave exactly ONE peg in the center.
 * - It's a solo puzzle, but with a betting spin:
 *   Player bets a fixed amount. The payout multiplier is based on remaining pieces:
 *     - 1 piece (perfect): 5x bet
 *     - 2 pieces: 3x bet
 *     - 3 pieces: 2x bet (break-even with 2x win)
 *     - 4+ pieces: lose
 * - NPC "challenge" doesn't apply here — it's the player vs the puzzle.
 */

export type RestaUmPhase = 'playing' | 'result';

// Board: 7x7 English Peg Solitaire (cross shape)
// -1 = outside board, 0 = empty hole, 1 = peg
const INITIAL_BOARD: number[][] = [
    [-1, -1,  1,  1,  1, -1, -1],
    [-1, -1,  1,  1,  1, -1, -1],
    [ 1,  1,  1,  1,  1,  1,  1],
    [ 1,  1,  1,  0,  1,  1,  1], // Center is empty
    [ 1,  1,  1,  1,  1,  1,  1],
    [-1, -1,  1,  1,  1, -1, -1],
    [-1, -1,  1,  1,  1, -1, -1],
];

export class RestaUmGame implements IMinigame {
    public phase: RestaUmPhase = 'playing';
    public board: number[][] = INITIAL_BOARD.map(row => [...row]);
    public betAmount: number = 0; // No bet
    public minBet: number = 0;
    public maxBet: number = 0;
    public winner: boolean = false;
    public message: string = 'Pule as peças até restar apenas uma!';
    public selectedCell: [number, number] | null = null;
    public validDests: [number, number, number, number][] = []; // [tr, tc, jumpedR, jumpedC]
    public remainingPegs: number = 32;
    public score: number = 0;
    public moveCount: number = 0;

    constructor() {
        this.reset();
    }

    public updateLimits(_isPeriphery: boolean = false) {
        // No limits needed for arcade style
    }

    public startRound() {
        this.phase = 'playing';
        this.winner = false;
        this.selectedCell = null;
        this.validDests = [];
        this.moveCount = 0;
        this.score = 0;
        this.message = 'Selecione uma peça para pular!';
        this.board = INITIAL_BOARD.map(row => [...row]);
        this.remainingPegs = this.countPegs();
    }

    public countPegs(): number {
        let count = 0;
        for (const row of this.board) {
            for (const cell of row) {
                if (cell === 1) count++;
            }
        }
        return count;
    }

    public selectCell(r: number, c: number): boolean {
        if (this.phase !== 'playing') return false;

        const cell = this.board[r]?.[c];

        // If already selected, try to move
        if (this.selectedCell) {
            const [sr, sc] = this.selectedCell;
            if (sr === r && sc === c) {
                // Deselect
                this.selectedCell = null;
                this.validDests = [];
                return true;
            }

            // Try destination
            const dest = this.validDests.find(d => d[0] === r && d[1] === c);
            if (dest) {
                this.applyMove(sr, sc, dest[0], dest[1], dest[2], dest[3]);
                return true;
            }
        }

        // Select a peg
        if (cell === 1) {
            const moves = this.getMovesForPeg(r, c);
            if (moves.length > 0) {
                this.selectedCell = [r, c];
                this.validDests = moves;
                return true;
            }
        }

        this.selectedCell = null;
        this.validDests = [];
        return false;
    }

    public getMovesForPeg(r: number, c: number): [number, number, number, number][] {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const moves: [number, number, number, number][] = [];

        for (const [dr, dc] of dirs) {
            const mr = r + dr;
            const mc = c + dc;
            const lr = r + 2 * dr;
            const lc = c + 2 * dc;

            if (
                lr >= 0 && lr < 7 && lc >= 0 && lc < 7 &&
                this.board[mr]?.[mc] === 1 &&
                this.board[lr]?.[lc] === 0
            ) {
                moves.push([lr, lc, mr, mc]);
            }
        }

        return moves;
    }

    public hasAnyMoves(): boolean {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (this.board[r][c] === 1 && this.getMovesForPeg(r, c).length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    private applyMove(fr: number, fc: number, tr: number, tc: number, jr: number, jc: number) {
        this.board[fr][fc] = 0;
        this.board[jr][jc] = 0;
        this.board[tr][tc] = 1;
        this.moveCount++;

        this.selectedCell = null;
        this.validDests = [];
        this.remainingPegs = this.countPegs();

        // Check end condition
        if (!this.hasAnyMoves()) {
            this.endGame();
        } else {
            this.message = `${this.remainingPegs} peças restantes. Continue!`;
        }
    }

    private endGame() {
        this.phase = 'result';
        this.remainingPegs = this.countPegs();

        // Apply luck bonus chance for perfect finish
        const luck = BuffManager.getInstance().getLuckBonus();
        if (this.remainingPegs === 2 && luck > 0 && Math.random() < luck * 0.3) {
            this.remainingPegs = 1;
        }

        // Scoring: Perfect 1000, 2: 500, 3: 250, 4: 100, 5+: linear
        if (this.remainingPegs === 1) {
            this.winner = true;
            this.score = 1000;
            this.message = `PERFEITO! 1 peça! PONTUAÇÃO MÁXIMA!`;
        } else if (this.remainingPegs === 2) {
            this.winner = true;
            this.score = 500;
            this.message = `ÓTIMO! 2 peças! PONTUAÇÃO: ${this.score}`;
        } else if (this.remainingPegs === 3) {
            this.winner = true;
            this.score = 250;
            this.message = `BOM! 3 peças. PONTUAÇÃO: ${this.score}`;
        } else if (this.remainingPegs === 4) {
            this.winner = true;
            this.score = 100;
            this.message = `RAZOÁVEL! 4 peças. PONTUAÇÃO: ${this.score}`;
        } else {
            this.winner = false;
            // Linear score for others: 32 pegs -> 0 pts, 5 pegs -> 50 pts
            this.score = Math.max(0, (32 - this.remainingPegs) * 2);
            this.message = `${this.remainingPegs} peças restantes. PONTUAÇÃO: ${this.score}`;
        }
    }

    /** For compatibility with handleMinigameExit */
    public get players() {
        return [{ isHuman: true, name: 'Você' }];
    }

    public settle(): number {
        return 0; // No money change
    }

    public reset() {
        this.phase = 'playing';
        this.message = 'Pule as peças até restar apenas uma!';
        this.winner = false;
        this.selectedCell = null;
        this.validDests = [];
        this.remainingPegs = 32;
        this.score = 0;
        this.moveCount = 0;
        this.board = INITIAL_BOARD.map(row => [...row]);
    }
}
