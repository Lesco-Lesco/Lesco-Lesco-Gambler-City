/**
 * PurrinhaUI — renders the Purrinha mini-game overlay.
 * Full-screen overlay drawn on the main canvas.
 */

import { PurrinhaGame } from './PurrinhaGame';
import { InputManager } from '../Core/InputManager';

export class PurrinhaUI {
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
            }
            if (this.input.wasPressed('Escape')) {
                this.onClose(0);
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
            }
            if (this.input.wasPressed('Escape')) {
                this.onClose(-this.game.betAmount);
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
            if (this.input.wasPressed('Escape')) {
                this.onClose(-this.game.betAmount);
            }
        } else if (phase === 'reveal') {
            this.game.update(dt);
        } else if (phase === 'result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyR')) {
                const moneyChange = this.game.settle();
                this.onPlayAgain(moneyChange);
            } else if (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE') || this.input.wasPressed('Escape')) {
                const moneyChange = this.game.settle();
                this.onClose(moneyChange);
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        // Dark Overlay with subtle gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, screenH);
        bgGrad.addColorStop(0, 'rgba(10, 15, 25, 0.95)');
        bgGrad.addColorStop(1, 'rgba(5, 5, 10, 0.98)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, screenW, screenH);

        const centerX = screenW / 2;
        const centerY = screenH / 2;

        // Title with Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffcc00';
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 48px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PURRINHA', centerX, 80);
        ctx.shadowBlur = 0;

        // Players display
        this.drawPlayers(ctx, centerX, 150, screenW);

        // Phase-specific UI
        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, centerX, centerY + 80);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, centerX, centerY + 80);
        } else if (phase === 'guessing') {
            this.drawGuessingUI(ctx, centerX, centerY + 80);
        } else if (phase === 'reveal') {
            this.drawRevealUI(ctx, centerX, centerY + 80);
        } else if (phase === 'result') {
            this.drawResultUI(ctx, centerX, centerY + 80);
        }

        // Controls hint
        ctx.fillStyle = '#888';
        ctx.font = '600 14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('↑↓ SELECIONAR  |  ENTER CONFIRMAR  |  ESC SAIR', centerX, screenH - 40);
    }

    private drawPlayers(ctx: CanvasRenderingContext2D, centerX: number, y: number, screenW: number) {
        const players = this.game.players;
        const spacing = Math.min(240, (screenW - 100) / players.length);
        const startX = centerX - (players.length - 1) * spacing / 2;

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const px = startX + i * spacing;

            const isRevealed = this.game.phase === 'reveal' && i <= this.game.revealIndex;
            const isResult = this.game.phase === 'result';
            const isWinner = this.game.winner === p;

            // Player Card
            const cardW = 180;
            const cardH = 160;

            ctx.save();
            ctx.translate(px, y);

            // Glow for winner
            if (isWinner && isResult) {
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ffcc00';
            }

            ctx.fillStyle = isWinner && isResult ? 'rgba(255, 204, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(-cardW / 2, 0, cardW, cardH, 12);
            ctx.fill();

            ctx.strokeStyle = isWinner && isResult ? '#ffcc00' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = isWinner && isResult ? 3 : 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Name
            ctx.fillStyle = p.isHuman ? '#ff4d6d' : '#8d99ae';
            ctx.font = 'bold 18px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), 0, 35);

            // Money
            ctx.fillStyle = '#2ec4b6';
            ctx.font = '600 14px "Segoe UI", sans-serif';
            ctx.fillText(`R$ ${p.money}`, 0, 60);

            // Hand/stones
            if (isRevealed || isResult) {
                ctx.fillStyle = '#fff';
                ctx.font = '32px "Segoe UI Emoji", Arial';
                const stonesStr = '🪨'.repeat(p.stones) || '∅';
                ctx.fillText(stonesStr, 0, 105);
            } else if (this.game.phase !== 'betting') {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '42px "Segoe UI Emoji", Arial';
                ctx.fillText('✊', 0, 110);
            }

            // Guess
            if (p.hasGuessed && (this.game.phase === 'reveal' || this.game.phase === 'result')) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 16px "Segoe UI", sans-serif';
                ctx.fillText(`PALPITE: ${p.guess}`, 0, 145);
            }

            ctx.restore();
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#adb5bd';
        ctx.font = '600 24px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QUAL O VALOR DA APOSTA?', centerX, centerY - 80);

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 80px "Segoe UI", sans-serif';
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(255, 204, 0, 0.4)';
        ctx.fillText(`R$ ${this.game.selectedBet}`, centerX, centerY + 10);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#6c757d';
        ctx.font = '16px "Segoe UI", sans-serif';
        ctx.fillText(`Pote Final: R$ ${this.game.selectedBet * this.game.players.length}`, centerX, centerY + 80);
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#adb5bd';
        ctx.font = '600 24px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PEDRAS NA MÃO? (0-3)', centerX, centerY - 80);

        ctx.font = '100px "Segoe UI Emoji", Arial';
        const stoneDisplay = this.game.selectedStones > 0 ? '🪨'.repeat(this.game.selectedStones) : '∅';
        ctx.fillText(stoneDisplay, centerX, centerY + 20);

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 42px "Segoe UI", sans-serif';
        ctx.fillText(`${this.game.selectedStones}`, centerX, centerY + 100);
    }

    private drawGuessingUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#adb5bd';
        ctx.font = '600 24px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QUAL O TOTAL DA MESA?', centerX, centerY - 90);

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 90px "Segoe UI", sans-serif';
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(255, 204, 0, 0.4)';
        ctx.fillText(`${this.game.selectedGuess}`, centerX, centerY + 10);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#6c757d';
        ctx.font = '600 16px "Segoe UI", sans-serif';
        ctx.fillText(`(Total possível: 0 - ${this.game.maxPossibleTotal})`, centerX, centerY + 80);

        ctx.fillStyle = '#44aaff';
        ctx.fillText(`Suas pedras: ${this.game.selectedStones}`, centerX, centerY + 110);
    }

    private drawRevealUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 36px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ABRINDO AS MÃOS...', centerX, centerY);

        if (this.game.revealIndex >= 0) {
            const revealed = this.game.players.slice(0, this.game.revealIndex + 1);
            const partialTotal = revealed.reduce((s, p) => s + p.stones, 0);
            ctx.fillStyle = '#6c757d';
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillText(`Soma parcial: ${partialTotal}`, centerX, centerY + 70);
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
        ctx.fillStyle = '#adb5bd';
        ctx.font = '600 24px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`TOTAL NA MESA: ${this.game.totalStones}`, centerX, centerY - 50);

        const isWin = this.game.winner?.isHuman;
        ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
        ctx.font = 'bold 48px "Segoe UI", sans-serif';
        ctx.shadowBlur = 20;
        ctx.shadowColor = isWin ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)';
        ctx.fillText(this.game.resultMessage.toUpperCase(), centerX, centerY + 40);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '600 16px "Segoe UI", sans-serif';
        ctx.fillText('ESPAÇO JOGAR NOVAMENTE  |  ENTER CONTINUAR', centerX, centerY + 110);
    }
}
