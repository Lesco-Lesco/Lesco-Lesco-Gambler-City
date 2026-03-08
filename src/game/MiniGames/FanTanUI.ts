import { FanTanGame } from './FanTanGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import type { IMinigameUI } from './BaseMinigame';


export class FanTanUI implements IMinigameUI {
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
                SoundManager.getInstance().play('bet_place');
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
                const payout = this.game.settle();
                SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                this.onPlayAgain(payout);
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }



    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const theme = MINIGAME_THEMES.fantan;

        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme, 'FAN-TAN TRADICIONAL');

        const cx = screenW / 2;
        const cy = screenH / 2;
        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else {
            this.drawDragonDecor(ctx, cx, cy, theme);
            this.drawBoard(ctx, cx, cy, theme);

            if (phase === 'reveal' || phase === 'counting' || phase === 'result') {
                this.drawGrains(ctx, cx, cy, theme);
            }

            if (phase === 'result') {
                this.drawResultUI(ctx, cx, cy, theme);
            }
        }

        const hint = isMobile() ? 'DPAD Selecionar • [OK] Confirmar' : '←→ SELECIONAR • ENTER CONFIRMAR • ESC SAIR';
        drawMinigameFooter(ctx, screenW, screenH, theme, hint);
    }

    private drawDragonDecor(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = s(2);

        // Abstract Dragon Swirl
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
            const r = s(100 + i * 15);
            const angle = i * 0.4 + Date.now() * 0.0005;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(14)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('DEFINA SUA APOSTA', cx, cy - s(60));

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(64)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(25);
        ctx.shadowColor = theme.accent + '66';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(15));
        ctx.shadowBlur = 0;
    }

    private drawBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const size = s(mobile ? 120 : 160);

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = s(3);

        // Outter Square
        ctx.strokeRect(cx - size, cy - size, size * 2, size * 2);

        // Dividers
        ctx.beginPath();
        ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size);
        ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy);
        ctx.stroke();

        const positions = [
            { id: 1, x: cx + size / 2, y: cy - size / 2 },
            { id: 2, x: cx + size / 2, y: cy + size / 2 },
            { id: 3, x: cx - size / 2, y: cy + size / 2 },
            { id: 4, x: cx - size / 2, y: cy - size / 2 }
        ];

        positions.forEach(pos => {
            const isUser = this.game.currentPlayerChoices.includes(pos.id);
            const isCurrent = this.game.phase === 'choosing' && this.selectedPos === pos.id;

            if (isCurrent || isUser) {
                ctx.fillStyle = isUser ? theme.accent + '44' : 'rgba(255,255,255,0.1)';
                ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);

                if (isCurrent) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = s(2);
                    ctx.strokeRect(pos.x - size / 2 + s(5), pos.y - size / 2 + s(5), size - s(10), size - s(10));
                }
            }

            ctx.fillStyle = isUser ? theme.accent : '#fff';
            ctx.font = `900 ${r(32)}px ${theme.titleFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pos.id === 4 ? '4/0' : pos.id.toString(), pos.x, pos.y);

            if (isUser) {
                ctx.font = `bold ${r(10)}px ${theme.bodyFont}`;
                ctx.fillText('APOSTA', pos.x, pos.y + s(30));
            }
        });
    }

    private drawGrains(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const count = this.game.displayedGrains;

        if (this.game.phase === 'reveal') {
            // Ceremonial Cup
            ctx.fillStyle = '#222';
            ctx.shadowBlur = s(20);
            ctx.shadowColor = '#000';
            ctx.beginPath();
            ctx.arc(cx, cy, s(60), 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = theme.accent;
            ctx.lineWidth = s(3);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(10)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText('REVELANDO...', cx, cy);
        } else {
            // White Porcelain Grains
            ctx.fillStyle = '#fef3c7';
            const radius = s(isMobile() ? 40 : 55);

            for (let i = 0; i < count; i++) {
                const angle = (i * 137.5) * (Math.PI / 180); // golden angle
                const dist = Math.sqrt(i) * (radius / Math.sqrt(count)) * 1.8;
                const gx = cx + Math.cos(angle) * dist;
                const gy = cy + Math.sin(angle) * dist;

                ctx.beginPath();
                ctx.arc(gx, gy, s(2.5), 0, Math.PI * 2);
                ctx.fill();
            }

            if (this.game.phase === 'counting') {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${r(18)}px ${theme.bodyFont}`;
                ctx.textAlign = 'center';
                ctx.fillText(`CONTAGEM: ${count}`, cx, cy + s(110));
            }
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(18)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('RESULTADO FINAL', cx, cy - s(80));

        ctx.fillStyle = '#fff';
        ctx.font = `900 ${r(24)}px ${theme.titleFont}`;
        ctx.fillText(this.game.resultMessage.toUpperCase(), cx, cy);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText('ESPAÇO PARA NOVA PARTIDA • ESC PARA SAIR', cx, cy + s(80));
    }
}
