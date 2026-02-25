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

        // Fundo escuro
        ctx.fillStyle = 'rgba(10, 10, 20, 0.96)';
        ctx.fillRect(0, 0, screenW, screenH);

        const cx = screenW / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.1 : 1.0;

        // ── Zonas de layout proporcionais ──
        // TITLE  12% | CONTENT  60% | FOOTER  28%
        const TITLE_H = screenH * 0.12;
        const CONTENT_H = screenH * 0.60;

        const titleY = TITLE_H * 0.65;
        const contentCY = TITLE_H + CONTENT_H * 0.5;  // centro da área de conteúdo
        const footerTop = TITLE_H + CONTENT_H;

        // ── Título ──
        ctx.fillStyle = '#ff9933';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 22)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('CARA OU COROA', cx, titleY);

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentCY, fScale);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, contentCY, fScale);
        } else if (phase === 'flipping' || phase === 'result') {
            // Moeda ocupa o terço superior do conteúdo
            const coinCY = TITLE_H + CONTENT_H * 0.38;
            this.drawCoin(ctx, cx, coinCY, fScale);

            if (phase === 'result') {
                // Resultado fica no terço inferior do conteúdo, acima do rodapé
                const resultY = TITLE_H + CONTENT_H * 0.75;
                this.drawResultUI(ctx, cx, resultY, footerTop, fScale);
            }
        }

        // ── Dica de controles (rodapé fixo) ──
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const hint = mobile
            ? '[E/OK] CONFIRMAR | [✕] SAIR'
            : 'ENTER CONFIRMAR | ESC SAIR';
        ctx.fillText(hint, cx, screenH - s(14));
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('QUANTO VAI APOSTAR?', cx, cy - s(55));

        ctx.fillStyle = '#ff9933';
        ctx.font = `bold ${UIScale.r(mobile ? 42 : 54) * fScale}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = UIScale.s(16);
        ctx.shadowColor = 'rgba(255,153,51,0.35)';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(12));
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.fillText(mobile ? '[↑↓] Ajustar  [E] Confirmar' : '[↑↓] Ajustar  [Enter] Confirmar', cx, cy + s(60));
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('ESCOLHA UM LADO', cx, cy - s(mobile ? 90 : 100));

        const spacing = s(mobile ? 80 : 100);
        this.drawOption(ctx, cx - spacing, cy, 'CARA', this.game.humanChoice === 'heads', fScale);
        this.drawOption(ctx, cx + spacing, cy, 'COROA', this.game.humanChoice === 'tails', fScale);
    }

    private drawOption(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, selected: boolean, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const boxW = s(mobile ? 68 : 58);
        const boxH = s(mobile ? 46 : 38);

        ctx.fillStyle = selected ? '#ff9933' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(x - boxW, y - boxH, boxW * 2, boxH * 2, s(10));
        ctx.fill();
        ctx.strokeStyle = selected ? '#fff' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = s(selected ? 2 : 1);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 11 : 13) * fScale}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + s(6 * fScale));
    }

    private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const scaleX = Math.cos(this.game.currentRotation);
        const size = s(mobile ? 100 : 90);

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(Math.abs(scaleX), 1);

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e6b800';
        ctx.lineWidth = s(5);
        ctx.stroke();

        ctx.fillStyle = '#e6b800';
        ctx.font = `bold ${UIScale.r(38 * fScale)}px sans-serif`;
        ctx.textAlign = 'center';
        const sideSymbol = Math.abs(scaleX) < 0.1 ? '' : (scaleX > 0 ? '🪙' : '💰');
        ctx.fillText(sideSymbol, 0, s(14 * fScale));

        ctx.restore();
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, y: number, footerTop: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        // Garante que o resultado fique dentro da área de conteúdo
        const safeY = Math.min(y, footerTop - s(mobile ? 55 : 65));

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 14 : 18) * fScale}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.game.resultMessage, cx, safeY);

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        const hint = mobile
            ? '[OK] NOVAMENTE | [E] CONTINUAR'
            : 'ESPAÇO NOVAMENTE | ENTER CONTINUAR';
        ctx.fillText(hint, cx, safeY + s(mobile ? 30 : 38));
    }
}
