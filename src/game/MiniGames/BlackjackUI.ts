import { BlackjackGame } from './BlackjackGame';
import type { IMinigameUI } from './BaseMinigame';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';

export class BlackjackUI implements IMinigameUI {
    private game: BlackjackGame;
    private input: InputManager;
    private onExit: (payout: number) => void;

    constructor(game: BlackjackGame, onExit: (payout: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onExit = onExit;
    }

    public update(_dt: number) {
        const bmanager = BichoManager.getInstance();
        const mobile = isMobile();

        if (this.game.phase === 'betting') {
            const step = 10;
            if (this.input.wasPressed('ArrowUp')) {
                this.game.betAmount = Math.min(this.game.betAmount + step, bmanager.playerMoney, this.game.maxBet);
            }
            if (this.input.wasPressed('ArrowDown')) {
                this.game.betAmount = Math.max(this.game.betAmount - step, this.game.minBet);
            }
            const okPressed = this.input.wasPressed('Enter') || this.input.wasPressed('Space');
            if (okPressed) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.deal();
                    SoundManager.getInstance().play('card_deal');
                } else {
                    bmanager.addNotification("Saldo insuficiente!", 2);
                }
            }
        } else if (this.game.phase === 'playing') {
            const hit = this.input.wasPressed('KeyH') || (mobile && this.input.wasPressed('Space'));
            const stand = this.input.wasPressed('KeyS') || (mobile && this.input.wasPressed('KeyE'));
            if (hit) { this.game.hit(); SoundManager.getInstance().play('card_flip'); }
            if (stand) this.game.stand();
        } else if (this.game.phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                const profit = this.game.settle();
                const payout = this.game.betAmount + profit;
                if (payout > 0) {
                    bmanager.playerMoney += payout;
                    SoundManager.getInstance().play(this.game.winner === 'push' ? 'draw' : 'win_small');
                } else {
                    SoundManager.getInstance().play('lose');
                }
                this.game.reset();
            }
        }

        if (this.input.wasPressed('Escape')) {
            const payout = (this.game.phase === 'result') ? (this.game.betAmount + this.game.settle()) : 0;
            this.onExit(payout);
        }
    }


    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.blackjack;

        // Shared background and title
        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme);

        // ── Proportional Table ──
        const tableW = Math.min(screenW * 0.95, s(mobile ? 560 : 700));
        const tableH = Math.min(screenH * 0.45, s(mobile ? 240 : 340));
        const tableY = screenH * 0.5;

        const tableGrad = ctx.createRadialGradient(cx, tableY, s(50), cx, tableY, tableW / 2);
        tableGrad.addColorStop(0, theme.accentAlt);
        tableGrad.addColorStop(1, '#064e3b'); // Dark forest green

        ctx.fillStyle = tableGrad;
        ctx.beginPath();
        ctx.roundRect(cx - tableW / 2, tableY - tableH / 2, tableW, tableH, s(mobile ? 110 : 160));
        ctx.fill();

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = s(mobile ? 4 : 8);
        ctx.stroke();

        // ── Dealer Hand ──
        const dealerY = screenH * 0.28;
        this.drawHand(ctx, cx, dealerY, this.game.dealerHand, this.game.phase === 'playing', theme);

        // ── Player Hand ──
        const playerY = screenH * 0.78;
        this.drawHand(ctx, cx, playerY, this.game.playerHand, false, theme);

        // ── Score Display ──
        ctx.textAlign = 'center';
        if (this.game.phase !== 'betting') {
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${r(mobile ? 12 : 14)}px ${theme.titleFont}`;

            // Player Points (below hand)
            const pPoints = this.game.calculatePoints(this.game.playerHand);
            ctx.fillText(`PONTOS: ${pPoints}`, cx, playerY + s(mobile ? 65 : 80));

            if (this.game.phase !== 'playing') {
                // Dealer Points (above hand)
                const dPoints = this.game.calculatePoints(this.game.dealerHand);
                ctx.fillText(`DEALER: ${dPoints}`, cx, dealerY - s(mobile ? 55 : 70));
            }
        }

        // ── Phase UI ──
        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, cx, screenH * 0.55, theme);
        } else if (this.game.phase === 'playing') {
            this.drawInstructions(ctx, cx, screenH * 0.55, theme);
        } else if (this.game.phase === 'result') {
            this.drawResultUI(ctx, cx, screenH * 0.55, theme);
        }

        // Shared footer
        const footerHint = mobile ? "[EXIT] Sair" : "[ESC] Sair";
        drawMinigameFooter(ctx, screenW, screenH, theme, footerHint);
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(mobile ? 42 : 48)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(15);
        ctx.shadowColor = theme.accent + '66';
        ctx.fillText('R$ ' + this.game.betAmount, cx, cy);
        ctx.shadowBlur = 0;

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
        ctx.fillText('DEFINA SUA APOSTA', cx, cy - s(40));

        const hint = mobile ? '[DPAD] Ajustar • [OK] Apostar' : '↑↓ Ajustar • Enter Confirmar';
        ctx.font = `600 ${r(mobile ? 9 : 11)}px ${theme.bodyFont}`;
        ctx.fillText(hint, cx, cy + s(40));
    }

    private drawInstructions(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        ctx.fillStyle = '#fde047'; // Added this line from original drawControlsUI
        ctx.font = `bold ${r(mobile ? 16 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';

        const hint = mobile ? '[OK] Pedir (Hit) • [E] Parar (Stand)' : '[H] Hit • [S] Stand';
        ctx.fillText(hint, cx, cy);
    }



    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const win = this.game.winner === 'player';
        const push = this.game.winner === 'push';

        ctx.fillStyle = win ? '#4ade80' : (push ? '#fde047' : '#f87171');
        ctx.font = `bold ${r(mobile ? 28 : 32)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';

        ctx.shadowBlur = s(20);
        ctx.shadowColor = ctx.fillStyle + '66';
        ctx.fillText(this.game.resultMessage.toUpperCase(), cx, cy);
        ctx.shadowBlur = 0;

        ctx.fillStyle = theme.text;
        ctx.font = `600 ${r(mobile ? 11 : 13)}px ${theme.bodyFont}`;
        ctx.fillText(mobile ? '[OK] Rejogar' : '[ENTER] Nova Partida', cx, cy + s(40));
    }

    private drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, hand: any[], hideFirst: boolean, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const cardW = s(mobile ? 68 : 70);
        const cardH = s(mobile ? 95 : 100);
        const spacing = cardW * 1.1;

        const startX = x - ((hand.length - 1) * spacing) / 2;

        hand.forEach((card, i) => {
            const cardX = startX + i * spacing;

            ctx.save();
            ctx.translate(cardX, y);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.roundRect(-cardW / 2 + s(4), -cardH / 2 + s(4), cardW, cardH, s(8));
            ctx.fill();

            if (hideFirst && i === 0) {
                // Card Back
                ctx.fillStyle = theme.accent;
                ctx.beginPath();
                ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, s(8));
                ctx.fill();

                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = s(2);
                ctx.beginPath();
                ctx.roundRect(-cardW / 2 + s(6), -cardH / 2 + s(6), cardW - s(12), cardH - s(12), s(4));
                ctx.stroke();
            } else {
                // Card Front
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, s(8));
                ctx.fill();

                const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
                ctx.fillStyle = isRed ? '#e11d48' : '#1e293b';

                // Rank Corner
                ctx.font = `bold ${r(mobile ? 12 : 16)}px ${theme.bodyFont}`;
                ctx.textAlign = 'left';
                ctx.fillText(card.value, -cardW / 2 + s(6), -cardH / 2 + s(18));

                // Suit Icon Center
                const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit as 'hearts' | 'diamonds' | 'clubs' | 'spades'];
                ctx.font = `${r(mobile ? 28 : 36)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(suitIcon || '', 0, s(12));

                // Rank Reverse Corner
                ctx.save();
                ctx.rotate(Math.PI);
                ctx.textAlign = 'left';
                ctx.font = `bold ${r(mobile ? 12 : 16)}px ${theme.bodyFont}`;
                ctx.fillText(card.value, -cardW / 2 + s(6), -cardH / 2 + s(18));
                ctx.restore();
            }

            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        });
    }
}
