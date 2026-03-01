import { FanTanGame } from './FanTanGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class FanTanUI {
    private game: FanTanGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    private selectedPos: number = 1;

    constructor(game: FanTanGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const phase = this.game.phase;

        if (phase === 'betting') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + 10);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - 10);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.selectedPos = this.selectedPos === 1 ? 4 : this.selectedPos - 1;
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.selectedPos = this.selectedPos === 4 ? 1 : this.selectedPos + 1;
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.choosePosition(this.selectedPos);
            }
        } else if (phase === 'reveal') {
            // Pause then count
            setTimeout(() => { if (this.game.phase === 'reveal') this.game.phase = 'counting'; }, 1500);
        } else if (phase === 'counting') {
            this.game.update(dt);
        } else if (phase === 'result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyR')) {
                this.onPlayAgain(this.game.settle());
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }



    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {

        // Fundo seda vermelha
        ctx.fillStyle = '#4a0404';
        ctx.fillRect(0, 0, screenW, screenH);

        const cx = screenW / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // ── Zonas proporcionais ──
        // TITLE 12% | DRAGON/BOARD 50% | RESULT 22% | FOOTER 16%
        const TITLE_H = screenH * 0.12;
        const BOARD_H = screenH * 0.50;
        const RESULT_H = screenH * 0.22;
        const FOOTER_H = screenH * 0.16;

        const titleY = TITLE_H * 0.65;
        const boardCY = TITLE_H + BOARD_H * 0.50;
        const resultTop = TITLE_H + BOARD_H;
        const footerY = resultTop + RESULT_H + FOOTER_H * 0.55;

        // Dragão decorativo (fundo)
        this.drawDragon(ctx, cx, boardCY);

        // Título
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${UIScale.r(mobile ? 22 : 30) * fScale}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('FAN-TAN', cx, titleY);

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, boardCY);
        } else {
            this.drawBoard(ctx, cx, boardCY);
            if (phase === 'reveal' || phase === 'counting' || phase === 'result') {
                this.drawGrains(ctx, cx, boardCY, fScale);
                if (phase === 'result') {
                    this.drawResultUI(ctx, cx, resultTop, RESULT_H, fScale);
                }
            }
        }

        // Dica de controles (rodapé)
        ctx.fillStyle = 'rgba(255,215,0,0.45)';
        ctx.font = `${UIScale.r(mobile ? 8 : 10) * fScale}px monospace`;
        ctx.textAlign = 'center';
        let helpText: string;
        if (mobile) {
            helpText = phase === 'choosing'
                ? `ESCOLHA (${this.game.currentPlayerChoices.length}/2) | [E] CONFIRMAR | [✕] SAIR`
                : '[E] CONFIRMAR | [✕] SAIR';
        } else {
            helpText = phase === 'choosing'
                ? `ESCOLHA (${this.game.currentPlayerChoices.length}/2) | ENTER CONFIRMAR | ESC SAIR`
                : 'ENTER CONFIRMAR | ESC SAIR';
        }
        ctx.fillText(helpText, cx, footerY);
    }

    private drawDragon(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.moveTo(x - s(250), y);
        ctx.bezierCurveTo(x - s(150), y - s(200), x - s(50), y + s(200), x + s(50), y - s(200));
        ctx.bezierCurveTo(x + s(150), y + s(200), x + s(250), y, x + s(300), y - s(50));

        for (let i = 0; i < 10; i++) {
            const sx = x - s(200) + i * s(40);
            const sy = y + Math.sin(i) * s(50);
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + s(10), sy - s(20));
        }

        ctx.stroke();
        ctx.restore();
    }

    private drawBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;
        const size = s(mobile ? 150 : 180);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = s(3);

        // Square divided in 4
        ctx.strokeRect(x - size, y - size, size * 2, size * 2);
        ctx.beginPath();
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.stroke();

        // Numbers
        ctx.font = `bold ${UIScale.r(24 * fScale)}px sans-serif`;
        ctx.fillStyle = '#ffd700';
        const positions = [
            { id: 1, px: x + size / 2, py: y - size / 2 },
            { id: 2, px: x + size / 2, py: y + size / 2 },
            { id: 3, px: x - size / 2, py: y + size / 2 },
            { id: 4, px: x - size / 2, py: y - size / 2 }
        ];

        for (const pos of positions) {
            const isUser = this.game.currentPlayerChoices.includes(pos.id);
            const isSelected = this.game.phase === 'choosing' && this.selectedPos === pos.id;

            if (isSelected) {
                ctx.fillStyle = mobile ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)';
                ctx.fillRect(pos.px - size / 2 + s(5), pos.py - size / 2 + s(5), size - s(10), size - s(10));
            }

            if (isUser) {
                ctx.fillStyle = mobile ? 'rgba(255, 77, 109, 0.4)' : 'rgba(255, 77, 109, 0.3)';
                ctx.fillRect(pos.px - size / 2 + s(5), pos.py - size / 2 + s(5), size - s(10), size - s(10));
            }

            ctx.fillStyle = '#ffd700';
            ctx.fillText(pos.id === 4 ? '4/0' : pos.id.toString(), pos.px, pos.py);

            if (isUser) {
                ctx.fillStyle = '#ff4d6d';
                ctx.font = `bold ${UIScale.r(12 * fScale)}px sans-serif`;
                ctx.fillText('SUA ESCOLHA', pos.px, pos.py + s(mobile ? 40 : 30));
                ctx.font = `bold ${UIScale.r(24 * fScale)}px sans-serif`;
            }
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(24 * fScale)}px sans-serif`;
        ctx.fillText('QUAL A APOSTA?', centerX, centerY - s(60));
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${UIScale.r(64 * fScale)}px sans-serif`;
        ctx.fillText(`R$ ${this.game.selectedBet}`, centerX, centerY + s(20));
    }

    private drawGrains(ctx: CanvasRenderingContext2D, x: number, y: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const count = this.game.displayedGrains;
        const phase = this.game.phase;

        if (phase === 'reveal') {
            // Draw Straw Basket hiding grains
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(x, y, s(mobile ? 75 : 60), Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#5d2e0d';
            ctx.lineWidth = s(2);
            ctx.stroke();

            ctx.fillStyle = '#ffd700';
            ctx.font = `${UIScale.r(16 * fScale)}px monospace`;
            ctx.fillText('CESTO DE PALHA', x, y - s(mobile ? 85 : 70));
        } else {
            // Draw Grains
            ctx.fillStyle = '#fff9f0';
            const radius = s(mobile ? 50 : 40);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + (i * 0.5);
                const r = (i / count) * radius * 1.5;
                const gx = x + Math.cos(angle) * r;
                const gy = y + Math.sin(angle) * r;
                ctx.beginPath();
                ctx.ellipse(gx, gy, s(3), s(2), angle, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#ffd700';
            ctx.font = `bold ${UIScale.r(20 * fScale)}px monospace`;
            ctx.fillText(`GRÃOS: ${count}`, x, y + s(mobile ? 120 : 100));
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const msgY = zoneTop + zoneH * 0.30;
        const hintY = zoneTop + zoneH * 0.65;

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        const msgSize = Math.floor(Math.min(UIScale.r(mobile ? 16 : 22) * fScale, zoneH * 0.28));
        ctx.font = `bold ${msgSize}px sans-serif`;
        ctx.fillText(this.game.resultMessage, cx, msgY);

        ctx.fillStyle = 'rgba(255,215,0,0.7)';
        ctx.font = `${UIScale.r(mobile ? 8 : 10) * fScale}px monospace`;
        ctx.fillText(
            mobile ? '[OK] JOGAR NOVAMENTE | [E] SAIR' : 'ESPAÇO JOGAR NOVAMENTE | ENTER SAIR',
            cx, hintY
        );
        // avoid unused warning
        void s;
    }
}
