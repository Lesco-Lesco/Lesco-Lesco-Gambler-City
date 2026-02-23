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
            if (this.input.wasPressed('Escape')) this.onClose(0);
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
            } else if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE') || this.input.wasPressed('Escape')) {
                this.onClose(this.game.settle());
            }
        }
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);

        // Red Silk Texture/Background
        ctx.fillStyle = '#4a0404';
        ctx.fillRect(0, 0, screenW, screenH);

        // Grid/Board
        const centerX = screenW / 2;
        const centerY = screenH / 2;

        // Discrete Dragon
        this.drawDragon(ctx, centerX, centerY);

        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${UIScale.r(36)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('FAN-TAN', centerX, s(80));

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, centerX, centerY);
        } else {
            this.drawBoard(ctx, centerX, centerY);
            if (phase === 'choosing') {
                // Handled in drawBoard
            } else if (phase === 'reveal' || phase === 'counting' || phase === 'result') {
                this.drawGrains(ctx, centerX, centerY);
                if (phase === 'result') {
                    this.drawResultUI(ctx, centerX, centerY + s(220));
                }
            }
        }

        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.font = `${UIScale.r(12)}px monospace`;
        let helpText: string;
        if (isMobile()) {
            helpText = phase === 'choosing'
                ? `ESCOLHA 2 POSIÇÕES (${this.game.currentPlayerChoices.length}/2) | [E] CONFIRMAR | [✕] SAIR`
                : '[E] CONFIRMAR | [✕] SAIR';
        } else {
            helpText = phase === 'choosing'
                ? `ESCOLHA 2 POSIÇÕES (${this.game.currentPlayerChoices.length}/2) | ENTER CONFIRMAR | ESC SAIR`
                : 'ENTER CONFIRMAR | ESC SAIR';
        }
        ctx.fillText(helpText, centerX, screenH - s(40));
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
        const size = s(180);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = s(3);

        // Square divided in 4
        ctx.strokeRect(x - size, y - size, size * 2, size * 2);
        ctx.beginPath();
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.stroke();

        // Numbers
        ctx.font = `bold ${UIScale.r(24)}px sans-serif`;
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
                ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
                ctx.fillRect(pos.px - size / 2 + s(5), pos.py - size / 2 + s(5), size - s(10), size - s(10));
            }

            if (isUser) {
                ctx.fillStyle = 'rgba(255, 77, 109, 0.3)';
                ctx.fillRect(pos.px - size / 2 + s(5), pos.py - size / 2 + s(5), size - s(10), size - s(10));
            }

            ctx.fillStyle = '#ffd700';
            ctx.fillText(pos.id === 4 ? '4/0' : pos.id.toString(), pos.px, pos.py);

            if (isUser) {
                ctx.fillStyle = '#ff4d6d';
                ctx.font = `bold ${UIScale.r(12)}px sans-serif`;
                ctx.fillText('SUA ESCOLHA', pos.px, pos.py + s(30));
                ctx.font = `bold ${UIScale.r(24)}px sans-serif`;
            }
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(24)}px sans-serif`;
        ctx.fillText('QUAL A APOSTA?', centerX, centerY - s(60));
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${UIScale.r(64)}px sans-serif`;
        ctx.fillText(`R$ ${this.game.selectedBet}`, centerX, centerY + s(20));
    }

    private drawGrains(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        const count = this.game.displayedGrains;
        const phase = this.game.phase;

        if (phase === 'reveal') {
            // Draw Straw Basket hiding grains
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(x, y, s(60), Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#5d2e0d';
            ctx.lineWidth = s(2);
            ctx.stroke();

            ctx.fillStyle = '#ffd700';
            ctx.font = `${UIScale.r(16)}px monospace`;
            ctx.fillText('CESTO DE PALHA', x, y - s(70));
        } else {
            // Draw Grains
            ctx.fillStyle = '#fff9f0';
            const radius = s(40);
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
            ctx.font = `bold ${UIScale.r(20)}px monospace`;
            ctx.fillText(`GRÃOS: ${count}`, x, y + s(100));
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, centerX: number, y: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(24)}px sans-serif`;
        ctx.fillText(this.game.resultMessage, centerX, y);
        ctx.font = `${UIScale.r(16)}px monospace`;
        const resultHint = isMobile()
            ? '[OK] JOGAR NOVAMENTE | [E] SAIR'
            : 'ESPAÇO JOGAR NOVAMENTE | ENTER SAIR';
        ctx.fillText(resultHint, centerX, y + s(40));
    }
}
