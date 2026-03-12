/**
 * PurrinhaUI — renders the Purrinha mini-game overlay.
 * Full-screen overlay drawn on the main canvas.
 */

import { PurrinhaGame } from './PurrinhaGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';

export class PurrinhaUI implements IMinigameUI {
    private game: PurrinhaGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: PurrinhaGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const phase = this.game.phase;

        if (phase === 'betting') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + 10);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - 10);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
                SoundManager.getInstance().play('bet_place');
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedStones = Math.min(3, this.game.selectedStones + 1);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedStones = Math.max(0, this.game.selectedStones - 1);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.chooseStones(this.game.selectedStones);
                SoundManager.getInstance().play('dice_roll');
            }
        } else if (phase === 'guessing') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedGuess = Math.min(this.game.maxPossibleTotal, this.game.selectedGuess + 1);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedGuess = Math.max(0, this.game.selectedGuess - 1);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
                this.game.makeGuess(this.game.selectedGuess);
            }
        } else if (phase === 'reveal') {
            this.game.update(dt);
        } else if (phase === 'result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyR')) {
                const moneyChange = this.game.settle();
                SoundManager.getInstance().play(moneyChange > 0 ? 'win_small' : 'lose');
                this.onPlayAgain(moneyChange);
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }


    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const theme = MINIGAME_THEMES.purrinha;

        drawMinigameBackground(ctx, screenW, screenH, theme);
        // Standard Title
        ctx.save();
        ctx.shadowBlur = s(15);
        ctx.shadowColor = theme.accent + '66';
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(screenW < 600 ? 18 : 24)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(theme.name, screenW / 2, screenH * 0.12);
        ctx.restore();

        const cx = screenW / 2;
        const mobile = isMobile();

        // ── Proportional Layout Zones ──
        const TITLE_H = screenH * 0.18;
        const PLAYERS_H = screenH * 0.32;
        const CONTENT_H = screenH * 0.50;

        const playersTop = TITLE_H;
        const contentTop = TITLE_H + PLAYERS_H;
        const contentCY = contentTop + CONTENT_H * 0.45;

        // Player cards
        this.drawPlayers(ctx, cx, playersTop, PLAYERS_H, screenW, theme);

        // Content by phase
        const phase = this.game.phase;
        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentTop, CONTENT_H, theme);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, contentCY, theme);
        } else if (phase === 'guessing') {
            this.drawGuessingUI(ctx, cx, contentCY, theme);
        } else if (phase === 'reveal') {
            this.drawRevealUI(ctx, cx, contentCY, theme);
        } else if (phase === 'result') {
            this.drawResultUI(ctx, cx, contentCY, theme);
        }

        // Shared footer hint
        const helpHint = mobile
            ? '[DPAD] Variar • [OK] Confirmar'
            : '↑↓ VARIAR  •  ENTER CONFIRMAR  •  ESC SAIR';
        drawMinigameFooter(ctx, screenW, screenH, theme, helpHint);
    }

    private drawPlayers(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, screenW: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const players = this.game.players;

        const cardH = Math.min(zoneH * 0.9, s(mobile ? 110 : 130));
        const cardW = Math.min(s(mobile ? 100 : 140), (screenW * 0.95) / players.length - s(12));
        const spacing = cardW + s(mobile ? 8 : 15);
        const startX = cx - (players.length - 1) * spacing / 2;
        const cardTop = zoneTop + (zoneH - cardH) / 2;

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const px = startX + i * spacing;
            const isRevealed = this.game.phase === 'reveal' && i <= this.game.revealIndex;
            const isResult = this.game.phase === 'result';
            const isWinner = this.game.winner === p;

            ctx.save();
            ctx.translate(px, cardTop);

            // Card shadow/glow
            if (isWinner && isResult) {
                ctx.shadowBlur = s(25);
                ctx.shadowColor = '#ffcc00';
            }

            // Card Background
            const cardBg = (isWinner && isResult) ? 'rgba(255, 204, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)';
            ctx.fillStyle = cardBg;
            ctx.beginPath();
            ctx.roundRect(-cardW / 2, 0, cardW, cardH, s(12));
            ctx.fill();

            // Border
            ctx.strokeStyle = (isWinner && isResult) ? '#ffcc00' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = (isWinner && isResult) ? s(3) : s(1.5);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Name
            ctx.fillStyle = p.isHuman ? theme.accent : theme.text;
            ctx.font = `bold ${r(mobile ? 11 : 14)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), 0, cardH * 0.25);

            // Money
            ctx.fillStyle = theme.textMuted;
            ctx.font = `600 ${r(mobile ? 9 : 10)}px ${theme.bodyFont}`;
            ctx.fillText(`R$ ${p.money}`, 0, cardH * 0.42);

            // Visual State: Stones or Hidden
            if (isRevealed || isResult) {
                const stoneSize = cardH * 0.18;
                const totalW = p.stones * stoneSize + (p.stones - 1) * s(4);
                let startX = -totalW / 2 + stoneSize / 2;
                
                if (p.stones === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.font = `${r(14)}px ${theme.bodyFont}`;
                    ctx.fillText('NADA', 0, cardH * 0.72);
                } else {
                    for (let j = 0; j < p.stones; j++) {
                        this.drawStone(ctx, startX + j * (stoneSize + s(4)), cardH * 0.70, stoneSize);
                    }
                }
            } else if (this.game.phase !== 'betting') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.font = `${Math.floor(cardH * 0.35)}px sans-serif`;
                ctx.fillText('✊', 0, cardH * 0.75);
            }

            // Guess Label
            if (p.hasGuessed && (this.game.phase === 'reveal' || this.game.phase === 'result')) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = `bold ${r(mobile ? 8 : 10)}px ${theme.bodyFont}`;
                ctx.fillText(`ALVO: ${p.guess}`, 0, cardH * 0.92);
            }

            ctx.restore();
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 14 : 16)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DA APOSTA', cx, zoneTop + zoneH * 0.15);

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(mobile ? 48 : 64)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent + '66';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, zoneTop + zoneH * 0.5);
        ctx.shadowBlur = 0;

        ctx.fillStyle = theme.textMuted;
        ctx.font = `500 ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
        ctx.fillText(`Pote Acumulado: R$ ${this.game.selectedBet * this.game.players.length}`, cx, zoneTop + zoneH * 0.75);
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('QUANTAS PEDRAS NA MÃO?', cx, cy - s(mobile ? 70 : 90));

        const stoneSize = s(mobile ? 35 : 45);
        const stones = this.game.selectedStones;
        if (stones === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = `bold ${r(40)}px ${theme.titleFont}`;
            ctx.fillText('VAZIA', cx, cy - s(10));
        } else {
            const spacing = stoneSize + s(15);
            const startX = cx - (stones - 1) * spacing / 2;
            for (let i = 0; i < stones; i++) {
                this.drawStone(ctx, startX + i * spacing, cy - s(15), stoneSize);
            }
        }

        // Selector dots
        const dotSize = s(mobile ? 12 : 16);
        const dotSpacing = s(mobile ? 25 : 35);
        for (let i = 0; i <= 3; i++) {
            const dx = cx + (i - 1.5) * dotSpacing;
            ctx.fillStyle = this.game.selectedStones === i ? theme.accent : 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.arc(dx, cy + s(50), dotSize / 2, 0, Math.PI * 2);
            ctx.fill();
            if (this.game.selectedStones === i) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = s(2);
                ctx.stroke();
            }
        }
    }

    private drawGuessingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL O TOTAL NA MESA?', cx, cy - s(mobile ? 70 : 95));

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${r(mobile ? 56 : 72)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(25);
        ctx.shadowColor = 'rgba(255, 204, 0, 0.4)';
        ctx.fillText(`${this.game.selectedGuess}`, cx, cy + s(10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
        ctx.fillText(`(Possível: 0 - ${this.game.maxPossibleTotal})`, cx, cy + s(65));

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(mobile ? 9 : 11)}px ${theme.bodyFont}`;
        ctx.fillText(`Você segurou: ${this.game.selectedStones} pedra(s)`, cx, cy + r(mobile ? 85 : 105));
    }

    private drawRevealUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${r(24)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('ABRINDO AS MÃOS...', cx, cy);

        if (this.game.revealIndex >= 0) {
            const revealed = this.game.players.slice(0, this.game.revealIndex + 1);
            const partialTotal = revealed.reduce((sum, p) => sum + p.stones, 0);
            ctx.fillStyle = theme.text;
            ctx.font = `600 ${r(16)}px ${theme.bodyFont}`;
            ctx.fillText(`Soma parcial: ${partialTotal}`, cx, cy + s(60));
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = theme.textMuted;
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(`SOMA TOTAL: ${this.game.totalStones}`, cx, cy - s(mobile ? 60 : 80));

        const isWin = this.game.winner?.isHuman;
        ctx.fillStyle = isWin ? '#4ade80' : '#f87171';
        ctx.font = `bold ${r(mobile ? 24 : 36)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = isWin ? '#22c55e66' : '#ef444466';

        // Split message if too long
        const msg = this.game.resultMessage.toUpperCase();
        ctx.fillText(msg, cx, cy + s(10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = theme.text;
        ctx.font = `600 ${r(mobile ? 10 : 13)}px ${theme.bodyFont}`;
        const finalHint = mobile ? '[OK] Continuar' : 'ENTRE CONTINUAR • ESPAÇO REPLAY';
        ctx.fillText(finalHint, cx, cy + s(mobile ? 55 : 75));
    }

    private drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
        ctx.save();
        ctx.translate(x, y);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, size * 0.35, size * 0.45, size * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stone Body (Realistic Darkened Gradient)
        const grad = ctx.createRadialGradient(-size * 0.2, -size * 0.2, size * 0.1, 0, 0, size * 0.6);
        grad.addColorStop(0, '#6b7280'); // Muted Grey
        grad.addColorStop(0.5, '#374151'); // Dark Grey
        grad.addColorStop(1, '#111827'); // Charcoal Black
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Slightly irregular shape for a "stone" feel
        ctx.moveTo(size * 0.45, -size * 0.1);
        ctx.bezierCurveTo(size * 0.5, size * 0.3, -size * 0.5, size * 0.4, -size * 0.45, 0);
        ctx.bezierCurveTo(-size * 0.4, -size * 0.4, size * 0.3, -size * 0.5, size * 0.45, -size * 0.1);
        ctx.fill();

        // Add a subtle rocky texture/stroke
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Muted Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.ellipse(-size * 0.15, -size * 0.15, size * 0.2, size * 0.1, Math.PI * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
