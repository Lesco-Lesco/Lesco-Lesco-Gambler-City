import { PokerGame } from './PokerGame';
import type { IMinigameUI } from './BaseMinigame';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';

export class PokerUI implements IMinigameUI {
    private game: PokerGame;
    private input: InputManager;
    private onExit: () => void;

    constructor(game: PokerGame, onExit: () => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onExit = onExit;
    }

    public update(_dt: number) {
        const bmanager = BichoManager.getInstance();

        const humanCurrentBet = () => this.game.players[0].currentBet;

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
                    this.game.startMatch();
                } else {
                    bmanager.addNotification("Saldo insuficiente!", 2);
                }
            }
        } else if (this.game.phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                const profit = this.game.settle();
                bmanager.playerMoney += (humanCurrentBet() + profit); // Simplify refund
                this.game.reset();
            }
        } else {
            // Mid-game phases
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                this.game.nextPhase();
            }
        }

        if (this.input.wasPressed('Escape')) {
            if (this.game.phase !== 'betting') {
                bmanager.addNotification("Termine a partida primeiro!", 2);
            } else {
                this.onExit();
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const cx = screenW / 2;
        const cy = screenH / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, screenW, screenH);

        // Poker Table (Green Felt)
        ctx.fillStyle = '#0a3a0a';
        ctx.beginPath();
        ctx.roundRect(cx - s(300), cy - s(150), s(600), s(300), s(150));
        ctx.fill();
        ctx.strokeStyle = '#daa520';
        ctx.lineWidth = s(4);
        ctx.stroke();

        // Community Cards
        this.drawCommunityCards(ctx, cx, cy, this.game.communityCards);

        // Pot
        ctx.fillStyle = '#ff0';
        ctx.font = `${UIScale.r(12)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillText(`POT: R$${this.game.pot}`, cx, cy - s(50));

        // Players
        this.drawPlayer(ctx, cx, cy + s(180), this.game.players[0], true);   // Bottom: Human
        this.drawPlayer(ctx, cx - s(250), cy - s(200), this.game.players[1], false); // Top Left: NPC
        this.drawPlayer(ctx, cx + s(250), cy - s(200), this.game.players[2], false); // Top Right: NPC

        // Instructions
        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(8)}px "Press Start 2P"`;
        if (this.game.phase === 'betting') {
            ctx.fillText(`Aposta (BB): R$${this.game.betAmount}`, cx, cy + s(50));
            ctx.fillText('[↑/↓] Ajustar  [Enter] Jogar', cx, cy + s(80));
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#4f4';
            ctx.fillText(this.game.resultMessage, cx, cy + s(50));
            ctx.fillStyle = '#fff';
            ctx.fillText('[Enter] Continuar', cx, cy + s(80));
        } else {
            ctx.fillText('[Enter] Próxima fase', cx, cy + s(50));
        }
    }

    private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, player: any, isMain: boolean) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(10)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name, x, y);

        // Cards
        const cardW = s(40);
        const cardH = s(60);
        player.hand.forEach((card: any, i: number) => {
            const cardX = x - cardW + i * (cardW + s(5));
            const cardY = y + s(10);

            if (isMain || this.game.phase === 'result') {
                this.drawCard(ctx, cardX, cardY, cardW, cardH, card);
            } else {
                // Card back
                ctx.fillStyle = '#800';
                ctx.fillRect(cardX, cardY, cardW, cardH);
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(cardX + s(2), cardY + s(2), cardW - s(4), cardH - s(4));
            }
        });
    }

    private drawCommunityCards(ctx: CanvasRenderingContext2D, x: number, y: number, cards: any[]) {
        const s = UIScale.s.bind(UIScale);
        const cardW = s(45);
        const cardH = s(65);
        const spacing = cardW + s(10);
        const startX = x - (2 * spacing + cardW / 2);

        for (let i = 0; i < 5; i++) {
            const cardX = startX + i * spacing;
            const cardY = y - cardH / 2;
            if (i < cards.length) {
                this.drawCard(ctx, cardX, cardY, cardW, cardH, cards[i]);
            } else {
                // Empty slot
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.strokeRect(cardX, cardY, cardW, cardH);
            }
        }
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, card: any) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x, y, w, h);

        const isRed = card.suit === 'H' || card.suit === 'D';
        ctx.fillStyle = isRed ? '#f00' : '#000';
        ctx.font = `bold ${UIScale.r(12)}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(card.value, x + s(2), y + s(15));

        ctx.textAlign = 'center';
        const suitIcon = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' }[card.suit as 'H' | 'D' | 'C' | 'S'];
        ctx.fillText(suitIcon, x + w / 2, y + h / 2 + s(5));
    }
}
