import { BichoManager } from '../BichoManager';
/**
 * DominoGame Logic — Classic 3-player gambling style.
 * 
 * Rules:
 * 1. 28 pieces (0-0 to 6-6).
 * 2. 3 Players (1 Human, 2 NPCs).
 * 3. Each player starts with 7 pieces (remaining 7 are in the "pool").
 * 4. Random player starts.
 * 5. Players must match one end of the board.
 * 6. If no pieces match, player draws from pool (if pool not empty) or passes.
 * 7. Winner is the first to empty their hand.
 * 8. If blocked, player with fewest points (sum of dots) wins.
 */

export interface DominoPiece {
    sideA: number;
    sideB: number;
}

export interface DominoPlayer {
    name: string;
    hand: DominoPiece[];
    isHuman: boolean;
    score: number; // Total dots in hand
}

export type DominoPhase = 'betting' | 'playing' | 'result';

export class DominoGame {
    public players: DominoPlayer[] = [];
    public board: DominoPiece[] = []; // Linear sequence
    public pool: DominoPiece[] = [];
    public turnIndex: number = 0;
    public phase: DominoPhase = 'betting';
    public winner: DominoPlayer | null = null;
    public message: string = 'Faça sua aposta na mesa!';
    public betAmount: number = 10;
    public minBet: number = 10;
    public maxBet: number = 100;
    public lastMoveSuccess: boolean = true;

    constructor() {
        this.initializePlayers();
        this.updateLimits();
    }

    public updateLimits() {
        const limits = BichoManager.getInstance().getBetLimits();
        this.minBet = limits.min;
        this.maxBet = limits.max;
    }

    private initializePlayers() {
        this.players = [
            { name: 'Você', hand: [], isHuman: true, score: 0 },
            { name: 'Zeca', hand: [], isHuman: false, score: 0 },
            { name: 'Beto', hand: [], isHuman: false, score: 0 },
        ];
    }

    public startRound(bet: number) {
        this.betAmount = bet;
        this.phase = 'playing';
        this.board = [];
        this.winner = null;
        this.message = 'Sorteando quem começa...';

        // Create and shuffle pieces
        const allPieces: DominoPiece[] = [];
        for (let i = 0; i <= 6; i++) {
            for (let j = i; j <= 6; j++) {
                allPieces.push({ sideA: i, sideB: j });
            }
        }

        // Shuffle
        for (let i = allPieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPieces[i], allPieces[j]] = [allPieces[j], allPieces[i]];
        }

        // Deal 7 pieces to each player
        for (const p of this.players) {
            p.hand = allPieces.splice(0, 7);
        }

        // Remaining 7 are in the pool
        this.pool = allPieces;

        // Randomly pick who starts
        this.turnIndex = Math.floor(Math.random() * this.players.length);
        this.message = `Rodada iniciada! Vez de ${this.players[this.turnIndex].name}.`;

        // If NPC starts, trigger their move
        if (!this.players[this.turnIndex].isHuman) {
            this.triggerNPCMove();
        }
    }

    public playPiece(playerIndex: number, pieceIndex: number, side: 'left' | 'right'): boolean {
        const player = this.players[playerIndex];
        const piece = player.hand[pieceIndex];

        if (this.board.length === 0) {
            // First piece ever
            this.board.push(piece);
            player.hand.splice(pieceIndex, 1);
            this.nextTurn();
            return true;
        }

        const leftEnd = this.board[0].sideA;
        const rightEnd = this.board[this.board.length - 1].sideB;

        if (side === 'left') {
            if (piece.sideB === leftEnd) {
                this.board.unshift(piece);
            } else if (piece.sideA === leftEnd) {
                this.board.unshift({ sideA: piece.sideB, sideB: piece.sideA }); // Flip
            } else {
                return false;
            }
        } else {
            if (piece.sideA === rightEnd) {
                this.board.push(piece);
            } else if (piece.sideB === rightEnd) {
                this.board.push({ sideA: piece.sideB, sideB: piece.sideA }); // Flip
            } else {
                return false;
            }
        }

        player.hand.splice(pieceIndex, 1);
        if (player.hand.length === 0) {
            this.endGame(player);
        } else {
            this.nextTurn();
        }
        return true;
    }

    public drawFromPool(playerIndex: number) {
        if (this.pool.length > 0) {
            const piece = this.pool.pop()!;
            this.players[playerIndex].hand.push(piece);
            this.message = `${this.players[playerIndex].name} comprou uma peça.`;
        } else {
            // No pieces in pool and no valid move: player loses the match
            if (!this.hasValidMove(playerIndex)) {
                this.message = `${this.players[playerIndex].name} travou e perdeu a partida!`;
                this.resolveBlockedGame(playerIndex);
            } else {
                this.message = `${this.players[playerIndex].name} passou a vez.`;
                this.nextTurn();
            }
        }
    }

    private hasValidMove(playerIndex: number): boolean {
        const player = this.players[playerIndex];
        if (this.board.length === 0) return true;

        const leftEnd = this.board[0].sideA;
        const rightEnd = this.board[this.board.length - 1].sideB;

        return player.hand.some(p =>
            p.sideA === leftEnd || p.sideB === leftEnd ||
            p.sideA === rightEnd || p.sideB === rightEnd
        );
    }

    private resolveBlockedGame(stuckPlayerIndex: number) {
        // Find player with fewest points among the OTHERS
        let bestPlayer = this.players[(stuckPlayerIndex + 1) % this.players.length];
        let minScore = Infinity;

        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            const s = this.calculateScore(p);
            p.score = s; // Update score for display

            if (i !== stuckPlayerIndex && s < minScore) {
                minScore = s;
                bestPlayer = p;
            }
        }

        this.endGame(bestPlayer, true);
    }

    private calculateScore(player: DominoPlayer): number {
        return player.hand.reduce((sum, p) => sum + p.sideA + p.sideB, 0);
    }

    private nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.message = `Vez de ${this.players[this.turnIndex].name}.`;

        // Check for Draw/Blocked condition?
        // Simplified: check if everyone passed without the board changing
        // For now, just trigger NPC if needed
        if (!this.players[this.turnIndex].isHuman) {
            this.triggerNPCMove();
        }
    }

    private async triggerNPCMove() {
        // Short delay for realism
        setTimeout(() => {
            const player = this.players[this.turnIndex];
            const leftEnd = this.board[0]?.sideA;
            const rightEnd = this.board[this.board.length - 1]?.sideB;

            let moved = false;
            if (this.board.length === 0) {
                // First piece
                this.playPiece(this.turnIndex, 0, 'right');
                moved = true;
            } else {
                // Find a matching piece
                for (let i = 0; i < player.hand.length; i++) {
                    const p = player.hand[i];
                    if (p.sideA === leftEnd || p.sideB === leftEnd) {
                        this.playPiece(this.turnIndex, i, 'left');
                        moved = true;
                        break;
                    } else if (p.sideA === rightEnd || p.sideB === rightEnd) {
                        this.playPiece(this.turnIndex, i, 'right');
                        moved = true;
                        break;
                    }
                }
            }

            if (!moved) {
                if (this.pool.length > 0) {
                    this.drawFromPool(this.turnIndex);
                    // After drawing, try to move again
                    this.triggerNPCMove();
                } else {
                    // Check if actually blocked or just passing
                    if (!this.hasValidMove(this.turnIndex)) {
                        this.drawFromPool(this.turnIndex); // This will trigger resolveBlockedGame
                    } else {
                        this.nextTurn();
                    }
                }
            }
        }, 1200);
    }

    private endGame(winner: DominoPlayer, blocked: boolean = false) {
        this.winner = winner;
        this.phase = 'result';

        // Update all scores for final display
        for (const p of this.players) {
            p.score = this.calculateScore(p);
        }

        if (blocked) {
            if (winner.isHuman) {
                this.message = `JOGO FECHADO! Você ganhou nos pontos (${winner.score})!`;
            } else {
                this.message = `FECHOU! ${winner.name} ganhou nos pontos (${winner.score}).`;
            }
        } else {
            if (winner.isHuman) {
                this.message = `VOCÊ GANHOU! Limpou a mão!`;
            } else {
                this.message = `${winner.name} venceu a partida.`;
            }
        }
    }

    public reset() {
        this.phase = 'betting';
        this.message = 'Faça sua aposta na mesa!';
        this.board = [];
        this.pool = [];
        this.winner = null;
        this.updateLimits();
    }
}
