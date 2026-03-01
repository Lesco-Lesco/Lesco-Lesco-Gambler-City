import { BlackjackGame } from './BlackjackGame';
import type { IMinigameUI } from './BaseMinigame';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';

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

        if (this.game.phase === 'betting') {
            const step = 10;
            if (this.input.wasPressed('ArrowUp')) {
                this.game.betAmount = Math.min(this.game.betAmount + step, bmanager.playerMoney, this.game.maxBet);
            }
            if (this.input.wasPressed('ArrowDown')) {
                this.game.betAmount = Math.max(this.game.betAmount - step, this.game.minBet);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.deal();
                } else {
                    bmanager.addNotification("Saldo insuficiente!", 2);
                }
            }
        } else if (this.game.phase === 'playing') {
            if (this.input.wasPressed('KeyH')) this.game.hit();
            if (this.input.wasPressed('KeyS')) this.game.stand();
        } else if (this.game.phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                const profit = this.game.settle();
                const payout = this.game.betAmount + profit;
                this.onExit(payout);
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
        const cx = screenW / 2;
        const cy = screenH / 2;

        // Background Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, screenW, screenH);

        // Table
        ctx.fillStyle = '#1a4a1a';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s(50), s(350), s(250), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#daa520'; // Gold border
        ctx.lineWidth = s(5);
        ctx.stroke();

        // Dealer Hand
        this.drawHand(ctx, cx, cy - s(100), this.game.dealerHand, this.game.phase === 'playing');

        // Player Hand
        this.drawHand(ctx, cx, cy + s(150), this.game.playerHand, false);

        // Points
        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(14)}px "Press Start 2P"`;
        ctx.textAlign = 'center';

        if (this.game.phase !== 'betting') {
            ctx.fillText(`Player: ${this.game.calculatePoints(this.game.playerHand)}`, cx, cy + s(280));
            if (this.game.phase !== 'playing') {
                ctx.fillText(`Dealer: ${this.game.calculatePoints(this.game.dealerHand)}`, cx, cy - s(230));
            }
        }

        // UI Text based on phase
        ctx.shadowBlur = 0;
        if (this.game.phase === 'betting') {
            ctx.font = `bold ${UIScale.r(32)}px "Press Start 2P"`;
            ctx.fillStyle = '#daa520';
            ctx.fillText('BLACKJACK', cx, cy - s(30));

            ctx.font = `bold ${UIScale.r(20)}px "Press Start 2P"`;
            ctx.fillStyle = '#fff';
            ctx.fillText(`Aposta: R$${this.game.betAmount}`, cx, cy + s(30));

            ctx.font = `${UIScale.r(14)}px "Press Start 2P"`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText('[↑/↓] Ajustar  [Enter] Apostar', cx, cy + s(70));
        } else if (this.game.phase === 'playing') {
            ctx.font = `bold ${UIScale.r(18)}px "Press Start 2P"`;
            ctx.fillStyle = '#daa520';
            ctx.fillText('[H] HIT  [S] STAND', cx, cy + s(30));
        } else if (this.game.phase === 'result') {
            ctx.font = `bold ${UIScale.r(24)}px "Press Start 2P"`;
            ctx.fillStyle = this.game.winner === 'player' ? '#4f4' : (this.game.winner === 'push' ? '#ff4' : '#f44');
            ctx.fillText(this.game.resultMessage.toUpperCase(), cx, cy + s(30));
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = `${UIScale.r(14)}px "Press Start 2P"`;
            ctx.fillText('[Enter] Nova Partida', cx, cy + s(70));
        }
    }

    private drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, hand: any[], hideFirst: boolean) {
        const s = UIScale.s.bind(UIScale);
        const cardW = s(60);
        const cardH = s(90);
        const spacing = s(70);

        const startX = x - ((hand.length - 1) * spacing) / 2;

        hand.forEach((card, i) => {
            const cardX = startX + i * spacing - cardW / 2;
            const cardY = y - cardH / 2;

            // Simple Card Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(cardX + s(4), cardY + s(4), cardW, cardH);

            if (hideFirst && i === 0) {
                // Card Back
                ctx.fillStyle = '#800';
                ctx.fillRect(cardX, cardY, cardW, cardH);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = s(2);
                ctx.strokeRect(cardX + s(4), cardY + s(4), cardW - s(8), cardH - s(8));
            } else {
                // Card Front
                ctx.fillStyle = '#fff';
                ctx.fillRect(cardX, cardY, cardW, cardH);

                ctx.fillStyle = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#f00' : '#000';
                ctx.font = `bold ${UIScale.r(16)}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(card.value, cardX + s(5), cardY + s(20));

                const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit as 'hearts' | 'diamonds' | 'clubs' | 'spades'];
                ctx.font = `bold ${UIScale.r(24)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(suitIcon, cardX + cardW / 2, cardY + cardH / 2 + s(10));
            }

            ctx.strokeStyle = '#000';
            ctx.lineWidth = s(1);
            ctx.strokeRect(cardX, cardY, cardW, cardH);
        });
    }
}
