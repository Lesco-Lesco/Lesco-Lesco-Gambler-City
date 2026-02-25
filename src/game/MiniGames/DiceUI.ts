/**
 * DiceUI - Visual Interface for the Dice Game
 * Layout 100% proporcional — sem coordenadas hardcoded.
 */

import { DiceGame } from './DiceGame';
import { BichoManager } from '../BichoManager';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class DiceUI {
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

    public draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const s = UIScale.s.bind(UIScale);

        // Fundo
        const grad = ctx.createRadialGradient(width / 2, height / 2, s(100), width / 2, height / 2, width);
        grad.addColorStop(0, 'rgba(20, 25, 35, 0.95)');
        grad.addColorStop(1, 'rgba(8, 8, 12, 0.99)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const cx = width / 2;
        const mobile = isMobile();

        // ── Zonas proporcionais ──
        // TITLE 12% | DICE 28% | MESSAGE 8% | PLAYERS 28% | FOOTER 24%
        const TITLE_H = height * 0.12;
        const DICE_H = height * 0.28;
        const MSG_H = height * 0.08;
        const PLAYERS_H = height * 0.28;
        const FOOTER_H = height * 0.24;

        const titleY = TITLE_H * 0.70;
        const diceCY = TITLE_H + DICE_H * 0.52;
        const msgY = TITLE_H + DICE_H + MSG_H * 0.55;
        const playersY = TITLE_H + DICE_H + MSG_H;
        const footerY = TITLE_H + DICE_H + MSG_H + PLAYERS_H;

        // ── Título ──
        ctx.shadowBlur = s(15);
        ctx.shadowColor = '#00aaff';
        ctx.fillStyle = '#00aaff';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 22)}px \"Press Start 2P\", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('DADOS DE RUA', cx, titleY);
        ctx.shadowBlur = 0;

        // ── Dados ──
        const diceSize = Math.min(s(mobile ? 80 : 110), DICE_H * 0.85, width * 0.18);
        const diceSpacing = Math.min(s(mobile ? 55 : 80), width * 0.20);
        this.drawDie(ctx, cx - diceSpacing, diceCY, this.game.dice1, diceSize);
        this.drawDie(ctx, cx + diceSpacing, diceCY, this.game.dice2, diceSize);

        // ── Mensagem ──
        ctx.fillStyle = this.game.winner?.isHuman ? '#44ff44' : '#ffffff';
        ctx.font = `600 ${UIScale.r(mobile ? 10 : 13)}px \"Segoe UI\", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.game.message, cx, msgY);

        // ── Lista de jogadores ──
        this.drawPlayersList(ctx, cx, playersY, PLAYERS_H, width);

        // ── Rodapé ──
        if (this.game.phase === 'betting') {
            this.drawBettingInterface(ctx, cx, footerY, FOOTER_H, width);
        } else if (this.game.phase === 'result') {
            ctx.fillStyle = '#ffff66';
            ctx.font = `bold ${UIScale.r(mobile ? 9 : 11)}px \"Press Start 2P\", monospace`;
            const resultHint = mobile
                ? '[OK] Jogar Novamente   [✕] Sair'
                : '[ESPAÇO] Jogar Novamente   [ESC] Sair';
            ctx.fillText(resultHint, cx, footerY + FOOTER_H * 0.35);
        }
    }

    private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, size: number) {
        const s = UIScale.s.bind(UIScale);

        if (this.game.isRolling) {
            x += (Math.random() - 0.5) * s(12);
            y += (Math.random() - 0.5) * s(12);
            value = Math.floor(Math.random() * 6) + 1;
        }

        ctx.fillStyle = '#f0f0f5';
        ctx.shadowBlur = s(20);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, s(12));
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ccccdd';
        ctx.lineWidth = s(2);
        ctx.stroke();

        ctx.fillStyle = '#222';
        const pipSize = size * 0.10;
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

    private drawPlayersList(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const players = this.game.players;

        // Card proporcional à zona disponível
        const cardH = Math.min(zoneH * 0.90, s(mobile ? 100 : 130));
        const cardW = Math.min(s(mobile ? 130 : 160), (screenW * 0.92) / players.length - s(8));
        const spacing = cardW + s(8);
        const startX = cx - (players.length - 1) * spacing / 2;
        const cardTop = zoneTop + (zoneH - cardH) / 2;

        players.forEach((p, i) => {
            const px = startX + i * spacing;
            const isWinner = this.game.winner === p;

            ctx.fillStyle = isWinner ? 'rgba(50, 205, 50, 0.2)' : 'rgba(255, 255, 255, 0.05)';
            if (p.isHuman && this.game.phase === 'betting') ctx.fillStyle = 'rgba(0, 170, 255, 0.1)';

            ctx.beginPath();
            ctx.roundRect(px - cardW / 2, cardTop, cardW, cardH, s(10));
            ctx.fill();

            ctx.strokeStyle = isWinner ? '#44dd66' : (p.isHuman ? '#00aaff' : '#444');
            ctx.lineWidth = s(isWinner ? 2.5 : 1.5);
            if (isWinner) { ctx.shadowBlur = s(16); ctx.shadowColor = '#44dd66'; }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Nome
            const nameFontSize = UIScale.r(mobile ? 9 : 11);
            ctx.fillStyle = p.isHuman ? '#fff' : '#aaa';
            ctx.font = `bold ${nameFontSize}px \"Segoe UI\", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(p.name, px, cardTop + cardH * 0.26);

            // Escolhas / números
            if (this.game.phase !== 'betting' || !p.isHuman) {
                const numSize = UIScale.r(mobile ? 18 : 22);
                ctx.fillStyle = '#fff';
                ctx.font = `${numSize}px \"Segoe UI\", sans-serif`;
                ctx.fillText(`${p.choices[0]} & ${p.choices[1]}`, px, cardTop + cardH * 0.58);
            } else {
                // Fase betting: destaca o número ativo
                const c1Size = this.activeChoice === 0 ? UIScale.r(mobile ? 22 : 28) : UIScale.r(mobile ? 16 : 20);
                const c2Size = this.activeChoice === 1 ? UIScale.r(mobile ? 22 : 28) : UIScale.r(mobile ? 16 : 20);
                ctx.font = `bold ${c1Size}px \"Segoe UI\", sans-serif`;
                ctx.fillStyle = this.activeChoice === 0 ? '#00aaff' : '#777';
                ctx.fillText(`${this.humanChoices[0]}`, px - s(16), cardTop + cardH * 0.58);
                ctx.font = `bold ${c2Size}px \"Segoe UI\", sans-serif`;
                ctx.fillStyle = this.activeChoice === 1 ? '#00aaff' : '#777';
                ctx.fillText(`${this.humanChoices[1]}`, px + s(16), cardTop + cardH * 0.58);
                ctx.fillStyle = '#888';
                ctx.font = `${UIScale.r(mobile ? 7 : 9)}px \"Press Start 2P\", monospace`;
                ctx.fillText('SEUS Nº', px, cardTop + cardH * 0.82);
            }

            // Score resultado
            if (this.game.phase === 'result') {
                ctx.fillStyle = isWinner ? '#44dd66' : '#ff5555';
                ctx.font = `bold ${UIScale.r(mobile ? 8 : 10)}px \"Segoe UI\", sans-serif`;
                ctx.fillText(`Erro: ${p.score}`, px, cardTop + cardH * 0.92);
            }
        });
    }

    private drawBettingInterface(ctx: CanvasRenderingContext2D, cx: number, zoneTop: number, zoneH: number, _screenW: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const labelY = zoneTop + zoneH * 0.20;
        const valueY = zoneTop + zoneH * 0.56;
        const hintY = zoneTop + zoneH * 0.86;

        ctx.fillStyle = '#aaa';
        ctx.font = `${UIScale.r(mobile ? 8 : 10)}px \"Press Start 2P\", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('A SUA APOSTA', cx, labelY);

        const betSize = Math.min(UIScale.r(mobile ? 32 : 44), zoneH * 0.32);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${betSize}px \"Segoe UI\", sans-serif`;
        ctx.shadowBlur = s(12);
        ctx.shadowColor = 'rgba(255,255,255,0.2)';
        ctx.fillText(`R$ ${this.betAmount}`, cx, valueY);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(mobile ? 7 : 9)}px \"Press Start 2P\", monospace`;
        const betHint = mobile
            ? '[🏃] Trocar  [D-Pad] Ajustar  [OK] JOGAR'
            : '[SHIFT/Q] Trocar  [SETAS] Ajustar  [ESPAÇO] JOGAR';
        ctx.fillText(betHint, cx, hintY);
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
                    setTimeout(() => { this.game.resolve(); }, 1500);
                }
            }
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                const winAmount = this.game.winner?.isHuman ? this.game.betAmount * 5 : 0;
                this.onPlayAgain(winAmount);
                this.betAmount = 10;
                this.game.reset();
            } else if (input.wasPressed('Escape') || input.wasPressed('KeyE')) {
                const winAmount = this.game.winner?.isHuman ? this.game.betAmount * 5 : 0;
                this.onClose(winAmount);
            }
        }
    }
}
