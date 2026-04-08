import { PalitinhoGame } from './PalitinhoGame';
import { InputManager } from '../Core/InputManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { BichoManager } from '../BichoManager';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import type { IMinigameUI } from './BaseMinigame';

export class PalitinhoUI implements IMinigameUI {
    private game: PalitinhoGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    private selectedIdx: number = 0;

    constructor(game: PalitinhoGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        this.game.update(dt);
        const phase = this.game.phase;

        if (phase === 'betting') {
            const { step } = EconomyManager.getInstance().getBetLimits();
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + step);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - step);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
                SoundManager.getInstance().play('bet_place');
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.selectedIdx = (this.selectedIdx + 3) % 4; // 4 sticks in Palitinho
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.selectedIdx = (this.selectedIdx + 1) % 4;
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.chooseMatchstick(this.selectedIdx);
                SoundManager.getInstance().play('dice_roll'); // "Pick" sound
                SoundManager.getInstance().playArpeggio('palitinho');
            }
        } else if (phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('KeyR')) {
                const bmanager = BichoManager.getInstance();
                const payout = this.game.settle();
                const totalMoney = bmanager.playerMoney + payout;

                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('palitinho', 'lose');
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onClose(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                    SoundManager.getInstance().playFanfare('palitinho', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                }
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.palitinho;

        // Fullscreen themed background
        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme);

        // ── Layout proportional zones ──
        const TITLE_H = screenH * 0.15;
        const CONTENT_H = screenH * 0.55;
        const FOOTER_H = screenH * 0.30;

        const contentY = TITLE_H + CONTENT_H * 0.5;
        const footerTop = TITLE_H + CONTENT_H;

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentY, theme);
        } else if (phase === 'dice_roll') {
            this.drawDiceUI(ctx, cx, contentY, theme);
        } else if (phase === 'choosing' || phase === 'reveal' || phase === 'result') {
            this.drawMatchsticks(ctx, cx, contentY - s(mobile ? 10 : 20), screenW, theme);
            this.drawPlayersUI(ctx, cx, footerTop + FOOTER_H * 0.25, theme);

            if (phase === 'result') {
                ctx.fillStyle = theme.text;
                ctx.font = `bold ${r(mobile ? 15 : 18)}px ${theme.bodyFont}`;
                ctx.textAlign = 'center';
                ctx.fillText(this.game.resultMessage, cx, footerTop + FOOTER_H * 0.55);

                const resultHint = mobile
                    ? '[OK] Continuar'
                    : 'ESPAÇO NOVAMENTE | ENTER SAIR';
                drawMinigameFooter(ctx, screenW, screenH, theme, resultHint);
            }
        }

        // Action Hints
        if (phase !== 'result') {
            const helpHint = mobile
                ? '[DPAD] Escolher • [OK] Confirmar'
                : '[←→] ESCOLHER  [ENTER] CONFIRMAR  [ESC] SAIR';
            drawMinigameFooter(ctx, screenW, screenH, theme, helpHint);
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 14 : 16)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DA APOSTA', cx, cy - s(60));

        const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.font = `bold ${r(mobile ? 24 : 32)}px ${theme.titleFont}`;
            ctx.fillText('SEM GRANA!', cx, cy + s(10));
        } else {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(mobile ? 60 : 64)}px ${theme.titleFont}`;
            ctx.shadowBlur = s(20);
            ctx.shadowColor = theme.accent + '66';
            ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(10));
        }
        ctx.shadowBlur = 0;

        // Mobile arrows
        if (mobile) {
            ctx.fillStyle = theme.textMuted;
            ctx.font = `bold ${r(24)}px ${theme.bodyFont}`;
            ctx.fillText('▲', cx, cy - s(110));
            ctx.fillText('▼', cx, cy + s(100));
        }
    }

    private drawDiceUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('SORTEANDO A ORDEM...', cx, cy - s(mobile ? 70 : 100));

        const spacing = s(mobile ? 85 : 120);
        const startX = cx - (spacing * 1.5);

        this.game.players.forEach((p, i) => {
            const x = startX + i * spacing;
            ctx.fillStyle = theme.text;
            ctx.font = `600 ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
            ctx.fillText(p.name.toUpperCase(), x, cy + s(65));
            
            let displayValue = p.diceValue;
            if (this.game.phase === 'dice_roll' && this.game.diceTimer < 1.5) {
                displayValue = ((Math.floor(Date.now() / 80) + i * 2) % 6) + 1;
            }
            
            this.drawSingleDice(ctx, x, cy, displayValue);
        });
    }

    private drawSingleDice(ctx: CanvasRenderingContext2D, x: number, y: number, value: number) {
        const s = UIScale.s.bind(UIScale);
        const size = s(44);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - size / 2 + s(4), y - size / 2 + s(4), size, size);

        ctx.fillStyle = '#fdfdfd';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, s(6));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#111';
        const rd = s(3.5);
        const offset = size / 4;
        if (value % 2 !== 0) { ctx.beginPath(); ctx.arc(x, y, rd, 0, Math.PI * 2); ctx.fill(); }
        if (value >= 2) {
            ctx.beginPath(); ctx.arc(x - offset, y - offset, rd, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset, y + offset, rd, 0, Math.PI * 2); ctx.fill();
        }
        if (value >= 4) {
            ctx.beginPath(); ctx.arc(x + offset, y - offset, rd, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x - offset, y + offset, rd, 0, Math.PI * 2); ctx.fill();
        }
        if (value === 6) {
            ctx.beginPath(); ctx.arc(x - offset, y, rd, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + offset, y, rd, 0, Math.PI * 2); ctx.fill();
        }
    }

    private drawPlayersUI(ctx: CanvasRenderingContext2D, cx: number, y: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const spacing = s(mobile ? 85 : 120);
        const startX = cx - (spacing * 1.5);

        this.game.players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isTurn = this.game.currentPlayerIdx === p.order && this.game.phase === 'choosing';

            ctx.fillStyle = isTurn ? theme.accent : (p.isLoser ? '#ff4444' : theme.textMuted);
            ctx.font = (isTurn ? 'bold ' : '600 ') + `${r(mobile ? 13 : 14)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), px, y);

            if (isTurn) {
                ctx.fillStyle = theme.accent;
                ctx.font = `bold ${r(mobile ? 9 : 10)}px ${theme.bodyFont}`;
                ctx.fillText('SUA VEZ!', px, y + s(20));

                // Pulsing indicator
                const pulse = (Math.sin(Date.now() / 200) + 1) * 0.5;
                ctx.globalAlpha = 0.3 * pulse;
                ctx.beginPath();
                ctx.arc(px, y - s(12), s(12), 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        });
    }

    private drawMatchsticks(ctx: CanvasRenderingContext2D, cx: number, cy: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const spacing = Math.min(s(mobile ? 85 : 110), screenW * 0.23);
        const startX = cx - (spacing * 1.5);

        this.game.matchsticks.forEach((m, i) => {
            const x = startX + i * spacing;
            const isSelected = this.selectedIdx === i
                && this.game.phase === 'choosing'
                && this.game.players.find(p => p.isHuman)?.order === this.game.currentPlayerIdx;
            const isPicked = m.pickedBy !== null;
            const isReveal = this.game.phase === 'result' || this.game.phase === 'reveal';
            const stickH = s(mobile ? 100 : 130);

            if (isSelected) {
                ctx.fillStyle = theme.accent + '22';
                ctx.beginPath();
                ctx.arc(x, cy, s(mobile ? 55 : 65), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(3);
                ctx.setLineDash([s(5), s(5)]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Finger cursor hint for mobile
                if (mobile) {
                    ctx.fillStyle = theme.accent;
                    ctx.font = `${r(20)}px sans-serif`;
                    ctx.fillText('☝️', x, cy + s(80));
                }
            }

            if (isPicked) {
                const headY = isReveal && m.isBroken ? cy + s(10) : cy - stickH * 0.65;

                // Stick Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x + s(3), cy - stickH * 0.4, s(6), stickH * 0.8);

                // Main Stick
                const woodGrad = ctx.createLinearGradient(x - s(4), 0, x + s(4), 0);
                woodGrad.addColorStop(0, '#c2a07c');
                woodGrad.addColorStop(0.5, '#f4dca6');
                woodGrad.addColorStop(1, '#c2a07c');
                ctx.fillStyle = woodGrad;
                ctx.fillRect(x - s(4), cy - stickH * 0.5, s(8), stickH);

                // Broken effect
                if (isReveal && m.isBroken) {
                    ctx.fillStyle = '#111';
                    ctx.beginPath();
                    ctx.moveTo(x - s(6), cy);
                    ctx.lineTo(x + s(6), cy + s(5));
                    ctx.lineTo(x + s(6), cy - s(5));
                    ctx.fill();

                    // Darken stick bottom
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(x - s(4), cy, s(8), stickH * 0.5);
                }

                // Head
                const headColor = isReveal && m.isBroken ? '#ff0000' : '#d32f2f';
                const headGrad = ctx.createRadialGradient(x - s(2), headY - s(3), s(1), x, headY, s(10));
                headGrad.addColorStop(0, '#ff5252');
                headGrad.addColorStop(1, headColor);

                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(x, headY, s(7), s(10), 0, 0, Math.PI * 2);
                ctx.fill();

                // Player name on the stick
                ctx.fillStyle = (isReveal && m.isBroken) ? '#ff4444' : theme.text;
                ctx.font = `bold ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
                ctx.textAlign = 'center';
                ctx.fillText(m.pickedBy?.toUpperCase() || '', x, cy + stickH * 0.65);
            } else {
                ctx.fillStyle = theme.textMuted;
                ctx.font = `bold ${r(mobile ? 48 : 48)}px ${theme.titleFont}`;
                ctx.textAlign = 'center';
                ctx.fillText('?', x, cy + s(15));
            }
        });
    }
}
