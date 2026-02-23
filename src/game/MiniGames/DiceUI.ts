/**
 * DiceUI - Visual Interface for the Overhauled Dice Game
 */

import { DiceGame } from './DiceGame';
import { BichoManager } from '../BichoManager';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';

export class DiceUI {
    private game: DiceGame;
    private betAmount: number = 10;
    private humanChoices: [number, number] = [1, 1];
    private activeChoice: 0 | 1 = 0; // Which of the two numbers we are currently adjusting
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;

    constructor(game: DiceGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
        this.game = game;
        this.onClose = onClose;
        this.onPlayAgain = onPlayAgain;
    }

    public draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Overlay Background
        const grad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width);
        grad.addColorStop(0, 'rgba(20, 25, 35, 0.92)');
        grad.addColorStop(1, 'rgba(10, 10, 15, 0.98)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;

        // Title
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00aaff';
        ctx.fillStyle = '#00aaff';
        ctx.font = 'bold 48px "Segoe UI", "Roboto", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("DADOS DE RUA", cx, 80);
        ctx.shadowBlur = 0;

        // Dice Visuals (MUCH LARGER)
        const diceSize = 140;
        this.drawDie(ctx, cx - 120, 250, this.game.dice1, diceSize);
        this.drawDie(ctx, cx + 120, 250, this.game.dice2, diceSize);

        // Status Message
        ctx.fillStyle = this.game.winner?.isHuman ? '#44ff44' : '#ffffff';
        ctx.font = '600 24px "Segoe UI", sans-serif';
        ctx.fillText(this.game.message, cx, 380);

        // Players List
        this.drawPlayersList(ctx, cx, 450);

        if (this.game.phase === 'betting') {
            this.drawBettingInterface(ctx, cx, height - 150);
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#ffff66';
            ctx.font = 'bold 18px "Segoe UI", sans-serif';
            const resultHint = isMobile()
                ? '[OK] Jogar Novamente   [✕] Sair'
                : '[ESPAÇO] Jogar Novamente   [ESC] Sair';
            ctx.fillText(resultHint, cx, height - 60);
        }
    }

    private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, size: number) {
        // Shake effect if rolling
        if (this.game.isRolling) {
            x += (Math.random() - 0.5) * 20;
            y += (Math.random() - 0.5) * 20;
            value = Math.floor(Math.random() * 6) + 1;
        }

        // Box
        ctx.fillStyle = '#f0f0f5';
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        // Rounded Rect manually or just fillRect for dice
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, 16);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#e0e0ea';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pips (Dots)
        ctx.fillStyle = '#222';
        const pipSize = size * 0.1;
        const qs = size / 4;

        if (value === 1 || value === 3 || value === 5) this.drawPip(ctx, x, y, pipSize);
        if (value >= 2) { this.drawPip(ctx, x - qs, y - qs, pipSize); this.drawPip(ctx, x + qs, y + qs, pipSize); }
        if (value >= 4) { this.drawPip(ctx, x + qs, y - qs, pipSize); this.drawPip(ctx, x - qs, y + qs, pipSize); }
        if (value === 6) { this.drawPip(ctx, x - qs, y, pipSize); this.drawPip(ctx, x + qs, y, pipSize); }
    }

    private drawPip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawPlayersList(ctx: CanvasRenderingContext2D, cx: number, y: number) {
        const players = this.game.players;
        const cardW = 180;
        const spacing = 200;
        const startX = cx - (players.length - 1) * spacing / 2;

        players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isWinner = this.game.winner === p;

            // Card Background
            ctx.fillStyle = isWinner ? 'rgba(50, 205, 50, 0.2)' : 'rgba(255, 255, 255, 0.05)';
            if (p.isHuman && this.game.phase === 'betting') ctx.fillStyle = 'rgba(0, 170, 255, 0.1)';

            ctx.beginPath();
            ctx.roundRect(px - cardW / 2, y, cardW, 140, 12);
            ctx.fill();

            ctx.strokeStyle = isWinner ? '#44dd66' : '#444';
            if (p.isHuman && !isWinner) ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (isWinner) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#44dd66';
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Name
            ctx.fillStyle = p.isHuman ? '#fff' : '#aaa';
            ctx.font = 'bold 16px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, px, y + 30);

            // Choices
            ctx.fillStyle = '#fff';

            if (this.game.phase !== 'betting' || !p.isHuman) {
                ctx.font = '32px "Segoe UI", sans-serif';
                ctx.fillText(`${p.choices[0]} & ${p.choices[1]}`, px, y + 75);
            } else {
                // In betting phase, highlight active human choice
                // Using bigger fonts for selection
                const c1Size = this.activeChoice === 0 ? '42px' : '32px';
                const c2Size = this.activeChoice === 1 ? '42px' : '32px';
                const c1Color = this.activeChoice === 0 ? '#00aaff' : '#888';
                const c2Color = this.activeChoice === 1 ? '#00aaff' : '#888';

                ctx.font = `bold ${c1Size} "Segoe UI", sans-serif`;
                ctx.fillStyle = c1Color;
                ctx.fillText(`${this.humanChoices[0]}`, px - 30, y + 80);

                ctx.font = `bold ${c2Size} "Segoe UI", sans-serif`;
                ctx.fillStyle = c2Color;
                ctx.fillText(`${this.humanChoices[1]}`, px + 30, y + 80);

                // Helper text
                ctx.fillStyle = '#aaa';
                ctx.font = '12px "Segoe UI", sans-serif';
                ctx.fillText('Seus Números', px, y + 110);
            }

            // Score/Error
            if (this.game.phase === 'result') {
                ctx.fillStyle = isWinner ? '#44dd66' : '#ff4444';
                ctx.font = 'bold 14px "Segoe UI", sans-serif';
                ctx.fillText(`Erro: ${p.score}`, px, y + 120);
            }
        });
    }

    private drawBettingInterface(ctx: CanvasRenderingContext2D, x: number, y: number) {
        ctx.fillStyle = '#ccc';
        ctx.font = '300 24px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('A SUA APOSTA', x, y - 40);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px "Segoe UI", sans-serif';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255,255,255,0.2)';
        ctx.fillText(`R$ ${this.betAmount}`, x, y + 30);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#aaa';
        ctx.font = '14px "Segoe UI", sans-serif';
        const betHint = isMobile()
            ? '[🏃] Trocar Dado  [D-Pad] Ajustar  [OK] JOGAR'
            : '[SHIFT/Q] Trocar Dado  [SETAS] Ajustar Valor/Número  [ESPAÇO] JOGAR';
        ctx.fillText(betHint, x, y + 80);
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
            if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
                this.betAmount = Math.min(this.game.maxBet, this.betAmount + 10);
            }
            if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
                this.betAmount = Math.max(this.game.minBet, this.betAmount - 10);
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                if (bmanager.playerMoney >= this.betAmount) {
                    bmanager.playerMoney -= this.betAmount;
                    this.game.startRound(this.humanChoices, this.betAmount);

                    // Animation delay
                    setTimeout(() => {
                        this.game.resolve();
                        // We don't update money here directly, we wait for the result phase or settle it
                    }, 1500);
                }
            }
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                let winAmount = 0;
                if (this.game.winner?.isHuman) {
                    winAmount = this.game.betAmount * 5;
                }
                this.onPlayAgain(winAmount);
                this.betAmount = 10;
                this.game.reset();
            } else if (input.wasPressed('Escape') || input.wasPressed('KeyE')) {
                let winAmount = 0;
                if (this.game.winner?.isHuman) {
                    winAmount = this.game.betAmount * 5;
                }
                this.onClose(winAmount);
            }
        }
    }
}
