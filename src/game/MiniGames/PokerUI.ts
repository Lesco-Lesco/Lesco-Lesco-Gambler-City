import { PokerGame } from './PokerGame';
import type { IMinigameUI } from './BaseMinigame';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';

export class PokerUI implements IMinigameUI {
    private game: PokerGame;
    private input: InputManager;
    private onExit: (payout: number) => void;
    private pendingRaise: number = 0;

    constructor(game: PokerGame, onExit: (payout: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onExit = onExit;
    }

    public update(_dt: number) {
        const bmanager = BichoManager.getInstance();
        const mobile = isMobile();
        const humanCurrentBet = () => this.game.players[0].currentBet;

        if (this.game.phase === 'betting') {
            this.game.betAmount = 10;
            const okPressed = this.input.wasPressed('Enter') || this.input.wasPressed('Space');
            if (okPressed) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startMatch();
                    this.pendingRaise = 0;
                } else {
                    bmanager.addNotification("Saldo insuficiente para aposta mínima!", 2);
                }
            }
        } else if (this.game.phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                const profit = this.game.settle();
                const payout = humanCurrentBet() + profit;
                this.onExit(payout);
                this.game.reset();
            }
        } else {
            // Mid-game phases
            if (this.game.phase === 'pre_flop') {
                const step = 10;
                const up = this.input.wasPressed('ArrowUp') || (mobile && this.input.wasPressed('KeyW'));
                const down = this.input.wasPressed('ArrowDown') || (mobile && this.input.wasPressed('KeyS'));

                if (up) {
                    this.pendingRaise = Math.min(this.pendingRaise + step, bmanager.playerMoney);
                }
                if (down) {
                    this.pendingRaise = Math.max(0, this.pendingRaise - step);
                }

                if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                    if (this.pendingRaise > 0) {
                        if (bmanager.playerMoney >= this.pendingRaise) {
                            bmanager.playerMoney -= this.pendingRaise;
                            this.game.raiseHand(this.pendingRaise);
                            this.pendingRaise = 0;
                        } else {
                            bmanager.addNotification("Saldo insuficiente para aumentar!", 2);
                            return;
                        }
                    }
                    this.game.nextPhase();
                }
            } else {
                if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
                    this.game.nextPhase();
                }
            }
        }

        if (this.input.wasPressed('Escape')) {
            const payout = (this.game.phase === 'result') ? (humanCurrentBet() + this.game.settle()) : 0;
            this.onExit(payout);
        }
    }


    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;
        const cy = screenH / 2;
        const mobile = isMobile();

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, screenW, screenH);

        // Poker Table (Green Felt)
        ctx.fillStyle = '#0a3a0a';
        ctx.beginPath();
        const tableW = mobile ? s(540) : s(600);
        const tableH = mobile ? s(220) : s(300);
        ctx.roundRect(cx - tableW / 2, cy - tableH / 2, tableW, tableH, s(mobile ? 100 : 150));
        ctx.fill();
        ctx.strokeStyle = '#daa520';
        ctx.lineWidth = s(mobile ? 2.5 : 4);
        ctx.stroke();

        // Community Cards
        const commY = mobile ? cy - s(10) : cy;
        this.drawCommunityCards(ctx, cx, commY, this.game.communityCards);

        // Pot
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${r(mobile ? 14 : 18)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(8);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(`POT: R$${this.game.pot}`, cx, cy - (mobile ? s(45) : s(60)));
        ctx.shadowBlur = 0;

        // Players
        const playerY = mobile ? cy + s(105) : cy + s(180);
        const npcY = mobile ? cy - s(142) : cy - s(200);
        const npcXOff = mobile ? s(180) : s(250);

        this.drawPlayer(ctx, cx, playerY, this.game.players[0], true);   // Bottom: Human
        this.drawPlayer(ctx, cx - npcXOff, npcY, this.game.players[1], false); // Top Left: NPC
        this.drawPlayer(ctx, cx + npcXOff, npcY, this.game.players[2], false); // Top Right: NPC

        // Instructions
        ctx.fillStyle = '#fff';
        ctx.font = `${r(mobile ? 9 : 12)}px "Press Start 2P"`;
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Aposta (BB): R$${this.game.betAmount}`, cx, cy + s(mobile ? 35 : 50));
            ctx.fillStyle = '#fff';
            ctx.font = `${r(mobile ? 9 : 11)}px "Press Start 2P"`;
            const hint = mobile ? '[+/-] Ajustar  [OK] Confirmar' : '[↑/↓] Ajustar  [Enter] Confirmar';
            ctx.fillText(hint, cx, cy + s(mobile ? 65 : 85));
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#4f4';
            ctx.font = `${r(mobile ? 12 : 16)}px "Press Start 2P"`;
            ctx.fillText(this.game.resultMessage.toUpperCase(), cx, cy + s(mobile ? 40 : 50));
            ctx.fillStyle = '#fff';
            ctx.font = `${r(mobile ? 9 : 11)}px "Press Start 2P"`;
            ctx.fillText(mobile ? '[OK] Continuar' : '[Enter] Continuar', cx, cy + s(mobile ? 65 : 85));
        } else if (this.game.phase === 'pre_flop') {
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Aumentar? R$${this.pendingRaise}`, cx, cy + s(mobile ? 35 : 50));
            ctx.fillStyle = '#fff';
            ctx.font = `${r(mobile ? 9 : 11)}px "Press Start 2P"`;
            const hint = mobile ? '[+/-] Ajustar  [OK] Confirmar' : '[↑/↓] Ajustar  [Enter] Confirmar';
            ctx.fillText(hint, cx, cy + s(mobile ? 65 : 85));
        } else {
            ctx.fillText(mobile ? '[OK] Próxima fase' : '[Enter] Próxima fase', cx, cy + s(mobile ? 45 : 60));
        }
    }

    private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, player: any, isMain: boolean) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(14)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(4);
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.fillText(player.name.toUpperCase(), x, y);
        ctx.shadowBlur = 0;

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
        ctx.fillStyle = isRed ? '#cc0000' : '#111';
        ctx.font = `bold ${UIScale.r(16)}px Arial`; // Increased from 12
        ctx.textAlign = 'left';
        ctx.fillText(card.value, x + s(2), y + s(18));

        ctx.textAlign = 'center';
        const suitIcon = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' }[card.suit as 'H' | 'D' | 'C' | 'S'];
        ctx.font = `${UIScale.r(24)}px Arial`; // Increased icon size
        ctx.fillText(suitIcon, x + w / 2, y + h / 2 + s(8));
    }
}
