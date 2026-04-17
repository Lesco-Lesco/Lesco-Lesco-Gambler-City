import { CaraCoroaGame } from './CaraCoroaGame';
import { InputManager } from '../Core/InputManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { BichoManager } from '../BichoManager';


export class CaraCoroaUI implements IMinigameUI {
    private game: CaraCoroaGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: CaraCoroaGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const phase = this.game.phase;

        if (phase === 'betting') {
            const { step } = EconomyManager.getInstance().getBetLimits();
            if (this.input.wasPressedOrHeld('ArrowUp', dt) || this.input.wasPressedOrHeld('KeyW', dt)) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + step);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressedOrHeld('ArrowDown', dt) || this.input.wasPressedOrHeld('KeyS', dt)) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - step);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.game.humanChoice = 'heads';
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.game.humanChoice = 'tails';
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.chooseSide(this.game.humanChoice);
                SoundManager.getInstance().play('coin_flip');
                SoundManager.getInstance().playArpeggio('headstails');
                SoundManager.getInstance().resetArpeggioStep('headstails');
            }
        } else if (phase === 'flipping') {
            this.game.update(dt);
        } else if (phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('KeyR')) {
                const bmanager = BichoManager.getInstance();
                const payout = this.game.settle();
                const totalMoney = bmanager.playerMoney + payout;

                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('headstails', 'lose');
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onClose(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                    SoundManager.getInstance().playFanfare('headstails', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                    this.game.selectedBet = this.game.minBet;
                }
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }



    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const theme = MINIGAME_THEMES.headstails;

        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme, 'CARA OU COROA');

        const cx = screenW / 2;
        const cy = screenH / 2;
        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, cy, theme);
        } else if (phase === 'flipping' || phase === 'result') {
            const coinY = cy - UIScale.s(20);
            this.drawCoin(ctx, cx, coinY, theme);

            if (phase === 'result') {
                this.drawResultUI(ctx, cx, coinY + UIScale.s(120), theme);
            }
        }

        const hint = isMobile() ? 'DPAD Selecionar • [OK] Confirmar' : '←→ ESCOLHER • ENTER CONFIRMAR • ESC SAIR';
        drawMinigameFooter(ctx, screenW, screenH, theme, hint);
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DA APOSTA', cx, cy - s(60));

        const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.font = `bold ${r(24)}px ${theme.titleFont}`;
            ctx.fillText('SEM GRANA!', cx, cy + s(15));
        } else {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(64)}px ${theme.titleFont}`;
            ctx.shadowBlur = s(20);
            ctx.shadowColor = theme.accent + '66';
            ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(15));
        }
        ctx.shadowBlur = 0;
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL LADO VOCÊ ESCOLHE?', cx, cy - s(mobile ? 100 : 130));

        const sides: { id: 'heads' | 'tails', label: string, icon: string }[] = [
            { id: 'heads', label: 'CARA', icon: '🎭' },
            { id: 'tails', label: 'COROA', icon: '👑' }
        ];

        const spacing = s(mobile ? 90 : 130);
        sides.forEach((side, i) => {
            const x = cx + (i - 0.5) * 2 * spacing;
            const selected = this.game.humanChoice === side.id;

            ctx.save();
            ctx.translate(x, cy);

            const size = s(mobile ? 50 : 70);

            // Selection Glow
            if (selected) {
                ctx.fillStyle = theme.accent + '22';
                ctx.shadowBlur = s(30);
                ctx.shadowColor = theme.accent;
                ctx.beginPath();
                ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(3);
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Icon/Text
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 1;
            ctx.font = `${s(mobile ? 40 : 55)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(side.icon, 0, 0);

            // Label
            ctx.fillStyle = selected ? '#fff' : theme.textMuted;
            ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
            ctx.fillText(side.label, 0, size + s(30));

            ctx.restore();
        });
    }

    private drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const size = s(mobile ? 80 : 110);
        const cos = Math.cos(this.game.currentRotation);
        const absCos = Math.abs(cos);

        ctx.save();
        ctx.translate(x, y);

        // Motion Blur (simulated during flipping)
        if (this.game.phase === 'flipping') {
            ctx.shadowBlur = s(15);
            ctx.shadowColor = theme.accent;
        }

        ctx.scale(absCos, 1);

        // Coin Face
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        grad.addColorStop(0, '#fde047'); // Gold highlight
        grad.addColorStop(0.7, '#eab308'); // Pure gold
        grad.addColorStop(1, '#a16207'); // Dark rim

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = s(4);
        ctx.stroke();

        // Inner Rim
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        // Icon (Revealed based on cos sign)
        if (absCos > 0.1) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 1;
            ctx.font = `${size * 0.7}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cos > 0 ? '🎭' : '👑', 0, 10);
        }

        ctx.restore();
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, y: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(32)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(this.game.resultMessage.toUpperCase(), cx, y);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText('ESPAÇO PARA NOVA PARTIDA', cx, y + s(40));
    }
}
