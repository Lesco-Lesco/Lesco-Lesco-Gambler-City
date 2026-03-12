import { DominoGame } from './DominoGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';

export class DominoUI implements IMinigameUI {
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
                    SoundManager.getInstance().play('bet_place');
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
                        if (success) {
                            this.selectedPieceIndex = 0;
                            SoundManager.getInstance().play('dice_roll');
                        }
                    }
                }
                if (input.wasPressed('KeyC') || (isMobile() && input.wasPressed('KeyE'))) {
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
                SoundManager.getInstance().play(win > 0 ? 'win_small' : 'lose');
                this.onPlayAgain(win);
                this.game.reset();
            }
        }

        if (input.wasPressed('Escape')) {
            const finalWin = (this.game.phase === 'result' && this.game.winner?.isHuman) ? this.game.betAmount * 3 : 0;
            this.onClose(finalWin);
        }
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const theme = MINIGAME_THEMES.domino;

        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme, 'DOMINÓ TRADICIONAL');

        const cx = width / 2;
        const cy = height / 2;

        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else {
            this.drawBoard(ctx, cx, cy, width, theme);
            this.drawStatus(ctx, cx, height, theme);
            this.drawPlayerHand(ctx, cx, height, width, theme);

            if (this.game.phase === 'playing' && this.game.turnIndex === 0 && this.game.board.length > 0) {
                this.drawSideSelectionUI(ctx, cx, cy, width, theme);
            }

            if (this.game.phase === 'result') {
                this.drawResultUI(ctx, cx, cy, theme);
            }
        }

        const hint = isMobile() ? '[DPAD] Mover • [OK] Jogar • [E] Cavar' : '←→ PEÇAS • ESPAÇO JOGAR • [C] CAVAR • ESC SAIR';
        drawMinigameFooter(ctx, width, height, theme, hint);
    }

    private drawStatus(ctx: CanvasRenderingContext2D, cx: number, height: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const y = height * 0.18;

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${this.game.pool.length} PEÇAS NO MONTINHO`, cx, y);

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(16)}px ${theme.titleFont}`;
        ctx.fillText(this.game.message.toUpperCase(), cx, y + s(25));
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const boardW = screenW * 0.95;
        const pW = s(mobile ? 32 : 42);
        const pH = pW * 1.8;
        const spacing = pW * 0.15;

        // Visual table surface
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.roundRect(s(10), cy - pH * 0.8, screenW - s(20), pH * 1.6, s(20));
        ctx.fill();

        if (this.game.board.length === 0) {
            ctx.strokeStyle = theme.accent + '33';
            ctx.setLineDash([s(5), s(5)]);
            ctx.strokeRect(cx - pW / 2, cy - pH / 2, pW, pH);
            ctx.setLineDash([]);
            return;
        }

        const visibleCount = Math.floor(boardW / (pW + spacing));
        const boardToDraw = this.game.board.slice(-visibleCount);
        const totalW = boardToDraw.length * (pW + spacing);
        const startX = cx - totalW / 2;

        boardToDraw.forEach((piece, i) => {
            this.renderPiece(ctx, startX + i * (pW + spacing), cy, piece, false, pW, pH);
        });
    }

    private drawPlayerHand(ctx: CanvasRenderingContext2D, cx: number, height: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const player = this.game.players[0];
        const pW = s(mobile ? 38 : 46);
        const pH = pW * 1.8;
        const spacing = pW * 0.12;
        const y = height * 0.85;

        const totalW = player.hand.length * (pW + spacing);
        const startX = cx - totalW / 2;

        // Player Tag
        ctx.fillStyle = '#fff';
        ctx.font = `800 ${r(11)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('SUA MÃO', cx, y - pH * 0.65);

        player.hand.forEach((piece, i) => {
            const isSelected = this.game.turnIndex === 0 && this.selectedPieceIndex === i;
            const lift = isSelected ? s(15) : 0;
            this.renderPiece(ctx, startX + i * (pW + spacing), y - lift, piece, isSelected, pW, pH);
        });

        // Opponents count
        const sideGap = s(30);
        this.game.players.forEach((p, i) => {
            if (i === 0) return;
            const isLeft = i === 1;
            ctx.save();
            ctx.textAlign = isLeft ? 'left' : 'right';
            const px = isLeft ? sideGap : screenW - sideGap;
            const py = height * 0.65;

            // Name
            ctx.fillStyle = theme.textMuted;
            ctx.font = `bold ${r(11)}px ${theme.bodyFont}`;
            ctx.fillText(p.name.toUpperCase(), px, py);

            // Large Piece Count
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(32)}px ${theme.titleFont}`;
            ctx.shadowBlur = s(10);
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillText(`${p.hand.length}`, px, py + s(45)); // Corrected to 45
            ctx.shadowBlur = 0;

            // Sub-label (optional icon/text)
            ctx.fillStyle = theme.accent + '99';
            ctx.font = `600 ${r(9)}px ${theme.bodyFont}`;
            ctx.fillText('PEÇAS', px, py + s(65)); // Corrected to 65
            ctx.restore();
        });
    }

    private renderPiece(ctx: CanvasRenderingContext2D, x: number, y: number, piece: any, selected: boolean, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.translate(x + w / 2, y);

        // Body
        ctx.fillStyle = selected ? '#ffffff' : '#fcfcf7';
        ctx.shadowBlur = selected ? s(20) : s(4);
        ctx.shadowColor = 'rgba(0,0,0,0.4)';

        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, s(4));
        ctx.fill();
        ctx.shadowBlur = 0;

        // Center line
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = s(1.5);
        ctx.beginPath();
        ctx.moveTo(-w * 0.35, 0);
        ctx.lineTo(w * 0.35, 0);
        ctx.stroke();

        this.renderDots(ctx, piece.sideA, -h * 0.25, w);
        this.renderDots(ctx, piece.sideB, h * 0.25, w);

        ctx.restore();
    }

    private drawSideSelectionUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const pW = s(mobile ? 32 : 42);
        const pH = pW * 1.8;
        const spacing = pW * 0.15;
        const boardW = screenW * 0.95;
        const visibleCount = Math.floor(boardW / (pW + spacing));
        const boardToDraw = this.game.board.slice(-visibleCount);
        const totalW = boardToDraw.length * (pW + spacing);
        const startX = cx - totalW / 2;

        const leftX = startX;
        const rightX = startX + (boardToDraw.length - 1) * (pW + spacing);

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = `bold ${r(10)}px ${theme.bodyFont}`;

        // Pulsating effect
        const pulse = 0.6 + Math.sin(Date.now() / 200) * 0.4;
        ctx.globalAlpha = pulse;

        // Left Side
        if (this.selectedSide === 'left') {
            ctx.fillStyle = theme.accent;
            ctx.shadowBlur = s(15);
            ctx.shadowColor = theme.accent;
            ctx.fillText('◄ AQUI', leftX - s(30), cy);
        }

        // Right Side
        if (this.selectedSide === 'right') {
            ctx.fillStyle = theme.accent;
            ctx.shadowBlur = s(15);
            ctx.shadowColor = theme.accent;
            ctx.fillText('AQUI ►', rightX + pW + s(30), cy);
        }

        ctx.restore();

        // Top hint
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(10)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Fix text baseline for better centering
        const sideHint = isMobile() ? '[RUN] Mudar Lado' : '[Q/SHIFT] MUDAR LADO';
        ctx.fillText(sideHint, cx, cy + pH * 0.9);
    }

    private renderDots(ctx: CanvasRenderingContext2D, count: number, y: number, w: number) {
        const dotR = w * 0.08;
        const offset = w * 0.22;
        ctx.fillStyle = '#1e293b';

        const dot = (dx: number, dy: number) => {
            ctx.beginPath();
            ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
            ctx.fill();
        };

        if (count % 2 !== 0) dot(0, y);
        if (count >= 2) { dot(-offset, y - offset); dot(offset, y + offset); }
        if (count >= 4) { dot(offset, y - offset); dot(-offset, y + offset); }
        if (count === 6) { dot(-offset, y); dot(offset, y); }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 11 : 14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VALOR DA PARTIDA', cx, cy - s(60));

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(mobile ? 48 : 64)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent + '88';
        ctx.fillText(`R$ ${this.game.betAmount}`, cx, cy + s(10));
        ctx.shadowBlur = 0;
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const won = this.game.winner?.isHuman;
        ctx.fillStyle = won ? '#4ade80' : '#f87171';
        ctx.font = `bold ${r(54)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(won ? 'VITÓRIA!' : 'DERROTA', cx, cy - s(20));

        if (won) {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(24)}px ${theme.bodyFont}`;
            ctx.fillText(`+ R$ ${this.game.betAmount * 3}`, cx, cy + s(40));
        }

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText(isMobile() ? '[OK] Continuar' : 'ESPAÇO PARA CONTINUAR', cx, cy + s(100));
    }
}
