/**
 * DiceUI - Visual Interface for the Dice Game
 * Layout 100% proporcional — sem coordenadas hardcoded.
 */

import { DiceGame } from './DiceGame';
import { BichoManager } from '../BichoManager';
import { InputManager } from '../Core/InputManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';

export class DiceUI implements IMinigameUI {
    private game: DiceGame;
    private betAmount: number = 10;
    private humanChoices: [number, number] = [1, 1];
    private activeChoice: 0 | 1 = 0;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: DiceGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const theme = MINIGAME_THEMES.dice;

        // Fullscreen themed background
        drawMinigameBackground(ctx, width, height, theme);
        drawMinigameTitle(ctx, width, height, theme);

        const cx = width / 2;
        const mobile = isMobile();

        // ── Layout Proportional Zones ──
        const TITLE_H = height * 0.15;
        const DICE_H = height * 0.30;
        const MSG_H = height * 0.08;
        const PLAYERS_H = height * 0.25;
        const FOOTER_H = height * 0.22;

        const diceCY = TITLE_H + DICE_H * 0.45;
        const msgY = TITLE_H + DICE_H + MSG_H * 0.4;
        const playersY = TITLE_H + DICE_H + MSG_H;
        const footerY = height - FOOTER_H;

        // ── Dice ──
        const diceSize = Math.min(s(mobile ? 85 : 115), DICE_H * 0.8, width * 0.16);
        const diceSpacing = Math.min(s(mobile ? 60 : 85), width * 0.18);
        this.drawDie(ctx, cx - diceSpacing, diceCY, this.game.dice1, diceSize);
        this.drawDie(ctx, cx + diceSpacing, diceCY, this.game.dice2, diceSize);

        // ── Message ──
        ctx.fillStyle = this.game.winner?.isHuman ? '#4ade80' : theme.text;
        ctx.font = `600 ${r(mobile ? 16 : 16)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(this.game.message.toUpperCase(), cx, msgY);

        // ── Players List ──
        this.drawPlayersList(ctx, cx, playersY, PLAYERS_H, width, theme);

        // ── Footer / Betting ──
        if (this.game.phase === 'betting') {
            this.drawBettingInterface(ctx, cx, footerY, FOOTER_H, theme);
        } else if (this.game.phase === 'result') {
            const resultHint = mobile
                ? '[OK] Jogar Novamente • [EXIT] Sair'
                : 'ESPAÇO JOGAR NOVAMENTE • ESC SAIR';
            drawMinigameFooter(ctx, width, height, theme, resultHint);
        }
    }

    private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, size: number) {
        const s = UIScale.s.bind(UIScale);

        if (this.game.isRolling) {
            x += (Math.random() - 0.5) * s(15);
            y += (Math.random() - 0.5) * s(15);
            value = Math.floor(Math.random() * 6) + 1;
        }

        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(x - size / 2 + s(6), y - size / 2 + s(6), size, size, s(12));
        ctx.fill();

        // Main Body
        const dieGrad = ctx.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
        dieGrad.addColorStop(0, '#ffffff');
        dieGrad.addColorStop(1, '#e0e0f0');
        ctx.fillStyle = dieGrad;

        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, s(12));
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = s(1);
        ctx.stroke();

        // Dots (Pips)
        ctx.fillStyle = '#111';
        const pipR = size * 0.11;
        const dotOffset = size / 4;

        if (value % 2 !== 0) this.drawPip(ctx, x, y, pipR);
        if (value >= 2) {
            this.drawPip(ctx, x - dotOffset, y - dotOffset, pipR);
            this.drawPip(ctx, x + dotOffset, y + dotOffset, pipR);
        }
        if (value >= 4) {
            this.drawPip(ctx, x + dotOffset, y - dotOffset, pipR);
            this.drawPip(ctx, x - dotOffset, y + dotOffset, pipR);
        }
        if (value === 6) {
            this.drawPip(ctx, x - dotOffset, y, pipR);
            this.drawPip(ctx, x + dotOffset, y, pipR);
        }

        // Highlight shine
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.roundRect(x - size / 2 + s(4), y - size / 2 + s(4), size * 0.4, size * 0.1, s(2));
        ctx.fill();
    }

    private drawPip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawPlayersList(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const players = this.game.players;

        const cardH = Math.min(zoneH * 0.9, s(mobile ? 100 : 130));
        const cardW = Math.min(s(mobile ? 115 : 150), (screenW * 0.95) / players.length - s(10));
        const spacing = cardW + s(mobile ? 6 : 12);
        const startX = cx - (players.length - 1) * spacing / 2;
        const cardTop = zoneTop + (zoneH - cardH) / 2;

        players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isWinner = this.game.winner === p;

            ctx.save();
            ctx.translate(px, cardTop);

            // Card Background
            ctx.fillStyle = isWinner ? 'rgba(74, 222, 128, 0.15)' : 'rgba(0, 0, 0, 0.25)';
            if (p.isHuman && this.game.phase === 'betting') ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';

            ctx.beginPath();
            ctx.roundRect(-cardW / 2, 0, cardW, cardH, s(12));
            ctx.fill();

            // Border
            ctx.strokeStyle = isWinner ? '#4ade80' : (p.isHuman ? theme.accent : 'rgba(255, 255, 255, 0.1)');
            ctx.lineWidth = s(isWinner ? 2.5 : 1.5);
            if (isWinner) {
                ctx.shadowBlur = s(15);
                ctx.shadowColor = '#4ade8066';
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Name
            ctx.fillStyle = p.isHuman ? '#fff' : theme.textMuted;
            ctx.font = `bold ${r(mobile ? 13 : 14)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name, 0, cardH * 0.28);

            // Choices
            if (this.game.phase !== 'betting' || !p.isHuman) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${r(mobile ? 18 : 22)}px ${theme.bodyFont}`;
                ctx.fillText(`${p.choices[0]} • ${p.choices[1]}`, 0, cardH * 0.62);
            } else {
                // Interactive Human Choices
                const c1Size = this.activeChoice === 0 ? r(24) : r(16);
                const c2Size = this.activeChoice === 1 ? r(24) : r(16);

                ctx.font = `bold ${c1Size}px ${theme.bodyFont}`;
                ctx.fillStyle = this.activeChoice === 0 ? theme.accent : 'rgba(255,255,255,0.3)';
                ctx.fillText(`${this.humanChoices[0]}`, -s(18), cardH * 0.62);

                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = `600 ${r(16)}px ${theme.bodyFont}`;
                ctx.fillText('•', 0, cardH * 0.62);

                ctx.font = `bold ${c2Size}px ${theme.bodyFont}`;
                ctx.fillStyle = this.activeChoice === 1 ? theme.accent : 'rgba(255,255,255,0.3)';
                ctx.fillText(`${this.humanChoices[1]}`, s(18), cardH * 0.62);

                ctx.fillStyle = theme.textMuted;
                ctx.font = `700 ${r(9)}px ${theme.bodyFont}`;
                ctx.fillText('SUA ESCOLHA', 0, cardH * 0.88);
            }

            // Margin Result
            if (this.game.phase === 'result') {
                ctx.fillStyle = isWinner ? '#4ade80' : '#f87171';
                ctx.font = `bold ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
                ctx.fillText(`ERRO: ${p.score}`, 0, cardH * 0.9);
            }

            ctx.restore();
        });
    }

    private drawBettingInterface(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 16 : 16)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DA APOSTA', cx, zoneTop + zoneH * 0.2);

        ctx.font = `bold ${r(mobile ? 40 : 54)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(15);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
        
        const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.fillText('SEM GRANA!', cx, zoneTop + zoneH * 0.58);
        } else {
            ctx.fillStyle = '#fff';
            ctx.fillText(`R$ ${this.betAmount}`, cx, zoneTop + zoneH * 0.58);
        }
        ctx.shadowBlur = 0;

        const helpHint = mobile
            ? '[DPAD] Ajustar • [RUN] Trocar • [OK] Jogar'
            : '[SETAS] AJUSTAR • [Q] TROCA DADO • [SPACE] JOGAR';
        drawMinigameFooter(ctx, cx * 2, zoneTop + zoneH * 4.5, theme, helpHint);
    }

    public update(_dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            if (input.wasPressed('ShiftLeft') || input.wasPressed('KeyQ')) {
                this.activeChoice = this.activeChoice === 0 ? 1 : 0;
            }
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
                this.humanChoices[this.activeChoice] = Math.min(6, this.humanChoices[this.activeChoice] + 1);
            }
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
                this.humanChoices[this.activeChoice] = Math.max(1, this.humanChoices[this.activeChoice] - 1);
            }
            const { step } = EconomyManager.getInstance().getBetLimits();
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                this.betAmount = Math.min(this.game.maxBet, this.betAmount + step);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                this.betAmount = Math.max(this.game.minBet, this.betAmount - step);
            }
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                if (bmanager.playerMoney >= this.betAmount) {
                    bmanager.playerMoney -= this.betAmount;
                    this.game.startRound(this.humanChoices, this.betAmount);
                    SoundManager.getInstance().play('dice_roll');
                    setTimeout(() => {
                        this.game.resolve();
                        SoundManager.getInstance().play(this.game.winner?.isHuman ? 'win_small' : 'lose');
                    }, 1500);
                }
            }
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                const bmanager = BichoManager.getInstance();
                const winAmount = this.game.winner?.isHuman ? this.game.betAmount * 5 : 0;
                const totalMoney = bmanager.playerMoney + winAmount;

                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onClose(winAmount); // Exit if broke
                } else {
                    this.onPlayAgain(winAmount);
                    this.betAmount = 10;
                    this.game.reset();
                }
            }
        }

        if (input.wasPressed('Escape')) {
            const winAmount = (this.game.phase === 'result' && this.game.winner?.isHuman) ? this.game.betAmount * 5 : 0;
            this.onClose(winAmount);
        }
    }
}

