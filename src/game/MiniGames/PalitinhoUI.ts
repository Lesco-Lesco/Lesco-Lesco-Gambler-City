/**
 * PalitinhoUI — renders the Palitinho duel overlay.
 */

import { PalitinhoGame } from './PalitinhoGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { BichoManager } from '../BichoManager';
import { EconomyManager } from '../Core/EconomyManager';

export class PalitinhoUI implements IMinigameUI {
    private game: PalitinhoGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: PalitinhoGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.input = InputManager.getInstance();
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const phase = this.game.phase;

        if (phase === 'betting') {
            const { step } = EconomyManager.getInstance().getBetLimits();
            if (this.input.wasPressedOrHeld('ArrowUp', dt) || this.input.wasPressedOrHeld('KeyW', dt)) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + step * 2);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressedOrHeld('ArrowDown', dt) || this.input.wasPressedOrHeld('KeyS', dt)) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - step * 2);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
                SoundManager.getInstance().play('bet_place');
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
                this.game.selectedSticks = Math.min(3, this.game.selectedSticks + 1);
            }
            if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
                this.game.selectedSticks = Math.max(0, this.game.selectedSticks - 1);
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.chooseSticks(this.game.selectedSticks);
                SoundManager.getInstance().play('dice_roll');
            }
        } else if (phase === 'guessing') {
            if (this.input.wasPressedOrHeld('ArrowUp', dt) || this.input.wasPressedOrHeld('KeyW', dt)) {
                this.game.selectedGuess = Math.min(this.game.maxPossibleTotal, this.game.selectedGuess + 1);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressedOrHeld('ArrowDown', dt) || this.input.wasPressedOrHeld('KeyS', dt)) {
                this.game.selectedGuess = Math.max(0, this.game.selectedGuess - 1);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.makeGuess(this.game.selectedGuess);
            }
        } else if (phase === 'reveal') {
            this.game.update(dt);
        } else if (phase === 'result') {
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('KeyR')) {
                const bmanager = BichoManager.getInstance();
                const moneyChange = this.game.settle();
                const totalMoney = bmanager.playerMoney + moneyChange;

                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    bmanager.addNotification("Você está sem grana para este duelo!", 3);
                    this.onClose(moneyChange);
                } else {
                    SoundManager.getInstance().play(moneyChange > 0 ? 'win_small' : 'lose');
                    this.onPlayAgain(moneyChange);
                    this.game.reset();
                }
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
        const theme = MINIGAME_THEMES.palitinho;

        drawMinigameBackground(ctx, screenW, screenH, theme);
        
        ctx.save();
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent + '88';
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(screenW < 600 ? 20 : 28)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText("DUELO DE PALITINHO", screenW / 2, screenH * 0.12);
        ctx.restore();

        const cx = screenW / 2;
        const mobile = isMobile();

        // Dual layout
        const players = this.game.players;
        const cardW = s(mobile ? 120 : 160);
        const cardH = s(mobile ? 140 : 180);
        const spacing = s(mobile ? 40 : 80);

        players.forEach((p, i) => {
            const px = cx + (i === 0 ? -1 : 1) * (cardW / 2 + spacing / 2);
            const py = screenH * 0.35;
            const isWinner = this.game.winner === p && this.game.phase === 'result';
            const isRevealed = this.game.phase === 'reveal' && i <= this.game.revealIndex;

            ctx.save();
            ctx.translate(px, py);

            if (isWinner) {
                ctx.shadowBlur = s(30);
                ctx.shadowColor = theme.accent;
            }

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, s(15));
            ctx.fill();
            ctx.strokeStyle = isWinner ? theme.accent : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = isWinner ? s(4) : s(2);
            ctx.stroke();

            ctx.fillStyle = p.isHuman ? theme.accent : '#fff';
            ctx.font = `bold ${r(mobile ? 12 : 16)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), 0, -cardH * 0.3);

            if (isRevealed || this.game.phase === 'result') {
                const stickW = s(4);
                const stickH = s(30);
                const stickSpacing = s(10);
                const totalW = p.sticks * stickW + (p.sticks - 1) * stickSpacing;
                let sx = -totalW / 2;
                
                for (let j = 0; j < p.sticks; j++) {
                    ctx.fillStyle = '#d2b48c'; // Wood color
                    ctx.fillRect(sx + j * (stickW + stickSpacing), -stickH / 2, stickW, stickH);
                    ctx.fillStyle = '#cc0000'; // Match head
                    ctx.fillRect(sx + j * (stickW + stickSpacing), -stickH / 2, stickW, s(6));
                }
                
                if (p.sticks === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText('MÃO VAZIA', 0, 0);
                }

                if (p.hasGuessed) {
                    ctx.fillStyle = theme.accent;
                    ctx.font = `bold ${r(mobile ? 10 : 12)}px ${theme.bodyFont}`;
                    ctx.fillText(`GUESS: ${p.guess}`, 0, cardH * 0.35);
                }
            } else if (this.game.phase !== 'betting') {
                ctx.font = `${s(40)}px sans-serif`;
                ctx.fillText('✊', 0, 0);
            }

            ctx.restore();
        });

        // Center UI
        if (this.game.phase === 'betting') {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(mobile ? 32 : 48)}px ${theme.titleFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(`R$ ${this.game.selectedBet}`, cx, screenH * 0.7);
        } else if (this.game.phase === 'choosing') {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(mobile ? 16 : 20)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(`SUA MÃO: ${this.game.selectedSticks} PALITINHOS`, cx, screenH * 0.7);
        } else if (this.game.phase === 'guessing') {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(mobile ? 40 : 56)}px ${theme.titleFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(`${this.game.selectedGuess}`, cx, screenH * 0.75);
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(mobile ? 18 : 24)}px ${theme.titleFont}`;
            ctx.textAlign = 'center';
            ctx.fillText(this.game.resultMessage, cx, screenH * 0.7);
        }

        drawMinigameFooter(ctx, screenW, screenH, theme, mobile ? '[OK] Confirmar' : 'ENTER CONFIRMAR • ESC SAIR');
    }
}
