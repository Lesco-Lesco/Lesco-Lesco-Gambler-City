/**
 * PurrinhaUI — renders the Purrinha mini-game overlay.
 * Full-screen overlay drawn on the main canvas.
 */

import { PurrinhaGame } from './PurrinhaGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

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
        const s = UIScale.s.bind(UIScale);

        const bgGrad = ctx.createLinearGradient(0, 0, 0, screenH);
        bgGrad.addColorStop(0, 'rgba(10, 15, 25, 0.96)');
        bgGrad.addColorStop(1, 'rgba(5, 5, 10, 0.99)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, screenW, screenH);

        const cx = screenW / 2;
        const mobile = isMobile();
        const fScale = mobile ? 1.0 : 1.0;

        // ── Zonas proporcionais ──
        // TITLE 10% | PLAYERS 30% | CONTENT 40% | FOOTER 20%
        const TITLE_H = screenH * 0.10;
        const PLAYERS_H = screenH * 0.30;
        const CONTENT_H = screenH * 0.40;
        const FOOTER_H = screenH * 0.20;

        const titleY = TITLE_H * 0.70;
        const playersTop = TITLE_H;
        const contentTop = TITLE_H + PLAYERS_H;
        const contentCY = contentTop + CONTENT_H * 0.50;
        const footerTop = contentTop + CONTENT_H;

        // Título
        ctx.shadowBlur = s(16);
        ctx.shadowColor = '#ffcc00';
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 22)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PURRINHA', cx, titleY);
        ctx.shadowBlur = 0;

        // Player cards (zona fixa, não sobrepõe nada)
        this.drawPlayers(ctx, cx, playersTop, PLAYERS_H, screenW);

        // Conteúdo por fase
        const phase = this.game.phase;
        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentTop, CONTENT_H);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, contentCY, CONTENT_H, fScale);
        } else if (phase === 'guessing') {
            this.drawGuessingUI(ctx, cx, contentCY, CONTENT_H, fScale);
        } else if (phase === 'reveal') {
            this.drawRevealUI(ctx, cx, contentCY);
        } else if (phase === 'result') {
            this.drawResultUI(ctx, cx, contentCY, CONTENT_H, fScale);
        }

        // Controles rodapé
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = `${UIScale.r(mobile ? 7 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const ctrlHint = mobile
            ? '[D-Pad] SELECIONAR  |  [E] CONFIRMAR  |  [✕] SAIR'
            : '↑↓ SELECIONAR  |  ENTER CONFIRMAR  |  ESC SAIR';
        ctx.fillText(ctrlHint, cx, footerTop + FOOTER_H * 0.55);
    }

    private drawPlayers(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const players = this.game.players;

        const cardH = Math.min(zoneH * 0.88, s(mobile ? 110 : 140));
        const cardW = Math.min(s(mobile ? 120 : 160), (screenW * 0.90) / players.length - s(8));
        const spacing = cardW + s(mobile ? 6 : 10);
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

            if (isWinner && isResult) { ctx.shadowBlur = s(24); ctx.shadowColor = '#ffcc00'; }
            ctx.fillStyle = (isWinner && isResult) ? 'rgba(255,204,0,0.15)' : 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(-cardW / 2, 0, cardW, cardH, s(10));
            ctx.fill();
            ctx.strokeStyle = (isWinner && isResult) ? '#ffcc00' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = (isWinner && isResult) ? s(2.5) : s(1);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = p.isHuman ? '#ff4d6d' : '#8d99ae';
            ctx.font = `bold ${UIScale.r(mobile ? 9 : 12)}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name.toUpperCase(), 0, cardH * 0.24);

            ctx.fillStyle = '#2ec4b6';
            ctx.font = `600 ${UIScale.r(mobile ? 8 : 10)}px "Segoe UI", sans-serif`;
            ctx.fillText(`R$ ${p.money}`, 0, cardH * 0.44);

            if (isRevealed || isResult) {
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.floor(cardH * 0.22)}px "Segoe UI Emoji", Arial`;
                ctx.fillText('🪨'.repeat(p.stones) || '∅', 0, cardH * 0.72);
            } else if (this.game.phase !== 'betting') {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = `${Math.floor(cardH * 0.28)}px "Segoe UI Emoji", Arial`;
                ctx.fillText('✊', 0, cardH * 0.75);
            }

            if (p.hasGuessed && (this.game.phase === 'reveal' || this.game.phase === 'result')) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = `bold ${UIScale.r(mobile ? 7 : 9)}px "Segoe UI", sans-serif`;
                ctx.fillText(`PALPITE: ${p.guess}`, 0, cardH * 0.92);
            }

            ctx.restore();
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#adb5bd';
        ctx.font = `600 ${UIScale.r(mobile ? 9 : 12)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL O VALOR DA APOSTA?', cx, zoneTop + zoneH * 0.22);

        const betFontSize = Math.floor(Math.min(UIScale.r(mobile ? 40 : 60), zoneH * 0.38));
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${betFontSize}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = 'rgba(255,204,0,0.35)';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, zoneTop + zoneH * 0.58);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#6c757d';
        ctx.font = `${UIScale.r(mobile ? 8 : 10)}px "Segoe UI", sans-serif`;
        ctx.fillText(`Pote Final: R$ ${this.game.selectedBet * this.game.players.length}`, cx, zoneTop + zoneH * 0.80);
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, _zoneH: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#adb5bd';
        ctx.font = `600 ${UIScale.r(mobile ? 9 : 12) * fScale}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('PEDRAS NA MÃO? (0-3)', cx, cy - s(mobile ? 60 : 70));

        const emojiSize = Math.floor(Math.min(UIScale.r(mobile ? 48 : 65) * fScale, s(75)));
        ctx.font = `${emojiSize}px "Segoe UI Emoji", Arial`;
        ctx.fillText(this.game.selectedStones > 0 ? '🪨'.repeat(this.game.selectedStones) : '∅', cx, cy + s(mobile ? 8 : 10));

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(mobile ? 22 : 30) * fScale}px "Segoe UI", sans-serif`;
        ctx.fillText(`${this.game.selectedStones}`, cx, cy + s(mobile ? 52 : 65));
    }

    private drawGuessingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, _zoneH: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#adb5bd';
        ctx.font = `600 ${UIScale.r(mobile ? 9 : 12) * fScale}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL O TOTAL DA MESA?', cx, cy - s(mobile ? 65 : 75));

        const numSize = Math.floor(Math.min(UIScale.r(mobile ? 50 : 68) * fScale, s(75)));
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${numSize}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = 'rgba(255,204,0,0.35)';
        ctx.fillText(`${this.game.selectedGuess}`, cx, cy + s(8));
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#6c757d';
        ctx.font = `600 ${UIScale.r(mobile ? 8 : 10) * fScale}px "Segoe UI", sans-serif`;
        ctx.fillText(`(Total possível: 0 - ${this.game.maxPossibleTotal})`, cx, cy + s(mobile ? 50 : 62));
        ctx.fillStyle = '#44aaff';
        ctx.fillText(`Suas pedras: ${this.game.selectedStones}`, cx, cy + s(mobile ? 68 : 82));
    }

    private drawRevealUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(28)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ABRINDO AS MÃOS...', cx, cy);

        if (this.game.revealIndex >= 0) {
            const revealed = this.game.players.slice(0, this.game.revealIndex + 1);
            const partialTotal = revealed.reduce((sum, p) => sum + p.stones, 0);
            ctx.fillStyle = '#6c757d';
            ctx.font = `bold ${UIScale.r(18)}px "Segoe UI", sans-serif`;
            ctx.fillText(`Soma parcial: ${partialTotal}`, cx, cy + s(55));
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, _zoneH: number, fScale: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#adb5bd';
        ctx.font = `600 ${UIScale.r(mobile ? 9 : 12) * fScale}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`TOTAL NA MESA: ${this.game.totalStones}`, cx, cy - s(mobile ? 45 : 55));

        const isWin = this.game.winner?.isHuman;
        const msgSize = Math.floor(Math.min(UIScale.r(mobile ? 20 : 28) * fScale, s(44)));
        ctx.fillStyle = isWin ? '#2ecc71' : '#e74c3c';
        ctx.font = `bold ${msgSize}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(16);
        ctx.shadowColor = isWin ? 'rgba(46,204,113,0.4)' : 'rgba(231,76,60,0.4)';
        ctx.fillText(this.game.resultMessage.toUpperCase(), cx, cy + s(mobile ? 8 : 10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = `600 ${UIScale.r(mobile ? 8 : 11) * fScale}px "Segoe UI", sans-serif`;
        ctx.fillText(
            mobile ? '[OK] JOGAR NOVAMENTE  |  [E] CONTINUAR' : 'ESPAÇO JOGAR NOVAMENTE  |  ENTER CONTINUAR',
            cx, cy + s(mobile ? 48 : 60)
        );
    }
}
