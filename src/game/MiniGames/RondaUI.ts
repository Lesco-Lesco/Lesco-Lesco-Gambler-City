import { RondaGame } from './RondaGame';
import type { Card } from './RondaGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class RondaUI {
    private game: RondaGame;
    private hasSettled: boolean = false;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: RondaGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);

        // Background - Dark Green felt texture feel but modern
        const grad = ctx.createRadialGradient(width / 2, height / 2, s(50), width / 2, height / 2, width);
        grad.addColorStop(0, 'rgba(10, 40, 20, 0.98)');
        grad.addColorStop(1, 'rgba(5, 20, 10, 1.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;

        // Title
        ctx.shadowBlur = s(15);
        ctx.shadowColor = '#44ff44';
        ctx.fillStyle = '#44ff44';
        ctx.font = `bold ${UIScale.r(48 * fScale)}px "Segoe UI", "Roboto", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("RONDA", cx, s(mobile ? 40 : 60));
        ctx.shadowBlur = 0;

        // Betting Info
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#aaa';
            ctx.font = `bold ${UIScale.r(20 * fScale)}px "Segoe UI", sans-serif`;
            ctx.fillText("SUA APOSTA", cx, s(mobile ? 80 : 110));

            ctx.fillStyle = '#ffff00';
            ctx.font = `bold ${UIScale.r(64 * (mobile ? 1.0 : fScale))}px "Segoe UI", sans-serif`;
            ctx.shadowBlur = s(20);
            ctx.shadowColor = 'rgba(255, 255, 0, 0.3)';
            ctx.fillText(`R$ ${this.game.betAmount}`, cx, s(mobile ? 140 : 185));
            ctx.shadowBlur = 0;
        }

        // Objective Cards Area
        const objY = s(mobile ? 290 : 360);
        const containerW = mobile ? width - s(20) : s(560);
        const containerH = mobile ? s(230) : s(260);

        // Container for Objectives
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(cx - containerW / 2, objY - containerH / 2 - s(10), containerW, containerH, s(20));
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#eee';
        ctx.font = `bold ${UIScale.r(16 * fScale)}px "Segoe UI", sans-serif`;
        ctx.fillText("ESCOLHA UMA CARTA PARA APOSTAR", cx, objY - (containerH / 2) + s(mobile ? 15 : 20));

        const cardW = s(mobile ? 115 : 120);
        const cardH = s(mobile ? 170 : 180);
        const cardSpacing = mobile ? s(75) : s(110);

        this.drawCard(ctx, cx - cardSpacing, objY + (mobile ? s(10) : 0), this.game.objectiveCards[0], this.game.playerChoiceIndex === 0, false, cardW, cardH);
        this.drawCard(ctx, cx + cardSpacing, objY + (mobile ? s(10) : 0), this.game.objectiveCards[1], this.game.playerChoiceIndex === 1, false, cardW, cardH);

        // Selection Indicators
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `bold ${UIScale.r(32 * fScale)}px "Segoe UI", sans-serif`;
            const triY = objY + (cardH / 2) + (mobile ? s(35) : s(30));
            ctx.fillText(this.game.playerChoiceIndex === 0 ? "▲" : "", cx - cardSpacing, triY);
            ctx.fillText(this.game.playerChoiceIndex === 1 ? "▲" : "", cx + cardSpacing, triY);
        }

        // Community Cards (The reveal pile) - CENTER PILE
        const pileY = s(mobile ? 540 : 640);
        ctx.textAlign = 'center';
        const pileCardW = s(mobile ? 130 : 130);
        const pileCardH = s(mobile ? 190 : 200);

        if (this.game.communityCards.length > 0) {
            const lastCard = this.game.communityCards[this.game.communityCards.length - 1];
            this.drawCard(ctx, cx, pileY, lastCard, false, true, pileCardW, pileCardH);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${UIScale.r(20 * fScale)}px \"Segoe UI\", sans-serif`;
            ctx.fillText("CARTA REVELADA", cx, pileY - (pileCardH / 2) - s(25));
        } else {
            // Deck back
            this.drawCardBack(ctx, cx, pileY, pileCardW, pileCardH);
            ctx.fillStyle = '#aaa';
            ctx.font = `bold ${UIScale.r(18 * fScale)}px \"Segoe UI\", sans-serif`;
            ctx.fillText("BARALHO", cx, pileY - (pileCardH / 2) - s(25));
        }

        // Status
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${UIScale.r(28 * fScale)}px \"Segoe UI\", sans-serif`;
        ctx.shadowBlur = s(10);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(this.game.message, cx, height - s(mobile ? 110 : 100));
        ctx.shadowBlur = 0;

        // Controls
        this.drawControlsUI(ctx, cx, height - s(mobile ? 35 : 40));
    }

    private drawControlsUI(ctx: CanvasRenderingContext2D, x: number, y: number) {
        const mobile = isMobile();
        const fScale = mobile ? 1.3 : 1.0;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(14 * fScale)}px \"Segoe UI\", sans-serif`;
        ctx.textAlign = 'center';

        if (this.game.phase === 'betting') {
            const betHint = mobile
                ? '[D-Pad ↑↓] Aposta   [D-Pad ←→] Carta   [OK] JOGAR'
                : '[↑/↓] Valor da Aposta   [←/→] Escolher Carta   [ESPAÇO] JOGAR';
            ctx.fillText(betHint, x, y);
        } else {
            const playHint = mobile
                ? '[OK] Continuar   [✕] Sair'
                : '[ESPAÇO] Continuar   [ESC] Sair';
            ctx.fillText(playHint, x, y);
        }
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, card: Card, selected: boolean = false, highlight: boolean = false, w: number = 60, h: number = 90) {
        const s = UIScale.s.bind(UIScale);
        ctx.save();
        // Selection Glow
        if (selected) {
            ctx.shadowBlur = s(30);
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
            ctx.beginPath();
            ctx.roundRect(x - w / 2 - s(10), y - h / 2 - s(10), w + s(20), h + s(20), s(10));
            ctx.fill();
        }
        if (highlight) {
            ctx.shadowBlur = s(40);
            ctx.shadowColor = '#ffffff';
        }

        // Card Body
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, s(8));
        ctx.fill();
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Content
        const ranks = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
        const suits = { 'ouros': '♦', 'espadas': '♠', 'copas': '♥', 'paus': '♣' };

        ctx.fillStyle = (card.suit === 'copas' || card.suit === 'ouros') ? '#dd0000' : '#222';

        // Larger fonts for larger cards
        const fontSize = Math.floor(h * 0.35);
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(ranks[card.rank - 1], x, y - h * 0.15);

        const suitSize = Math.floor(h * 0.4);
        ctx.font = `${suitSize}px Arial`;
        ctx.fillText(suits[card.suit], x, y + h * 0.35);

        // Mini rank/suit in corners
        ctx.font = `bold ${Math.floor(fontSize * 0.4)}px "Segoe UI", Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(ranks[card.rank - 1], x - w / 2 + s(8), y - h / 2 + s(24));
        ctx.textAlign = 'right';
        ctx.fillText(ranks[card.rank - 1], x + w / 2 - s(8), y + h / 2 - s(10));

        ctx.restore();
    }

    private drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number = 60, h: number = 90) {
        const s = UIScale.s.bind(UIScale);
        // Modern Pattern Back
        ctx.fillStyle = '#882222';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, s(8));
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = s(4);
        ctx.stroke();

        // Pattern
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(x - w / 2 + s(10), y - h / 2 + s(10), w - s(20), h - s(20), s(4));
        ctx.fill();

        // Center Design
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(x, y, w / 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            this.hasSettled = false;

            // Adjust bet
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.game.betAmount = Math.min(this.game.maxBet, this.game.betAmount + 10);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.game.betAmount = Math.max(this.game.minBet, this.game.betAmount - 10);
            }

            // Start game
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(0);
                }
            }
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.chooseCard(1);
                }
            }
        } else if (this.game.phase === 'result') {
            // Settle once
            if (!this.hasSettled) {
                this.hasSettled = true;
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                this.onPlayAgain(this.game.winAmount);
                this.game.reset();
            } else if (input.wasPressed('Escape') || input.wasPressed('KeyE')) {
                this.onClose(this.game.winAmount);
            }
        }
    }
}
