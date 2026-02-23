import { DominoGame } from './DominoGame';
import type { DominoPiece } from './DominoGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { UIScale } from '../Core/UIScale';

export class DominoUI {
    private game: DominoGame;
    private selectedPieceIndex: number = 0;
    private selectedSide: 'left' | 'right' = 'right';
    private hasSettled: boolean = false;

    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: DominoGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            this.hasSettled = false;
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.game.betAmount = Math.min(this.game.maxBet, this.game.betAmount + 10);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.game.betAmount = Math.max(this.game.minBet, this.game.betAmount - 10);
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startRound(this.game.betAmount);
                }
            }
        } else if (this.game.phase === 'playing') {
            const humanIndex = 0; // "Você"
            const player = this.game.players[humanIndex];

            if (this.game.turnIndex === humanIndex) {
                // Hand navigation
                if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                    this.selectedPieceIndex = (this.selectedPieceIndex - 1 + player.hand.length) % player.hand.length;
                }
                if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                    this.selectedPieceIndex = (this.selectedPieceIndex + 1) % player.hand.length;
                }
                if (input.wasPressed('ShiftLeft') || input.wasPressed('KeyQ')) {
                    this.selectedSide = this.selectedSide === 'left' ? 'right' : 'left';
                }

                // Play piece
                if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                    if (player.hand.length > 0) {
                        const success = this.game.playPiece(humanIndex, this.selectedPieceIndex, this.selectedSide);
                        if (success) {
                            this.selectedPieceIndex = 0;
                        }
                    }
                }

                // Draw from pool
                if (input.wasPressed('KeyC')) {
                    this.game.drawFromPool(humanIndex);
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                if (this.game.winner?.isHuman) {
                    bmanager.playerMoney += this.game.betAmount * 3; // 3 players pool
                }
                this.hasSettled = true;
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                const win = this.game.winner?.isHuman ? this.game.betAmount * 3 : 0;
                this.onPlayAgain(win);
                this.game.reset();
            } else if (input.wasPressed('Escape') || input.wasPressed('KeyE')) {
                const win = this.game.winner?.isHuman ? this.game.betAmount * 3 : 0;
                this.onClose(win);
            }
        }
    }

    public draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);
        const cx = width / 2;

        // Wood Table Background
        const grad = ctx.createRadialGradient(cx, height / 2, s(100), cx, height / 2, height);
        grad.addColorStop(0, '#3d2b1f');
        grad.addColorStop(1, '#1a0f0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Wood Grain Texture
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = s(2);
        for (let i = 0; i < height; i += s(40)) {
            ctx.beginPath();
            ctx.moveTo(0, i + Math.sin(i * 0.1) * s(20));
            ctx.bezierCurveTo(width / 3, i - s(10), width * 0.6, i + s(30), width, i);
            ctx.stroke();
        }
        ctx.restore();

        // Title
        ctx.shadowBlur = s(10);
        ctx.shadowColor = '#44ff44';
        ctx.fillStyle = '#44ff44';
        ctx.font = `bold ${UIScale.r(36)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("DOMINÓ DE PRAÇA", cx, s(60));
        ctx.shadowBlur = 0;

        // Board Area
        this.drawBoard(ctx, cx, s(300), width);

        // Pool Info
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = `${UIScale.r(14)}px monospace`;
        ctx.fillText(`CESTO: ${this.game.pool.length} PEÇAS`, cx, s(460));

        // Status Message
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${UIScale.r(22)}px "Segoe UI", sans-serif`;
        ctx.fillText(this.game.message.toUpperCase(), cx, height - s(240));

        // Player Hands
        this.drawPlayerHands(ctx, cx, height - s(100));

        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, height / 2);
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(20)}px "Segoe UI", sans-serif`;
            ctx.fillText("[ESPAÇO] JOGAR NOVAMENTE   [ESC] SAIR", cx, height - s(50));
        }
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, _screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const pieceW = s(40);
        const pieceH = s(80);
        const spacing = s(5);

        // Linear board for simplicity
        const totalW = this.game.board.length * (pieceW + spacing);
        let startX = cx - totalW / 2;

        // Pool container visual
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, cy - s(100), ctx.canvas.width, s(200));

        this.game.board.forEach((piece, i) => {
            this.drawPiece(ctx, startX + i * (pieceW + spacing), cy, piece, false, pieceW, pieceH);
        });

        if (this.game.board.length === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.setLineDash([s(5), s(5)]);
            ctx.lineWidth = s(2);
            ctx.strokeRect(cx - s(20), cy - s(40), s(40), s(80));
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = `italic ${UIScale.r(14)}px "Segoe UI"`;
            ctx.fillText("MESA VAZIA", cx, cy);
        }
    }

    private drawPlayerHands(ctx: CanvasRenderingContext2D, cx: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        // Human hand
        const human = this.game.players[0];
        const pieceW = s(40);
        const pieceH = s(80);
        const spacing = s(12);
        const totalW = human.hand.length * (pieceW + spacing);
        let startX = cx - totalW / 2;

        human.hand.forEach((piece, i) => {
            const isSelected = this.game.phase === 'playing' && this.game.turnIndex === 0 && this.selectedPieceIndex === i;
            // Lift selected piece
            const lift = isSelected ? s(20) : 0;
            this.drawPiece(ctx, startX + i * (pieceW + spacing), y - lift, piece, isSelected, pieceW, pieceH);
        });

        // NPC counters
        ctx.fillStyle = '#aaa';
        ctx.font = `600 ${UIScale.r(14)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${this.game.players[1].name}`, s(50), y - s(40));
        ctx.font = `bold ${UIScale.r(32)}px "Segoe UI"`;
        ctx.fillText(`${this.game.players[1].hand.length}`, s(50), y);

        ctx.textAlign = 'right';
        ctx.font = `600 ${UIScale.r(14)}px "Segoe UI", sans-serif`;
        ctx.fillText(`${this.game.players[2].name}`, cx * 2 - s(50), y - s(40));
        ctx.font = `bold ${UIScale.r(32)}px "Segoe UI"`;
        ctx.fillText(`${this.game.players[2].hand.length}`, cx * 2 - s(50), y);

        if (this.game.phase === 'playing' && this.game.turnIndex === 0) {
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(16)}px monospace`;
            ctx.textAlign = 'center';
            const sideText = this.selectedSide === 'left' ? '◀ ESQUERDA' : 'DIREITA ▶';
            ctx.fillText(`LADO: ${sideText} [SHIFT]`, cx, y - s(130));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = `${UIScale.r(12)}px monospace`;
            ctx.fillText("[C] COMPRAR   [ESPAÇO] JOGAR", cx, y - s(110));
        }
    }

    private drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, piece: DominoPiece, selected: boolean, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.translate(x, y);

        // Simple Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = selected ? s(15) : s(5);
        ctx.shadowOffsetY = s(2);

        // Clean White Body
        ctx.fillStyle = selected ? '#fff' : '#f0f0f0';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, s(2));
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = s(1.5);
        ctx.stroke();

        // High Contrast Divider
        ctx.beginPath();
        ctx.moveTo(-w / 2 + s(2), 0);
        ctx.lineTo(w / 2 - s(2), 0);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = s(1);
        ctx.stroke();

        // High Contrast Dots (Pure Black)
        ctx.fillStyle = '#000';
        this.drawDots(ctx, piece.sideA, -h / 4, w);
        this.drawDots(ctx, piece.sideB, h / 4, w);

        ctx.restore();
    }

    private drawDots(ctx: CanvasRenderingContext2D, count: number, y: number, w: number) {
        const r = w * 0.08;
        const q = w / 4;

        if (count === 1 || count === 3 || count === 5) this.drawDot(ctx, 0, y, r);
        if (count >= 2) { this.drawDot(ctx, -q, y - q, r); this.drawDot(ctx, q, y + q, r); }
        if (count >= 4) { this.drawDot(ctx, q, y - q, r); this.drawDot(ctx, -q, y + q, r); }
        if (count === 6) { this.drawDot(ctx, -q, y, r); this.drawDot(ctx, q, y, r); }
    }

    private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = `300 ${UIScale.r(24)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("QUANTO VALE O JOGO?", cx, cy - s(60));

        ctx.fillStyle = '#ffff00';
        ctx.font = `bold ${UIScale.r(80)}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = 'rgba(255, 255, 0, 0.4)';
        ctx.fillText(`R$ ${this.game.betAmount}`, cx, cy + s(20));
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#aaa';
        ctx.font = `${UIScale.r(14)}px "Segoe UI", sans-serif`;
        ctx.fillText("[W/S] Ajustar Valor    [ESPAÇO] Confirmar", cx, cy + s(80));
    }
}
