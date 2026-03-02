import { JokenpoGame } from './JokenpoGame';
import type { JokenpoChoice } from './JokenpoGame';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { BichoManager } from '../BichoManager';

export class JokenpoUI {
    private game: JokenpoGame;
    private input: InputManager;
    private onClose: (moneyChange: number) => void;
    private onPlayAgain: (moneyChange: number) => void;
    private showdownTimer: number = 0;

    constructor(game: JokenpoGame, onClose: (moneyChange: number) => void, onPlayAgain: (moneyChange: number) => void) {
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
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('Digit1') || (this.game.playerChoice === 'rock' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('rock');
                this.showdownTimer = 2.0;
            } else if (this.input.wasPressed('Digit2') || (this.game.playerChoice === 'paper' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('paper');
                this.showdownTimer = 2.0;
            } else if (this.input.wasPressed('Digit3') || (this.game.playerChoice === 'scissors' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('scissors');
                this.showdownTimer = 2.0;
            }

            // Selection navigation if not using numbers
            if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
                this.navigateChoice(-1);
            }
            if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
                this.navigateChoice(1);
            }
        } else if (phase === 'showdown') {
            this.showdownTimer -= dt;
            if (this.showdownTimer <= 0) {
                this.game.determineWinner();
            }
        } else if (phase === 'result') {
            const canPlayAgain = BichoManager.getInstance().playerMoney + this.game.settle() >= this.game.minBet;
            if (canPlayAgain && (this.input.wasPressed('Space') || this.input.wasPressed('KeyR'))) {
                this.onPlayAgain(this.game.settle());
                this.showdownTimer = 0;
            } else if (!canPlayAgain && (this.input.wasPressed('Space') || this.input.wasPressed('KeyR'))) {
                // Flash money or show notification? ExplorationScene handles notifications.
                // We'll just force them to exit if they can't afford the minimum.
                const moneyChange = this.game.settle();
                this.onClose(moneyChange);
            }
        }

        if (this.input.wasPressed('Escape')) {
            const moneyChange = (this.game.phase === 'result') ? this.game.settle() : 0;
            this.onClose(moneyChange);
        }
    }

    private navigateChoice(dir: number) {
        const choices: JokenpoChoice[] = ['rock', 'paper', 'scissors'];
        let idx = choices.indexOf(this.game.playerChoice);
        if (idx === -1) idx = 0;
        else idx = (idx + dir + choices.length) % choices.length;
        this.game.playerChoice = choices[idx];
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        // Dark background with gradient
        ctx.globalAlpha = 1.0;
        const bgGrad = ctx.createRadialGradient(screenW / 2, screenH / 2, 0, screenW / 2, screenH / 2, screenH);
        bgGrad.addColorStop(0, 'rgba(20, 20, 40, 0.98)');
        bgGrad.addColorStop(1, 'rgba(10, 10, 20, 1)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, screenW, screenH);

        const cx = screenW / 2;

        // ── Zonas de layout proporcionais ──
        const TITLE_H = screenH * 0.12;
        const CONTENT_H = screenH * 0.60;
        const contentCY = TITLE_H + CONTENT_H * 0.5;

        // Title
        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${UIScale.r(mobile ? 20 : 26)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(15);
        ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
        ctx.fillText('JO KEN PO', cx, screenH * 0.15);
        ctx.shadowBlur = 0;

        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, contentCY);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, contentCY);
        } else if (phase === 'showdown') {
            this.drawShowdownUI(ctx, cx, contentCY);
        } else if (phase === 'result') {
            this.drawResultUI(ctx, cx, contentCY);
        }

        // Footer hint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const hint = mobile
            ? '[E/OK] CONFIRMAR | [✕] SAIR'
            : 'AD/ENTER SELECIONAR | ESC SAIR';
        ctx.fillText(hint, cx, screenH - s(20));
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('VALOR DA APOSTA', cx, cy - s(60));

        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${UIScale.r(mobile ? 48 : 64)}px "Segoe UI", sans-serif`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';
        ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(10));
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.fillText('[↑↓] AJUSTAR', cx, cy + s(60));
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PEDRA, PAPEL OU TESOURA?', cx, cy - s(120));

        const options: { id: JokenpoChoice, icon: string, label: string }[] = [
            { id: 'rock', icon: '✊', label: 'PEDRA' },
            { id: 'paper', icon: '✋', label: 'PAPEL' },
            { id: 'scissors', icon: '✌️', label: 'TESOURA' }
        ];

        const spacing = s(mobile ? 90 : 120);
        options.forEach((opt, i) => {
            const x = cx + (i - 1) * spacing;
            const selected = this.game.playerChoice === opt.id;
            this.drawOption(ctx, x, cy, opt.icon, opt.label, selected);
        });
    }

    private drawOption(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string, label: string, selected: boolean) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const size = s(mobile ? 60 : 80);

        if (selected) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.roundRect(x - size, y - size, size * 2, size * 2, s(15));
            ctx.fill();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = s(5);
            ctx.stroke();

            // Selection glow
            ctx.shadowBlur = s(25);
            ctx.shadowColor = '#00ffff';
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.roundRect(x - size, y - size, size * 2, size * 2, s(15));
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = s(1);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.font = `${s(mobile ? 50 : 60)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; // Ensure icon is opaque
        ctx.fillText(icon, x, y);
        ctx.shadowBlur = 0;

        ctx.fillStyle = selected ? '#fff' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = `${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
        ctx.fillText(label, x, y + size + s(15));
    }

    private drawShowdownUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const getIcon = (c: JokenpoChoice) => {
            if (c === 'rock') return '✊';
            if (c === 'paper') return '✋';
            if (c === 'scissors') return '✌️';
            return '?';
        };

        // Player side
        this.drawShowdownHand(ctx, cx - s(mobile ? 80 : 120), cy, getIcon(this.game.playerChoice), 'VOCÊ', '#00ffff');

        // VS
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 24)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('VS', cx, cy);

        // NPC side (revealing or hidden)
        const isRevealed = this.showdownTimer < 0.5;
        const npcIcon = isRevealed ? getIcon(this.game.npcChoice) : '❓';
        this.drawShowdownHand(ctx, cx + s(mobile ? 80 : 120), cy, npcIcon, 'BANCA', '#ff3366');

        // Counting text
        let countText = 'JO...';
        if (this.showdownTimer < 1.3) countText = 'KEN...';
        if (this.showdownTimer < 0.6) countText = 'PO!';

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 20 : 30)}px "Press Start 2P", monospace`;
        ctx.fillText(countText, cx, cy - s(120));
    }

    private drawShowdownHand(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string, label: string, color: string) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(x, y, s(mobile ? 55 : 75), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = s(3);
        ctx.stroke();

        ctx.shadowBlur = s(20);
        ctx.shadowColor = color;

        ctx.font = `${s(mobile ? 55 : 75)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; // Ensure icon is opaque
        ctx.fillText(icon, x, y);
        ctx.shadowBlur = 0;

        ctx.fillStyle = color;
        ctx.font = `bold ${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.fillText(label, x, y + s(mobile ? 70 : 100));
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        const getIcon = (c: JokenpoChoice) => {
            if (c === 'rock') return '✊';
            if (c === 'paper') return '✋';
            if (c === 'scissors') return '✌️';
            return '?';
        };

        // Final Hands
        this.drawShowdownHand(ctx, cx - s(mobile ? 80 : 120), cy - s(40), getIcon(this.game.playerChoice), 'VOCÊ', '#00ffff');
        this.drawShowdownHand(ctx, cx + s(mobile ? 80 : 120), cy - s(40), getIcon(this.game.npcChoice), 'BANCA', '#ff3366');

        // Result Message
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 16 : 22)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.game.resultMessage, cx, cy + s(mobile ? 100 : 120));

        const canPlayAgain = BichoManager.getInstance().playerMoney + this.game.settle() >= this.game.minBet;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = `${UIScale.r(mobile ? 8 : 10)}px "Press Start 2P", monospace`;
        const hint = canPlayAgain
            ? (mobile ? '[OK] NOVAMENTE' : '[ESPAÇO] NOVAMENTE')
            : (mobile ? '[✕] SEM SALDO - SAIR' : '[ESC] SEM SALDO - SAIR');
        ctx.fillText(hint, cx, cy + s(mobile ? 130 : 150));
    }
}
