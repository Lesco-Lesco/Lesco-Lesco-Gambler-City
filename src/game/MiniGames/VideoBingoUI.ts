import { VideoBingoGame } from './VideoBingoGame';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { EconomyManager } from '../Core/EconomyManager';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';

export class VideoBingoUI implements IMinigameUI {
    private game: VideoBingoGame;
    private onExit: (payout: number) => void;
    private onPlayAgain: (payout: number) => void;

    constructor(
        game: VideoBingoGame,
        onExit: (payout: number) => void,
        onPlayAgain: (payout: number) => void
    ) {
        this.game = game;
        this.onExit = onExit;
        this.onPlayAgain = onPlayAgain;
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();

        if (this.game.phase === 'betting') {
            const { step, max } = EconomyManager.getInstance().getBetLimits();
            if (input.wasPressedOrHeld('ArrowDown', _dt) || input.wasPressedOrHeld('KeyS', _dt)) {
                this.game.betAmount = Math.max(10, this.game.betAmount - step);
                SoundManager.getInstance().play('menu_select');
            }
            if (input.wasPressedOrHeld('ArrowUp', _dt) || input.wasPressedOrHeld('KeyW', _dt)) {
                this.game.betAmount = Math.min(max, this.game.betAmount + step);
                SoundManager.getInstance().play('menu_select');
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const bmanager = BichoManager.getInstance();
                if (bmanager && bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.start();
                    SoundManager.getInstance().play('bet_place');
                    SoundManager.getInstance().resetArpeggioStep('videobingo');
                }
            }
        } else if (this.game.phase === 'picking') {
            if (this.game.selectedCardIndex === -1) this.game.selectedCardIndex = 0;

            if (input.wasPressed('ArrowLeft')) this.game.selectedCardIndex = (this.game.selectedCardIndex % 2 === 0) ? this.game.selectedCardIndex + 1 : this.game.selectedCardIndex - 1;
            if (input.wasPressed('ArrowRight')) this.game.selectedCardIndex = (this.game.selectedCardIndex % 2 === 1) ? this.game.selectedCardIndex - 1 : this.game.selectedCardIndex + 1;
            if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowDown')) {
                this.game.selectedCardIndex = (this.game.selectedCardIndex + 2) % 4;
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                this.game.selectCard(this.game.selectedCardIndex, this.game.betAmount);
                this.startDrawing();
                SoundManager.getInstance().play('bet_place');
            }
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const bmanager = BichoManager.getInstance();
                const payout = this.game.totalPayout;
                const totalMoney = (bmanager?.playerMoney || 0) + payout;

                if (totalMoney < 10) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('videobingo', 'lose');
                    bmanager?.addNotification("Você está sem grana para apostar!", 3);
                    this.onExit(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                    SoundManager.getInstance().playFanfare('videobingo', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                }
            }
        }

        if (input.wasPressed('Escape')) {
            if (this.drawInterval) clearInterval(this.drawInterval);
            const payout = (this.game.phase === 'result') ? this.game.totalPayout : 0;
            this.onExit(payout);
        }

    }

    private startDrawing() {
        if (this.drawInterval) clearInterval(this.drawInterval);
        this.drawInterval = setInterval(() => {
            const num = this.game.drawNext();
            if (num !== null) {
                SoundManager.getInstance().playArpeggio('videobingo');
            } else {
                if (this.drawInterval) clearInterval(this.drawInterval);
            }
        }, 300); // 300ms for a better "revision" experience
    }

    private drawInterval: any = null;

    public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.videobingo;

        drawMinigameBackground(ctx, w, h, theme);
        drawMinigameTitle(ctx, w, h, theme, 'VÍDEO BINGO NEON');

        this.drawCards(ctx, w, h, theme);
        this.drawUIOverlay(ctx, w, h, theme);

        if (this.game.phase === 'result') {
            this.drawResult(ctx, w, h, theme);
        } else if (this.game.phase === 'betting') {
            const bmanager = (window as any).bmanager;
            const isBroke = (bmanager?.playerMoney || 0) < this.game.betAmount;
            const hint = isBroke ? 'SALDO INSUFICIENTE - ESC PARA SAIR' : (mobile ? `←→ Alterar (R$${this.game.betAmount}) • [OK] Comprar` : `SETAS ALTERAR VALOR (R$${this.game.betAmount}) • ESPAÇO COMPRAR ENTRADA`);
            drawMinigameFooter(ctx, w, h, theme, hint);
        } else if (this.game.phase === 'picking') {
            const hint = mobile ? '[DPAD] Selecionar • [OK] Escolher' : 'SETAS SELECIONAR • ESPAÇO ESCOLHER';
            drawMinigameFooter(ctx, w, h, theme, hint);
        }
    }

    private drawCards(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const cardW = s(mobile ? 145 : 175);
        const cardH = cardW;
        const spacingX = s(mobile ? 12 : 30);
        const spacingY = s(mobile ? 18 : 30);

        const gridCX = w / 2;
        const gridCY = h * 0.46;

        this.game.cards.forEach((card, i) => {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const x = gridCX + (col - 0.5) * (cardW + spacingX);
            const y = gridCY + (row - 0.5) * (cardH + spacingY);

            const isPlayerCard = this.game.selectedCardIndex === i;
            const isSelected = this.game.phase === 'picking' && isPlayerCard;

            ctx.save();
            ctx.translate(x - cardW / 2, y - cardH / 2);

            // Glass Body
            ctx.fillStyle = 'rgba(20, 10, 40, 0.7)';
            ctx.beginPath();
            ctx.roundRect(0, 0, cardW, cardH, s(12));
            ctx.fill();

            // Border / Glow
            if (isSelected) {
                const pulse = Math.sin(Date.now() * 0.01) * 5 + 10;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = s(3);
                ctx.shadowBlur = s(pulse);
                ctx.shadowColor = theme.accent;
            } else if (isPlayerCard && this.game.phase !== 'picking') {
                ctx.strokeStyle = '#4ade80';
                ctx.lineWidth = s(2);
            } else {
                ctx.strokeStyle = theme.accent + '33';
                ctx.lineWidth = 1;
                if (this.game.phase === 'picking') ctx.globalAlpha = 0.4;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Player Label
            ctx.fillStyle = isPlayerCard ? '#fff' : theme.textMuted;
            ctx.font = `800 ${r(10)}px ${theme.bodyFont}`;
            ctx.textAlign = 'left';
            const displayName = (this.game.phase === 'picking' && !isPlayerCard) ? "???" : card.playerName;
            ctx.fillText(displayName.toUpperCase(), s(4), -s(8));

            // Numbers Grid
            const cellS = cardW / 5;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let r_ = 0; r_ < 5; r_++) {
                for (let c_ = 0; c_ < 5; c_++) {
                    const val = card.numbers[r_][c_];
                    const marked = card.marked[r_][c_];
                    const cx_ = c_ * cellS + cellS / 2;
                    const cy_ = r_ * cellS + cellS / 2;

                    if (marked) {
                        ctx.fillStyle = isPlayerCard ? 'rgba(74, 222, 128, 0.25)' : 'rgba(123, 45, 255, 0.15)';
                        ctx.beginPath();
                        ctx.arc(cx_, cy_, cellS * 0.42, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    if (val !== 0 && val === this.game.lastDrawnNumber) {
                        ctx.strokeStyle = '#fde047';
                        ctx.lineWidth = s(2);
                        ctx.strokeRect(c_ * cellS + s(2), r_ * cellS + s(2), cellS - s(4), cellS - s(4));
                    }

                    ctx.fillStyle = marked ? '#fff' : 'rgba(255,255,255,0.25)';
                    ctx.font = `700 ${r(mobile ? 11 : 13)}px ${theme.bodyFont}`;
                    ctx.fillText(val === 0 ? "★" : val.toString(), cx_, cy_);
                }
            }

            ctx.restore();
        });
    }

    private drawUIOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Current Ball
        if (this.game.lastDrawnNumber) {
            const bx = w / 2;
            const by = h * 0.82;
            const br = s(38);

            ctx.fillStyle = theme.accent;
            ctx.shadowBlur = s(25);
            ctx.shadowColor = theme.accent;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#111';
            ctx.font = `bold ${r(30)}px ${theme.titleFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.game.lastDrawnNumber.toString(), bx, by);
        }

        // History tray
        const history = this.game.drawnHistory;
        if (history.length > 0) {
            const trayY = h * 0.92;
            const ballR = s(10);
            const gap = s(6);
            const recent = history.slice(-15);
            const totalW = recent.length * (ballR * 2 + gap);
            let curX = w / 2 - totalW / 2 + ballR;

            recent.forEach((num, i) => {
                const isLatest = i === recent.length - 1;
                ctx.fillStyle = isLatest ? '#fff' : 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.arc(curX, trayY, ballR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = isLatest ? '#000' : '#fff';
                ctx.font = `700 ${r(8)}px ${theme.bodyFont}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(num.toString(), curX, trayY);
                curX += ballR * 2 + gap;
            });
        }
    }

    private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = 'rgba(10, 5, 20, 0.92)';
        ctx.fillRect(0, 0, w, h);

        const won = this.game.winners.includes(this.game.selectedCardIndex);
        const color = won ? '#4ade80' : '#f87171';

        ctx.fillStyle = color;
        ctx.font = `bold ${r(58)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';

        let txt = "DERROTA";
        if (this.game.winnerNames.length > 1) txt = "EMPATE!";
        else if (won) txt = "BINGO!";
        else if (this.game.winnerNames[0]) txt = `${this.game.winnerNames[0].toUpperCase()} VENCEU!`;

        ctx.shadowBlur = s(30);
        ctx.shadowColor = color;
        ctx.fillText(txt, w / 2, h / 2 - s(20));
        ctx.shadowBlur = 0;

        if (won) {
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${r(28)}px ${theme.bodyFont}`;
            ctx.fillText(`+ R$ ${this.game.totalPayout}`, w / 2, h / 2 + s(40));
        }

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(12)}px ${theme.bodyFont}`;
        const mobile = isMobile();
        ctx.fillText(mobile ? '[OK] Reiniciar' : 'ESPAÇO PARA REINICIAR', w / 2, h * 0.8);
    }
}
