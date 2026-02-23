import { HeadsTailsGame } from './HeadsTailsGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class HeadsTailsUI {
    private game: HeadsTailsGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: HeadsTailsGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
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
            if (this.input.wasPressed('Escape')) {
                this.onClose(0);
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.game.humanChoice = 'heads';
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.game.humanChoice = 'tails';
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.chooseSide(this.game.humanChoice);
            }
        } else if (phase === 'flipping') {
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

        // Dark Overlay
        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        ctx.fillRect(0, 0, screenW, screenH);

        const centerX = screenW / 2;
        const centerY = screenH / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        // Title
        ctx.fillStyle = '#ff9933';
        ctx.font = `bold ${UIScale.r(36 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('CARA OU COROA', centerX, s(mobile ? 80 : 100));

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, centerX, centerY);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, centerX, centerY);
        } else if (phase === 'flipping' || phase === 'result') {
            this.drawCoin(ctx, centerX, centerY);
            if (phase === 'result') {
                this.drawResultUI(ctx, centerX, centerY + s(150));
            }
        }

        // Hints
        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(14 * fScale)}px monospace`;
        const hint = mobile
            ? '[E] CONFIRMAR | [✕] SAIR'
            : 'ENTER - CONFIRMAR | ESC - SAIR';
        ctx.fillText(hint, centerX, screenH - s(mobile ? 40 : 50));
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(24 * fScale)}px sans-serif`;
        ctx.fillText('QUANTO VAI APOSTAR?', centerX, centerY - s(60));

        ctx.fillStyle = '#ff9933';
        ctx.font = `bold ${UIScale.r(64 * fScale)}px sans-serif`;
        ctx.fillText(`R$ ${this.game.selectedBet}`, centerX, centerY + s(20));
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(24 * fScale)}px sans-serif`;
        ctx.fillText('ESCOLHA UM LADO', centerX, centerY - s(mobile ? 120 : 150));

        this.drawOption(ctx, centerX - s(mobile ? 85 : 100), centerY, 'CARA', this.game.humanChoice === 'heads');
        this.drawOption(ctx, centerX + s(mobile ? 85 : 100), centerY, 'COROA', this.game.humanChoice === 'tails');
    }

    private drawOption(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, selected: boolean) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;
        const boxW = s(mobile ? 75 : 60);
        const boxH = s(mobile ? 50 : 40);

        ctx.fillStyle = selected ? '#ff9933' : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(x - boxW, y - boxH, boxW * 2, boxH * 2, s(10));
        ctx.fill();
        ctx.strokeStyle = selected ? '#fff' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = s(2);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(20 * fScale)}px sans-serif`;
        ctx.fillText(label, x, y + s(8 * fScale));
    }

    private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;
        const scaleX = Math.cos(this.game.currentRotation);
        const size = s(mobile ? 120 : 100);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(Math.abs(scaleX), 1);

        // Coin Face
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e6b800';
        ctx.lineWidth = s(5);
        ctx.stroke();

        // Symbol
        ctx.fillStyle = '#e6b800';
        ctx.font = `bold ${UIScale.r(40 * fScale)}px sans-serif`;
        const sideSymbol = Math.abs(scaleX) < 0.1 ? '' : (scaleX > 0 ? '🪙' : '💰');
        ctx.fillText(sideSymbol, 0, s(15 * fScale));

        ctx.restore();
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, centerX: number, y: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(28 * fScale)}px sans-serif`;
        ctx.fillText(this.game.resultMessage, centerX, y);

        ctx.font = `${UIScale.r(16 * fScale)}px monospace`;
        const resultHint = mobile
            ? '[OK] JOGAR NOVAMENTE | [E] CONTINUAR'
            : 'ESPAÇO JOGAR NOVAMENTE | ENTER CONTINUAR';
        ctx.fillText(resultHint, centerX, y + s(mobile ? 40 : 50));
    }
}
