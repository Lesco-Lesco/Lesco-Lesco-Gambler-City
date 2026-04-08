import { PokerGame } from './PokerGame';
import type { IMinigameUI } from './BaseMinigame';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import { EconomyManager } from '../Core/EconomyManager';

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
            const { min } = EconomyManager.getInstance().getBetLimits();
            this.game.betAmount = min;
            const okPressed = this.input.wasPressed('Enter') || this.input.wasPressed('Space');
            if (okPressed || this.input.wasPressed('KeyE')) {
                if (bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startMatch();
                    this.pendingRaise = 0;
                    SoundManager.getInstance().play('bet_place');
                    SoundManager.getInstance().play('card_deal');
                    SoundManager.getInstance().playArpeggio('poker');
                    SoundManager.getInstance().resetArpeggioStep('poker');
                } else {
                    bmanager.addNotification("Saldo insuficiente para aposta mínima!", 2);
                }
            }
        } else if (this.game.phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                const profit = this.game.settle();
                const payout = humanCurrentBet() + profit;
                const totalMoney = (bmanager.playerMoney + payout);

                if (payout > 0) {
                    bmanager.playerMoney += payout;
                    SoundManager.getInstance().play('win_small');
                    SoundManager.getInstance().playFanfare('poker', 'win');
                } else if (payout < 0 || profit < 0) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('poker', 'lose');
                }

                const { min } = EconomyManager.getInstance().getBetLimits();
                if (totalMoney < min) { // Dynamic min bet
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onExit(payout); // Exit if broke
                } else {
                    this.game.reset();
                }
            }
        } else {
            // Mid-game phases
            if (this.game.phase === 'pre_flop' || this.game.phase === 'flop') {
                const { step } = EconomyManager.getInstance().getBetLimits();
                const up = this.input.wasPressed('ArrowUp') || (mobile && this.input.wasPressed('KeyW'));
                const down = this.input.wasPressed('ArrowDown') || (mobile && this.input.wasPressed('KeyS'));

                if (up) {
                    this.pendingRaise = Math.min(this.pendingRaise + step, bmanager.playerMoney);
                }
                if (down) {
                    this.pendingRaise = Math.max(0, this.pendingRaise - step);
                }

                if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
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
                    SoundManager.getInstance().play('card_deal');
                    SoundManager.getInstance().playArpeggio('poker');
                }
            } else {
                if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                    this.game.nextPhase();
                    SoundManager.getInstance().play('card_deal');
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
        const theme = MINIGAME_THEMES.poker;

        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme);

        // ── Poker Table (Deep Felt) ──
        const tableW = Math.min(screenW * 0.95, s(mobile ? 560 : 700));
        const tableH = Math.min(screenH * 0.45, s(mobile ? 240 : 340));
        const tableY = cy - tableH * 0.1;

        const tableGrad = ctx.createRadialGradient(cx, tableY, s(50), cx, tableY, tableW / 2);
        tableGrad.addColorStop(0, '#065f46'); // brighter felt
        tableGrad.addColorStop(1, '#064e3b'); // darker shade

        ctx.fillStyle = tableGrad;
        ctx.beginPath();
        ctx.roundRect(cx - tableW / 2, tableY - tableH / 2, tableW, tableH, s(mobile ? 110 : 160));
        ctx.fill();

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = s(mobile ? 3 : 5);
        ctx.stroke();

        // Felt rail
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = s(2);
        ctx.setLineDash([s(10), s(15)]);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── Pot and Information ──
        const potY = tableY - tableH * 0.18;
        ctx.fillStyle = '#fde047';
        ctx.font = `bold ${r(mobile ? 22 : 24)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(10);
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(`POT: R$ ${this.game.pot}`, cx, potY);
        ctx.shadowBlur = 0;

        // ── Community Cards ──
        const commY = tableY + s(5);
        this.drawCommunityCards(ctx, cx, commY, this.game.communityCards, theme);

        // ── Players ──
        const playerY = screenH * 0.82;
        const npcY = screenH * 0.28;
        const npcXOff = screenW * 0.32;

        this.drawPlayer(ctx, cx, playerY, this.game.players[0], true, theme);
        this.drawPlayer(ctx, cx - npcXOff, npcY, this.game.players[1], false, theme);
        this.drawPlayer(ctx, cx + npcXOff, npcY, this.game.players[2], false, theme);

        // ── Phase / Pending Raise Overlay ──
        if ((this.game.phase === 'pre_flop' || this.game.phase === 'flop') && this.pendingRaise > 0) {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(mobile ? 16 : 16)}px ${theme.titleFont}`;
            ctx.fillText(`AUMENTAR: R$ ${this.pendingRaise}`, cx, tableY + tableH * 0.3);
        } else if (this.game.phase === 'result' && this.game.resultMessage) {
            ctx.fillStyle = this.game.winner?.isHuman ? '#4ade80' : '#ef4444';
            ctx.font = `bold ${r(mobile ? 24 : 24)}px ${theme.titleFont}`;
            ctx.shadowBlur = s(10);
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.fillText(this.game.resultMessage.toUpperCase(), cx, tableY + tableH * 0.3);
            ctx.shadowBlur = 0;
            
            ctx.fillStyle = theme.text;
            ctx.font = `600 ${r(mobile ? 14 : 13)}px ${theme.bodyFont}`;
            ctx.fillText(mobile ? '[OK] Próxima' : '[ENTER] Nova Partida', cx, tableY + tableH * 0.42);
        }

        // ── Footer Instructions ──
        let footerHint = '';
        const bmanager = BichoManager.getInstance();
        const { min } = EconomyManager.getInstance().getBetLimits();
        const isBroke = bmanager.playerMoney < min;

        if (this.game.phase === 'betting') {
            footerHint = isBroke ? 'SALDO INSUFICIENTE - ESC PARA SAIR' : (mobile ? '[OK] Iniciar' : 'ENTER Iniciar Partida • ESC Sair');
        } else if (this.game.phase === 'result') {
            const nextMatchBroke = (bmanager.playerMoney + (this.game.phase === 'result' ? (this.game.players[0].currentBet + this.game.settle()) : 0)) < min;
            footerHint = nextMatchBroke ? 'SALDO INSUFICIENTE - [OK] SAIR' : (mobile ? '[OK] Continuar' : 'ENTER Continuar • ESC Sair');
        } else if (this.game.phase === 'pre_flop' || this.game.phase === 'flop') {
            footerHint = mobile ? '[DPAD ↑↓] Ajustar • [OK] Confirmar' : '↑↓ Ajustar Aumento • ENTER Confirmar';
        } else {
            footerHint = mobile ? '[OK] Próxima Fase' : 'ENTER Próxima Fase • ESC Sair';
        }
        drawMinigameFooter(ctx, screenW, screenH, theme, footerHint);
    }

    private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, player: any, isMain: boolean, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.save();
        ctx.translate(x, y);

        // Player Name/Label
        ctx.fillStyle = isMain ? '#fff' : theme.textMuted;
        ctx.font = `bold ${r(isMain ? 14 : 12)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name.toUpperCase(), 0, -s(25));

        // Stake/Bet
        if (player.currentBet > 0) {
            ctx.fillStyle = '#4ade80';
            ctx.font = `800 ${r(11)}px ${theme.bodyFont}`;
            ctx.fillText(`APOSTA: R$ ${player.currentBet}`, 0, -s(10));
        }

        // Cards
        const cardW = s(isMain ? (mobile ? 72 : 60) : (mobile ? 54 : 45));
        const cardH = s(isMain ? (mobile ? 102 : 85) : (mobile ? 78 : 65));
        const spacing = cardW * 1.1;

        player.hand.forEach((card: any, i: number) => {
            const cardX = (i - 0.5) * spacing;
            const cardY = isMain ? s(35) : s(25);

            if (isMain || this.game.phase === 'result') {
                this.drawCard(ctx, cardX, cardY, cardW, cardH, card, theme);
            } else {
                // Simplified Back
                ctx.fillStyle = theme.accent;
                ctx.beginPath();
                ctx.roundRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, s(5));
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.stroke();
            }
        });

        ctx.restore();
    }

    private drawCommunityCards(ctx: CanvasRenderingContext2D, x: number, y: number, cards: any[], theme: any) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const cardW = s(mobile ? 62 : 65);
        const cardH = s(mobile ? 90 : 95);
        const spacing = cardW * 1.15;
        const startX = x - (2 * spacing);

        for (let i = 0; i < 5; i++) {
            const cardX = startX + i * spacing;
            if (i < cards.length) {
                this.drawCard(ctx, cardX, y, cardW, cardH, cards[i], theme);
            } else {
                // Empty Dark Slot
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.roundRect(cardX - cardW / 2, y - cardH / 2, cardW, cardH, s(8));
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.stroke();
            }
        }
    }

    private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, card: any, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.save();
        ctx.translate(x, y);

        // Body with Shadow
        ctx.shadowBlur = s(8);
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, s(6));
        ctx.fill();
        ctx.shadowBlur = 0;

        const isRed = card.suit === 'H' || card.suit === 'D';
        ctx.fillStyle = isRed ? '#e11d48' : '#1e293b';

        // Corner Rank
        const cornerSize = r(Math.floor(h * 0.18));
        ctx.font = `bold ${cornerSize}px ${theme.bodyFont}`;
        ctx.textAlign = 'left';
        ctx.fillText(card.value, -w / 2 + s(6), -h / 2 + cornerSize + s(4));

        // Center Suit
        const suitIcon = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' }[card.suit as 'H' | 'D' | 'C' | 'S'];
        const suitSize = r(Math.floor(h * 0.45));
        ctx.font = `${suitSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(suitIcon || '', 0, h * 0.20);

        ctx.restore();
    }
}
