import { DominoGame } from './DominoGame';
import type { DominoPiece } from './DominoGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
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
            const humanIndex = 0;
            const player = this.game.players[humanIndex];

            if (this.game.turnIndex === humanIndex) {
                if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                    this.selectedPieceIndex = (this.selectedPieceIndex - 1 + player.hand.length) % player.hand.length;
                }
                if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                    this.selectedPieceIndex = (this.selectedPieceIndex + 1) % player.hand.length;
                }
                if (input.wasPressed('ShiftLeft') || input.wasPressed('KeyQ')) {
                    this.selectedSide = this.selectedSide === 'left' ? 'right' : 'left';
                }
                if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                    if (player.hand.length > 0) {
                        const success = this.game.playPiece(humanIndex, this.selectedPieceIndex, this.selectedSide);
                        if (success) this.selectedPieceIndex = 0;
                    }
                }
                if (input.wasPressed('KeyC')) {
                    this.game.drawFromPool(humanIndex);
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                if (this.game.winner?.isHuman) {
                    BichoManager.getInstance().playerMoney += this.game.betAmount * 3;
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
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // ── Zonas de layout proporcionais ──
        // Dividimos a tela em faixas que se adaptam a qualquer tamanho.
        const TITLE_H = height * 0.10; // 10% topo → título
        const BOARD_H = height * 0.32; // 32% → mesa de peças
        const STATUS_H = height * 0.08; // 8%  → mensagem de status / pool
        const CONTROLS_H = height * 0.12; // 12% → dicas / turno
        const HAND_H = height * 0.18; // 18% → mão do jogador (rodapé)
        // Rodapé final: height * 0.20 (NPC counters + resultado)

        const titleY = TITLE_H * 0.7;
        const boardY = TITLE_H + BOARD_H * 0.5;
        const statusY = TITLE_H + BOARD_H + STATUS_H * 0.5;
        const controlsY = TITLE_H + BOARD_H + STATUS_H + CONTROLS_H * 0.5;
        const handY = height - HAND_H * 0.5 - height * 0.04;

        // ── Fundo: mesa de madeira ──
        const grad = ctx.createRadialGradient(cx, height / 2, s(80), cx, height / 2, height);
        grad.addColorStop(0, '#3d2b1f');
        grad.addColorStop(1, '#1a0f0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Veios de madeira
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = s(2);
        for (let i = 0; i < height; i += s(40)) {
            ctx.beginPath();
            ctx.moveTo(0, i + Math.sin(i * 0.1) * s(15));
            ctx.bezierCurveTo(width / 3, i - s(8), width * 0.6, i + s(20), width, i);
            ctx.stroke();
        }
        ctx.restore();

        // ── Título ──
        ctx.shadowBlur = s(10);
        ctx.shadowColor = '#44ff44';
        ctx.fillStyle = '#44ff44';
        ctx.font = `bold ${UIScale.r(mobile ? 22 : 28)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('DOMINÓ DE PRAÇA', cx, titleY);
        ctx.shadowBlur = 0;

        // ── Tabuleiro ──
        this.drawBoard(ctx, cx, boardY, width);

        // ── Pool / Status ──
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `${UIScale.r(mobile ? 11 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`CESTO: ${this.game.pool.length} PEÇAS`, cx, statusY - s(8));

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${UIScale.r(mobile ? 13 : 16)}px "Segoe UI", sans-serif`;
        ctx.fillText(this.game.message.toUpperCase(), cx, statusY + s(16));

        // ── Controles / turno ──
        if (this.game.phase === 'playing' && this.game.turnIndex === 0) {
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            const sideText = this.selectedSide === 'left' ? '◀ ESQ' : 'DIR ▶';
            ctx.fillText(`LADO: ${sideText}  [SHIFT]`, cx, controlsY - s(10));
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `${UIScale.r(mobile ? 9 : 10)}px "Press Start 2P", monospace`;
            ctx.fillText(mobile ? '[←→] Peça  [OK] Jogar  [C] Comprar' : '[←→] Peça  [ESPAÇO] Jogar  [C] Comprar', cx, controlsY + s(10));
        }

        // ── Mão do jogador + NPCs ──
        this.drawPlayerHands(ctx, cx, handY, width);

        // ── Betting overlay ──
        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, height);
        }

        // ── Resultado ──
        if (this.game.phase === 'result') {
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            const resultHint = mobile
                ? '[OK] NOVAMENTE   [✕] SAIR'
                : '[ESPAÇO] NOVAMENTE   [ESC] SAIR';
            ctx.fillText(resultHint, cx, height - s(16));
        }
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        // Tamanho de peça proporcional à largura disponível
        const maxPiecesVisible = Math.min(this.game.board.length || 1, mobile ? 6 : 9);
        const availW = screenW * 0.92;
        const pieceW = Math.min(s(mobile ? 38 : 36), availW / (maxPiecesVisible + 1));
        const pieceH = pieceW * 2;
        const spacing = pieceW * 0.12;
        const boardAreaH = pieceH * 1.1;

        // Área de fundo da mesa
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, cy - boardAreaH / 2, ctx.canvas.width, boardAreaH);

        if (this.game.board.length === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.setLineDash([s(5), s(5)]);
            ctx.lineWidth = s(2);
            ctx.strokeRect(cx - pieceW / 2, cy - pieceH / 2, pieceW, pieceH);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.font = `italic ${UIScale.r(11)}px "Segoe UI"`;
            ctx.fillText('MESA VAZIA', cx, cy + s(4));
            return;
        }

        // Scroll horizontal: centraliza a janela visível das peças
        const totalW = this.game.board.length * (pieceW + spacing);
        let startX = cx - totalW / 2;

        // Clamp pra não sair da tela
        const minX = s(8);
        const maxX = screenW - s(8) - totalW;
        startX = Math.max(minX, Math.min(startX, maxX));

        this.game.board.forEach((piece, i) => {
            this.drawPiece(ctx, startX + i * (pieceW + spacing), cy, piece, false, pieceW, pieceH);
        });
    }

    private drawPlayerHands(ctx: CanvasRenderingContext2D, cx: number, y: number, screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        const human = this.game.players[0];
        const maxVisible = mobile ? 7 : 10;
        const availW = screenW * 0.88;
        const pieceW = Math.min(s(mobile ? 40 : 36), availW / (Math.min(human.hand.length, maxVisible) + 0.5));
        const pieceH = pieceW * 2;
        const spacing = pieceW * 0.10;

        const totalW = human.hand.length * (pieceW + spacing);
        const startX = cx - totalW / 2;

        human.hand.forEach((piece, i) => {
            const isSelected = this.game.phase === 'playing' && this.game.turnIndex === 0 && this.selectedPieceIndex === i;
            const lift = isSelected ? s(14) : 0;
            this.drawPiece(ctx, startX + i * (pieceW + spacing), y - lift, piece, isSelected, pieceW, pieceH);
        });

        // Contadores de NPC (cantos)
        const npcY = y - pieceH * 0.55;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `600 ${UIScale.r(11 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(this.game.players[1].name, s(14), npcY);
        ctx.font = `bold ${UIScale.r(22 * fScale)}px "Segoe UI"`;
        ctx.fillText(`${this.game.players[1].hand.length}`, s(14), npcY + s(22));

        ctx.textAlign = 'right';
        ctx.font = `600 ${UIScale.r(11 * fScale)}px "Segoe UI", sans-serif`;
        ctx.fillText(this.game.players[2].name, screenW - s(14), npcY);
        ctx.font = `bold ${UIScale.r(22 * fScale)}px "Segoe UI"`;
        ctx.fillText(`${this.game.players[2].hand.length}`, screenW - s(14), npcY + s(22));
    }

    private drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, piece: DominoPiece, selected: boolean, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.translate(x + w / 2, y);

        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = selected ? s(14) : s(4);
        ctx.shadowOffsetY = s(2);

        ctx.fillStyle = selected ? '#fff' : '#f0f0f0';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, s(2));
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = s(1.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-w / 2 + s(2), 0);
        ctx.lineTo(w / 2 - s(2), 0);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = s(1);
        ctx.stroke();

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

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, height: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;
        const cy = height / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, ctx.canvas.width, height);

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 12 : 16)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('QUANTO VALE O JOGO?', cx, cy - s(60));

        ctx.fillStyle = '#ffff00';
        ctx.font = `bold ${UIScale.r(mobile ? 42 : 56) * fScale}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(18);
        ctx.shadowColor = 'rgba(255,255,0,0.4)';
        ctx.fillText(`R$ ${this.game.betAmount}`, cx, cy + s(10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `${UIScale.r(mobile ? 9 : 11)}px "Press Start 2P", monospace`;
        ctx.fillText(mobile ? '[↑↓] Valor  [OK] Confirmar' : '[W/S ou ↑↓] Valor   [ESPAÇO] Confirmar', cx, cy + s(70));
    }
}
