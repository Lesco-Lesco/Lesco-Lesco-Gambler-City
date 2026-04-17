import { JokenpoGame } from './JokenpoGame';
import type { JokenpoChoice } from './JokenpoGame';
import { InputManager } from '../Core/InputManager';
import { EconomyManager } from '../Core/EconomyManager';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { BichoManager } from '../BichoManager';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import type { IMinigameUI } from './BaseMinigame';

export class JokenpoUI implements IMinigameUI {
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
            const { step } = EconomyManager.getInstance().getBetLimits();
            if (this.input.wasPressedOrHeld('ArrowUp', dt) || this.input.wasPressedOrHeld('KeyW', dt)) {
                this.game.selectedBet = Math.min(this.game.maxBet, this.game.selectedBet + step);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressedOrHeld('ArrowDown', dt) || this.input.wasPressedOrHeld('KeyS', dt)) {
                this.game.selectedBet = Math.max(this.game.minBet, this.game.selectedBet - step);
                SoundManager.getInstance().play('menu_select');
            }
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                this.game.confirmBet(this.game.selectedBet);
                SoundManager.getInstance().play('bet_place');
            }
        } else if (phase === 'choosing') {
            if (this.input.wasPressed('Digit1') || (this.game.playerChoice === 'rock' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('rock');
                this.showdownTimer = 2.0;
                SoundManager.getInstance().playArpeggio('jokenpo');
            } else if (this.input.wasPressed('Digit2') || (this.game.playerChoice === 'paper' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('paper');
                this.showdownTimer = 2.0;
                SoundManager.getInstance().playArpeggio('jokenpo');
            } else if (this.input.wasPressed('Digit3') || (this.game.playerChoice === 'scissors' && (this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')))) {
                this.game.play('scissors');
                this.showdownTimer = 2.0;
                SoundManager.getInstance().playArpeggio('jokenpo');
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
            if (this.input.wasPressed('Enter') || this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('KeyR')) {
                const bmanager = BichoManager.getInstance();
                const payout = this.game.settle();
                const totalMoney = bmanager.playerMoney + payout;

                if (totalMoney < this.game.minBet) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('jokenpo', 'lose');
                    bmanager.addNotification("Você está sem grana para apostar!", 3);
                    this.onClose(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : (payout < 0 ? 'lose' : 'draw'));
                    SoundManager.getInstance().playFanfare('jokenpo', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                    this.showdownTimer = 0;
                }
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

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const theme = MINIGAME_THEMES.jokenpo;

        ctx.save();
        drawMinigameBackground(ctx, screenW, screenH, theme);
        drawMinigameTitle(ctx, screenW, screenH, theme, 'PEDRA PAPEL TESOURA');

        const cx = screenW / 2;
        const cy = screenH / 2;
        const phase = this.game.phase;

        if (phase === 'betting') {
            this.drawBettingUI(ctx, cx, cy, theme);
        } else if (phase === 'choosing') {
            this.drawChoosingUI(ctx, cx, cy, theme);
        } else if (phase === 'showdown') {
            this.drawShowdownUI(ctx, cx, cy, theme);
        } else if (phase === 'result') {
            this.drawResultUI(ctx, cx, cy, theme);
        }

        const hint = isMobile() ? 'DPAD Selecionar • [OK] Confirmar' : '←→ SELECIONAR • ESPAÇO CONFIRMAR • ESC SAIR';
        drawMinigameFooter(ctx, screenW, screenH, theme, hint);
        ctx.restore();
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        const isBroke = BichoManager.getInstance().playerMoney < this.game.minBet;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.font = `600 ${r(14)}px ${theme.bodyFont}`;
            ctx.fillText('SEM GRANA!', cx, cy + s(15));
        } else {
            ctx.fillStyle = theme.accent;
            ctx.font = `800 ${r(64)}px ${theme.titleFont}`;
            ctx.shadowBlur = s(25);
            ctx.shadowColor = theme.accent + '88';
            ctx.fillText(`R$ ${this.game.selectedBet}`, cx, cy + s(15));
        }
        ctx.shadowBlur = 0;
    }

    private drawChoosingUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(mobile ? 14 : 18)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('QUAL A SUA ESCOLHA?', cx, cy - s(120));

        const options: { id: JokenpoChoice, icon: string, label: string }[] = [
            { id: 'rock', icon: '✊', label: 'PEDRA' },
            { id: 'paper', icon: '✋', label: 'PAPEL' },
            { id: 'scissors', icon: '✌️', label: 'TESOURA' }
        ];

        const spacing = s(mobile ? 100 : 140);
        options.forEach((opt, i) => {
            const x = cx + (i - 1) * spacing;
            const selected = this.game.playerChoice === opt.id;

            ctx.save();
            ctx.translate(x, cy);

            const size = s(mobile ? 48 : 55);

            // Background Circle
            if (selected) {
                ctx.fillStyle = theme.accent + '33';
                ctx.shadowBlur = s(30);
                ctx.shadowColor = theme.accent;
                ctx.beginPath();
                ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(4);
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Icon
            ctx.font = `${s(mobile ? 50 : 55)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1;
            ctx.fillText(opt.icon, 0, 0);

            // Label
            ctx.fillStyle = selected ? '#fff' : theme.textMuted;
            ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
            ctx.fillText(opt.label, 0, size * 1.6);

            ctx.restore();
        });
    }

    private drawShowdownUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const icons: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
        const getIcon = (c: JokenpoChoice) => (c ? icons[c] : '❓');

        // Animation timing
        let animText = 'JO...';
        if (this.showdownTimer < 1.3) animText = 'KEN...';
        if (this.showdownTimer < 0.6) animText = 'PO!';

        ctx.fillStyle = theme.accent;
        ctx.font = `900 ${r(mobile ? 54 : 64)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(animText, cx, cy - s(120));

        // Hands
        const xOff = s(mobile ? 85 : 130);
        const isRevealed = this.showdownTimer < 0.6;

        this.drawLargeHand(ctx, cx - xOff, cy, getIcon(this.game.playerChoice), 'VOCÊ', theme.accent, theme);
        this.drawLargeHand(ctx, cx + xOff, cy, isRevealed ? getIcon(this.game.npcChoice) : '❓', 'BANCA', theme.accentAlt, theme);

        // VS
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(24)}px ${theme.titleFont}`;
        ctx.fillText('VS', cx, cy);
    }

    private drawLargeHand(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string, label: string, color: string, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const size = s(isMobile() ? 65 : 70);

        ctx.save();
        ctx.translate(x, y);

        // Circle
        ctx.fillStyle = color + '22';
        ctx.shadowBlur = s(20);
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = s(3);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Icon
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.fillText(icon, 0, 0);

        // Label
        ctx.fillStyle = color;
        ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
        ctx.fillText(label, 0, size + s(25));

        ctx.restore();
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const iconMap: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
        const xOff = s(mobile ? 85 : 130);
        const yOff = s(mobile ? 20 : 30);

        // Show final hands smaller
        this.drawLargeHand(ctx, cx - xOff, cy - yOff, iconMap[this.game.playerChoice as string] || '❓', 'VOCÊ', theme.accent, theme);
        this.drawLargeHand(ctx, cx + xOff, cy - yOff, iconMap[this.game.npcChoice as string] || '❓', 'BANCA', theme.accentAlt, theme);

        // Result Message — quebra em até 2 linhas para não estourar a tela
        const resultFontSize = r(mobile ? 22 : 28);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${resultFontSize}px ${theme.titleFont}`;
        ctx.textAlign = 'center';

        const resultText = this.game.resultMessage.toUpperCase();
        const maxWidth = mobile ? 260 : 420;
        const words = resultText.split(' ');
        let line1 = '';
        let line2 = '';
        for (const word of words) {
            const test = line1 ? line1 + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line1) {
                line2 = line2 ? line2 + ' ' + word : word;
            } else {
                line1 = test;
            }
        }
        const lineH = s(mobile ? 28 : 34);
        const resultY = cy + s(mobile ? 95 : 100);
        ctx.fillText(line1, cx, resultY);
        if (line2) ctx.fillText(line2, cx, resultY + lineH);

        // Hint de nova partida — fonte menor e separada visualmente
        const canPlayAgain = BichoManager.getInstance().playerMoney + this.game.settle() >= this.game.minBet;
        const playNextHint = mobile ? '[OK] Nova Partida' : 'ESPAÇO PARA NOVA PARTIDA';
        const hintText = canPlayAgain ? playNextHint : 'SALDO INSUFICIENTE - ESC PARA SAIR';
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(mobile ? 11 : 13)}px ${theme.bodyFont}`;
        const hintY = resultY + (line2 ? lineH * 2 : lineH) + s(mobile ? 14 : 18);
        ctx.fillText(hintText, cx, hintY);
    }
}
