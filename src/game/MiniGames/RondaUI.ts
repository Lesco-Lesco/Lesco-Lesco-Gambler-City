import { RondaGame } from './RondaGame';
import type { Card } from './RondaGame';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';

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
        // Background - Dark Green felt texture feel but modern
        const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
        grad.addColorStop(0, 'rgba(10, 40, 20, 0.98)');
        grad.addColorStop(1, 'rgba(5, 20, 10, 1.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;

        // Title
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#44ff44';
        ctx.fillStyle = '#44ff44';
        ctx.font = 'bold 48px "Segoe UI", "Roboto", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("RONDA", cx, 60);
        ctx.shadowBlur = 0;

        // Betting Info
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#aaa';
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.fillText("SUA APOSTA", cx, 110);

            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 72px "Segoe UI", sans-serif';
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(255, 255, 0, 0.3)';
            ctx.fillText(`R$ ${this.game.betAmount}`, cx, 185);
            ctx.shadowBlur = 0;
        }

        // Objective Cards Area
        const objY = 360;

        // Container for Objectives
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(cx - 280, objY - 140, 560, 260, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#aaa';
        ctx.font = '600 15px "Segoe UI", sans-serif';
        ctx.fillText("ESCOLHA UMA CARTA PARA APOSTAR", cx, objY - 110);

        this.drawCard(ctx, cx - 110, objY, this.game.objectiveCards[0], this.game.playerChoiceIndex === 0, false, 120, 180);
        this.drawCard(ctx, cx + 110, objY, this.game.objectiveCards[1], this.game.playerChoiceIndex === 1, false, 120, 180);

        // Selection Indicators
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 32px "Segoe UI", sans-serif';
            ctx.fillText(this.game.playerChoiceIndex === 0 ? "▲" : "", cx - 110, objY + 130);
            ctx.fillText(this.game.playerChoiceIndex === 1 ? "▲" : "", cx + 110, objY + 130);
        }

        // Community Cards (The reveal pile) - CENTER PILE
        const pileY = 640;
        ctx.textAlign = 'center';
        if (this.game.communityCards.length > 0) {
            const lastCard = this.game.communityCards[this.game.communityCards.length - 1];
            this.drawCard(ctx, cx, pileY, lastCard, false, true, 130, 200);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px "Segoe UI", sans-serif';
            ctx.fillText("CARTA REVELADA", cx, pileY - 130);
        } else {
            // Deck back
            this.drawCardBack(ctx, cx, pileY, 130, 200);
            ctx.fillStyle = '#aaa';
            ctx.font = '600 16px "Segoe UI", sans-serif';
            ctx.fillText("BARALHO", cx, pileY - 130);
        }

        // Status
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px "Segoe UI", sans-serif';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(this.game.message, cx, height - 100);
        ctx.shadowBlur = 0;

        // Controls
        this.drawControlsUI(ctx, cx, height - 40);
    }

    private drawControlsUI(ctx: CanvasRenderingContext2D, x: number, y: number) {
        ctx.fillStyle = '#888';
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';

        if (this.game.phase === 'betting') {
            const betHint = isMobile()
                ? '[D-Pad ↑↓] Aposta   [D-Pad ←→] Carta   [OK] JOGAR'
                : '[↑/↓] Valor da Aposta   [←/→] Escolher Carta   [ESPAÇO] JOGAR';
            ctx.fillText(betHint, x, y);
        } else {
            const playHint = isMobile()
                ? '[OK] Continuar   [✕] Sair'
                : '[ESPAÇO] Continuar   [ESC] Sair';
            ctx.fillText(playHint, x, y);
        }
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, card: Card, selected: boolean = false, highlight: boolean = false, w: number = 60, h: number = 90) {
        ctx.save(); // Protect global state (alignment, shadow, etc.)
        // Selection Glow
        if (selected) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
            ctx.beginPath();
            ctx.roundRect(x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20, 10);
            ctx.fill();
        }
        if (highlight) {
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#ffffff';
        }

        // Card Body
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset glow

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
        ctx.font = `${suitSize}px Arial`; // Suit symbols render better in standard fonts
        ctx.fillText(suits[card.suit], x, y + h * 0.35);

        // Mini rank/suit in corners
        ctx.font = `bold ${Math.floor(fontSize * 0.4)}px "Segoe UI", Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(ranks[card.rank - 1], x - w / 2 + 8, y - h / 2 + 24);
        ctx.textAlign = 'right';
        ctx.fillText(ranks[card.rank - 1], x + w / 2 - 8, y + h / 2 - 10);

        ctx.restore();
    }

    private drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number = 60, h: number = 90) {
        // Modern Pattern Back
        ctx.fillStyle = '#882222';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Pattern
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20, 4);
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
                // We don't update money here directly, we wait for the trigger or call the callback
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
