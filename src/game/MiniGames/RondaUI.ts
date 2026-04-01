import { RondaGame } from './RondaGame';
import type { Card } from './RondaGame';
import type { IMinigameUI } from './BaseMinigame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';

export class RondaUI implements IMinigameUI {
    private game: RondaGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: RondaGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const theme = MINIGAME_THEMES.ronda;

        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme);

        const cx = width / 2;
        const mobile = isMobile();

        // ── Layout Zones ──
        const labelY = height * 0.16;
        const valueY = height * 0.26;
        const cardsTop = height * 0.38;
        const cardsH = height * 0.40;

        // ── Betting Status ──
        if (this.game.phase === 'betting') {
            const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
            ctx.save();
            ctx.textBaseline = 'middle';

            ctx.fillStyle = theme.textMuted;
            ctx.font = `600 ${r(mobile ? 11 : 14)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText('VALOR DA APOSTA', cx, labelY);

            if (isBroke) {
                ctx.fillStyle = '#f87171';
                ctx.font = `bold ${r(mobile ? 20 : 26)}px ${theme.titleFont}`;
                ctx.fillText('SEM GRANA!', cx, valueY);
            } else {
                ctx.fillStyle = theme.accent;
                ctx.font = `bold ${r(mobile ? 40 : 52)}px ${theme.titleFont}`;
                ctx.shadowBlur = s(20);
                ctx.shadowColor = theme.accent + '55';
                ctx.fillText(`R$ ${this.game.betAmount}`, cx, valueY);
            }
            ctx.restore();
        }

        // ── Card Area ──
        const objSectionH = cardsH * 0.55;
        const objCenterY = cardsTop + objSectionH * 0.45;

        const cardH = Math.min(objSectionH * 0.8, s(mobile ? 120 : 150));
        const cardW = cardH * 0.7;
        const cardSpacing = Math.min(cardW * 1.5, width * 0.25);

        // Deck Container
        const containerW = Math.min(width - s(30), cardW * 2 + cardSpacing + s(50));
        const containerH = cardH + s(50);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(cx - containerW / 2, objCenterY - containerH / 2, containerW, containerH, s(16));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.stroke();

        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(mobile ? 9 : 11)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL SERÁ A PRÓXIMA?', cx, objCenterY - containerH / 2 + s(18));

        this.drawCard(ctx, cx - cardSpacing * 0.5, objCenterY + s(8), this.game.objectiveCards[0], this.game.playerChoiceIndex === 0, false, cardW, cardH, theme);
        this.drawCard(ctx, cx + cardSpacing * 0.5, objCenterY + s(8), this.game.objectiveCards[1], this.game.playerChoiceIndex === 1, false, cardW, cardH, theme);

        // Reveal Area
        const pileSectionH = cardsH * 0.45;
        const pileCenterY = cardsTop + objSectionH + pileSectionH * 0.45;
        const pileCardH = Math.min(pileSectionH * 0.85, s(mobile ? 110 : 130));
        const pileCardW = pileCardH * 0.7;

        if (this.game.communityCards.length > 0) {
            const lastCard = this.game.communityCards[this.game.communityCards.length - 1];
            this.drawCard(ctx, cx, pileCenterY, lastCard, false, true, pileCardW, pileCardH, theme);
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(mobile ? 8 : 10)}px ${theme.bodyFont}`;
            ctx.fillText('RESULTADO', cx, pileCenterY + pileCardH / 2 + s(12));
        } else {
            this.drawCardBack(ctx, cx, pileCenterY, pileCardW, pileCardH);
            ctx.fillStyle = theme.textMuted;
            ctx.font = `600 ${r(mobile ? 8 : 10)}px ${theme.bodyFont}`;
            ctx.fillText('BARALHO', cx, pileCenterY + pileCardH / 2 + s(12));
        }

        // ── Result / Status ──
        const statusY = height * 0.82;
        const msg = this.game.message.toUpperCase();

        ctx.fillStyle = theme.text;
        if (msg.includes('GANHOU')) ctx.fillStyle = '#4ade80';
        if (msg.includes('PERDEU')) ctx.fillStyle = '#f87171';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        if (msg.length > 30) ctx.font = `bold ${r(mobile ? 12 : 16)}px ${theme.bodyFont}`;

        ctx.fillText(msg, cx, statusY);

        let footerHint = '';
        if (this.game.phase === 'betting') {
            footerHint = mobile
                ? 'DPAD Ajustar • TAP para Escolher • [OK] JOGAR'
                : '↑↓ AJUSTAR APOSTA • ←→ ESCOLHER CARTA • ESPAÇO JOGAR';
        } else {
            footerHint = mobile
                ? '[OK] Reiniciar • [EXIT] Sair'
                : 'ENTER/ESPAÇO JOGAR NOVAMENTE • ESC SAIR';
        }
        drawMinigameFooter(ctx, width, height, theme, footerHint);
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, card: Card, selected = false, highlight = false, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        ctx.save();
        ctx.translate(x, y);

        if (selected) {
            ctx.shadowBlur = s(30);
            ctx.shadowColor = theme.accent;
            ctx.fillStyle = theme.accent + '15';
            ctx.beginPath();
            ctx.roundRect(-w / 2 - s(10), -h / 2 - s(10), w + s(20), h + s(20), s(14));
            ctx.fill();
        }

        if (highlight) {
            ctx.shadowBlur = s(40);
            ctx.shadowColor = '#ffffff';
        }

        // Card Face
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, s(10));
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const ranks = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
        const suits: Record<string, string> = { 'ouros': '♦', 'espadas': '♠', 'copas': '♥', 'paus': '♣' };
        const isRed = card.suit === 'copas' || card.suit === 'ouros';
        ctx.fillStyle = isRed ? '#e11d48' : '#1e293b';

        const rankText = ranks[card.rank - 1];
        const suitSymbol = suits[card.suit];

        // 1. Corners (Indices)
        const cornerSize = r(h * 0.15);
        ctx.font = `bold ${cornerSize}px ${theme.bodyFont}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Top-Left
        ctx.fillText(rankText, -w / 2 + s(6), -h / 2 + s(6));

        // Bottom-Right (Rotated)
        ctx.save();
        ctx.rotate(Math.PI);
        ctx.fillText(rankText, -w / 2 + s(6), -h / 2 + s(6));
        ctx.restore();

        // 2. Center (Large Suit Symbol)
        const centerSuitSize = r(h * 0.5);
        ctx.font = `${centerSuitSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(suitSymbol, 0, 0);

        ctx.restore();
    }

    private drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, s(10));
        ctx.fill();

        // Pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = s(3);
        ctx.beginPath();
        ctx.roundRect(x - w / 2 + s(8), y - h / 2 + s(8), w - s(16), h - s(16), s(5));
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.arc(x, y, w / 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = s(1.5);
        ctx.stroke();
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            this.hasSettled = false;
            const { step } = EconomyManager.getInstance().getBetLimits();

            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.game.betAmount = Math.min(this.game.maxBet, this.game.betAmount + step);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.game.betAmount = Math.max(this.game.minBet, this.game.betAmount - step);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(0);
                    SoundManager.getInstance().play('card_deal');
                }
            }
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD') || input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('KeyE')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(1);
                    SoundManager.getInstance().play('card_deal');
                }
            }
        } else if (this.game.phase === 'result') {
            if (!this.hasSettled) {
                this.hasSettled = true;
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const bmanager = BichoManager.getInstance();
                const totalMoney = bmanager.playerMoney + this.game.winAmount;
                
                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onClose(this.game.winAmount); // Exit if broke
                } else {
                    SoundManager.getInstance().play(this.game.winAmount > 0 ? 'win_small' : 'lose');
                    this.onPlayAgain(this.game.winAmount);
                    this.game.reset();
                }
            }
        }

        if (input.wasPressed('Escape')) {
            const finalPayout = (this.game.phase === 'result') ? this.game.winAmount : 0;
            this.onClose(finalPayout);
        }
    }
}
