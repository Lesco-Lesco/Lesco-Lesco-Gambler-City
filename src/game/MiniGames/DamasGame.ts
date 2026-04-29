import { EconomyManager } from '../Core/EconomyManager';
import { BuffManager } from '../Core/BuffManager';
import type { IMinigame } from './BaseMinigame';

/**
 * DamasGame — Brazilian Checkers (Jogo de Damas) 1v1
 *
 * Rules (Brazilian Standard):
 * - 8x8 board. Pieces start on dark squares.
 * - Human plays white (bottom), NPC plays black (top).
 * - Simple men move diagonally forward one square.
 * - Kings (damadas) move diagonally any distance in any direction.
 * - Capture is mandatory when available.
 * - Multiple jumps in a single turn if available.
 * - Win: opponent has no pieces or can't move.
 */

export type DamasPhase = 'betting' | 'playing' | 'result';

export type DamasPiece = {
    owner: 0 | 1; // 0 = human (white), 1 = NPC (black)
    isKing: boolean;
};

export type DamasCell = DamasPiece | null;

export class DamasGame implements IMinigame {
    public phase: DamasPhase = 'betting';
    public board: DamasCell[][] = [];
    public turnIndex: 0 | 1 = 0; // 0 = human, 1 = NPC
    public winner: (0 | 1) | null = null;
    public message: string = 'Faça sua aposta!';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;

    // Selection state
    public selectedCell: [number, number] | null = null;
    public validMoves: [number, number, [number,number][]][] = []; // [toRow, toCol, capturedCells]
    public forcedCapture: boolean = false;
    public multiJumpFrom: [number, number] | null = null; // Mid-capture chain

    // NPC
    public npcThinkTimer: number = 0;

    constructor() {
        this.updateLimits();
    }

    public updateLimits(isPeriphery: boolean = false) {
        const limits = isPeriphery
            ? EconomyManager.getInstance().getPeripheryBetLimits()
            : EconomyManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
        this.betAmount = this.minBet;
    }

    public startRound(bet: number) {
        this.betAmount = bet;
        this.phase = 'playing';
        this.winner = null;
        this.selectedCell = null;
        this.validMoves = [];
        this.forcedCapture = false;
        this.multiJumpFrom = null;
        this.npcThinkTimer = 0;
        this.turnIndex = 0;
        this.initBoard();
        this.message = 'Sua vez! Clique ou pressione uma peça branca.';
        this.computeValidMoves();
    }

    private initBoard() {
        this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
        // Black pieces (NPC) on rows 0, 1, 2 (dark squares)
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) {
                    this.board[r][c] = { owner: 1, isKing: false };
                }
            }
        }
        // White pieces (Human) on rows 5, 6, 7 (dark squares)
        for (let r = 5; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) {
                    this.board[r][c] = { owner: 0, isKing: false };
                }
            }
        }
    }

    /** Compute all valid moves for current player. Sets forcedCapture. */
    public computeValidMoves(forPlayer?: 0 | 1) {
        const player = forPlayer ?? this.turnIndex;
        const allMoves = this.getAllMovesForPlayer(player);
        const captures = allMoves.filter(m => m[2].length > 0);
        this.forcedCapture = captures.length > 0;
        this.validMoves = this.forcedCapture ? captures : allMoves;
    }

    public getAllMovesForPlayer(player: 0 | 1): [number, number, [number, number][]][] {
        const moves: [number, number, [number, number][]][] = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece || piece.owner !== player) continue;
                const pieceMoves = this.getMovesForPiece(r, c, piece);
                for (const m of pieceMoves) moves.push(m);
            }
        }
        return moves;
    }

    public getMovesForPieceAt(r: number, c: number): [number, number, [number, number][]][] {
        const piece = this.board[r][c];
        if (!piece || piece.owner !== this.turnIndex) return [];
        return this.getMovesForPiece(r, c, piece);
    }

    private getMovesForPiece(r: number, c: number, piece: DamasPiece): [number, number, [number, number][]][] {
        if (piece.isKing) {
            return this.getKingMoves(r, c, piece.owner);
        }
        return this.getManMoves(r, c, piece.owner);
    }

    private getManMoves(r: number, c: number, owner: 0 | 1): [number, number, [number, number][]][] {
        const moves: [number, number, [number, number][]][] = [];
        const fwd = owner === 0 ? -1 : 1; // Human moves up (row decreases), NPC moves down

        // Simple moves (forward diagonals)
        for (const dc of [-1, 1]) {
            const nr = r + fwd;
            const nc = c + dc;
            if (this.inBounds(nr, nc) && !this.board[nr][nc]) {
                moves.push([nr, nc, []]);
            }
        }

        // Capture moves (all directions)
        for (const dr of [-1, 1]) {
            for (const dc of [-1, 1]) {
                const mr = r + dr;
                const mc = c + dc;
                const lr = r + 2 * dr;
                const lc = c + 2 * dc;
                if (this.inBounds(lr, lc)) {
                    const mid = this.board[mr]?.[mc];
                    if (mid && mid.owner !== owner && !this.board[lr][lc]) {
                        moves.push([lr, lc, [[mr, mc]]]);
                    }
                }
            }
        }
        return moves;
    }

    private getKingMoves(r: number, c: number, owner: 0 | 1): [number, number, [number, number][]][] {
        const moves: [number, number, [number, number][]][] = [];

        for (const dr of [-1, 1]) {
            for (const dc of [-1, 1]) {
                let dist = 1;
                let captured: [number, number] | null = null;

                while (true) {
                    const nr = r + dr * dist;
                    const nc = c + dc * dist;
                    if (!this.inBounds(nr, nc)) break;

                    const cell = this.board[nr][nc];
                    if (!cell) {
                        if (captured) {
                            moves.push([nr, nc, [captured]]);
                        } else {
                            moves.push([nr, nc, []]);
                        }
                        dist++;
                    } else if (cell.owner !== owner && !captured) {
                        // Can jump over this piece
                        captured = [nr, nc];
                        dist++;
                    } else {
                        break;
                    }
                }
            }
        }
        return moves;
    }

    private inBounds(r: number, c: number): boolean {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    public selectCell(r: number, c: number): boolean {
        if (this.phase !== 'playing' || this.turnIndex !== 0) return false;

        const piece = this.board[r][c];

        // If multi-jump is in progress, only allow moving the same piece
        if (this.multiJumpFrom) {
            const [fr, fc] = this.multiJumpFrom;
            if (r !== fr || c !== fc) {
                // Try to apply move to the selected destination
                const dest = this.validMoves.find(m => m[0] === r && m[1] === c);
                if (dest) {
                    this.applyMove(fr, fc, r, c, dest[2]);
                    return true;
                }
                return false;
            }
            return false;
        }

        // Select a piece
        if (piece && piece.owner === 0) {
            const moves = this.getMovesForPieceAt(r, c);
            const relevantMoves = this.forcedCapture ? moves.filter(m => m[2].length > 0) : moves;
            if (relevantMoves.length > 0) {
                this.selectedCell = [r, c];
                this.validMoves = relevantMoves;
                return true;
            }
        }

        // Try to move if piece is already selected
        if (this.selectedCell) {
            const [sr, sc] = this.selectedCell;
            const dest = this.validMoves.find(m => m[0] === r && m[1] === c);
            if (dest) {
                this.applyMove(sr, sc, r, c, dest[2]);
                return true;
            }
            // Deselect
            this.selectedCell = null;
            this.validMoves = [];
        }

        return false;
    }

    public applyMove(fr: number, fc: number, tr: number, tc: number, captured: [number, number][]) {
        const piece = this.board[fr][fc]!;
        this.board[tr][tc] = piece;
        this.board[fr][fc] = null;

        // Remove captured pieces
        for (const [cr, cc] of captured) {
            this.board[cr][cc] = null;
        }

        // King promotion
        if (!piece.isKing) {
            if (piece.owner === 0 && tr === 0) piece.isKing = true;
            if (piece.owner === 1 && tr === 7) piece.isKing = true;
        }

        // Check for multi-jump
        if (captured.length > 0) {
            const additionalCaptures = this.getMovesForPiece(tr, tc, piece).filter(m => m[2].length > 0);
            if (additionalCaptures.length > 0 && this.turnIndex === 0) {
                // Human multi-jump
                this.multiJumpFrom = [tr, tc];
                this.selectedCell = [tr, tc];
                this.validMoves = additionalCaptures;
                this.message = 'Captura múltipla! Continue capturando.';
                return;
            } else if (captured.length > 0 && this.turnIndex === 1) {
                // NPC multi-jump handled in NPC logic
            }
        }

        this.selectedCell = null;
        this.multiJumpFrom = null;

        // Check win condition
        const opponentIndex = (1 - this.turnIndex) as 0 | 1;
        if (!this.hasAnyMoves(opponentIndex)) {
            this.endGame(this.turnIndex);
            return;
        }

        this.turnIndex = opponentIndex;
        this.computeValidMoves();

        if (!this.players || this.turnIndex === 1) {
            this.message = `Vez do adversário...`;
            this.npcThinkTimer = 0.9;
        } else {
            this.message = 'Sua vez!';
        }
    }

    // Dummy players property for compatibility (actual logic uses owner 0/1)
    public get players() { return [{ isHuman: true, name: 'Você' }, { isHuman: false, name: 'Adversário' }]; }

    private hasAnyMoves(player: 0 | 1): boolean {
        return this.getAllMovesForPlayer(player).length > 0;
    }

    public countPieces(player: 0 | 1): number {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c]?.owner === player) count++;
            }
        }
        return count;
    }

    private endGame(winner: 0 | 1) {
        this.winner = winner;
        this.phase = 'result';
        this.message = winner === 0 ? 'VOCÊ GANHOU! As damas foram suas!' : 'Adversário ganhou. Próxima você vira!';
    }

    /** Check if a square can be captured by an opponent piece next turn */
    private isSquareUnderAttack(r: number, c: number, attackerIndex: 0 | 1): boolean {
        // A square (r,c) is under attack if an attacker piece is in a diagonal
        // AND the square behind (r,c) is empty.
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of directions) {
            const ar = r + dr; // Attacker Row
            const ac = c + dc; // Attacker Col
            const br = r - dr; // Behind Row
            const bc = c - dc; // Behind Col

            if (this.inBounds(ar, ac) && this.inBounds(br, bc)) {
                const attacker = this.board[ar][ac];
                const behind = this.board[br][bc];
                if (attacker && attacker.owner === attackerIndex && !behind) {
                    // Check if attacker is a regular piece moving in the right direction or a King
                    if (attacker.isKing) return true;
                    if (attackerIndex === 0 && dr === 1) return true; // Human moves up (dr=1 relative to NPC)
                    if (attackerIndex === 1 && dr === -1) return true; // NPC moves down (dr=-1 relative to Human)
                }
            }
        }
        return false;
    }

    public updateNPC(dt: number) {
        if (this.phase !== 'playing' || this.turnIndex !== 1) return;
        if (this.npcThinkTimer <= 0) return;

        this.npcThinkTimer -= dt;
        if (this.npcThinkTimer > 0) return;

        this.executeNPCMove();
    }

    private executeNPCMove() {
        let moves = this.getAllMovesForPlayer(1);
        const captures = moves.filter(m => m[2].length > 0);
        if (captures.length > 0) moves = captures;

        if (moves.length === 0) {
            this.endGame(0);
            return;
        }

        // Score moves: prefer captures, then central control, then safety
        const scoreMove = (fr: number, fc: number, tr: number, tc: number, caps: [number, number][]) => {
            let s = caps.length * 200; // Captures are high priority
            
            // Strategic positioning
            s += (3.5 - Math.abs(tc - 3.5)) * 10; // Prefer center columns
            s += tr * 5; // NPC wants to advance downward
            
            // King promotion is huge
            if (!this.board[fr][fc]?.isKing && tr === 7) s += 500;
            
            // Safety Check: Avoid moving into a spot where we can be captured
            const diffFactor = EconomyManager.getInstance().getDifficultyFactor();
            if (this.isSquareUnderAttack(tr, tc, 0)) {
                s -= (200 * diffFactor); // Significant penalty for "suicide" moves
            }

            // King Safety: Kings are valuable, don't lose them
            if (this.board[fr][fc]?.isKing && this.isSquareUnderAttack(tr, tc, 0)) {
                s -= 500;
            }

            // Randomness factor (decreases as difficulty increases)
            const luck = BuffManager.getInstance().getLuckBonus();
            const randomRange = Math.max(0, 50 - (diffFactor - 1.0) * 100);
            s += (Math.random() - 0.5) * randomRange * (1.0 + luck);

            return s;
        };

        // Find piece for each move
        let bestMove: { fr: number; fc: number; tr: number; tc: number; caps: [number, number][] } | null = null;
        let bestScore = -Infinity;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece || piece.owner !== 1) continue;
                const pieceMoves = this.getMovesForPiece(r, c, piece);
                const relevant = captures.length > 0 ? pieceMoves.filter(m => m[2].length > 0) : pieceMoves;
                for (const [tr, tc, caps] of relevant) {
                    const s = scoreMove(r, c, tr, tc, caps);
                    if (s > bestScore) {
                        bestScore = s;
                        bestMove = { fr: r, fc: c, tr, tc, caps };
                    }
                }
            }
        }

        if (!bestMove) {
            this.endGame(0);
            return;
        }

        this.applyMove(bestMove.fr, bestMove.fc, bestMove.tr, bestMove.tc, bestMove.caps);

        // Multi-jump for NPC
        if (this.turnIndex === 1) {
            this.npcThinkTimer = 0.8;
        }
    }

    public settle(): number {
        if (this.winner === null) return 0;
        return this.winner === 0 ? this.betAmount * 2 : -this.betAmount;
    }

    public reset() {
        this.phase = 'betting';
        this.message = 'Faça sua aposta!';
        this.winner = null;
        this.selectedCell = null;
        this.validMoves = [];
        this.forcedCapture = false;
        this.multiJumpFrom = null;
        this.npcThinkTimer = 0;
        this.turnIndex = 0;
        this.updateLimits();
    }
}
