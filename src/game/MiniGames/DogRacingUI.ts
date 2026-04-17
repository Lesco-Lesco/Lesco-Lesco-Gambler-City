import { DogRacingGame } from './DogRacingGame';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';


export class DogRacingUI implements IMinigameUI {
    private game: DogRacingGame;
    private onExit: (payout: number) => void;
    private onPlayAgain: (payout: number) => void;

    constructor(
        game: DogRacingGame,
        onExit: (payout: number) => void,
        onPlayAgain: (payout: number) => void
    ) {
        this.game = game;
        this.onExit = onExit;
        this.onPlayAgain = onPlayAgain;
    }

    public update(dt: number) {
        const input = InputManager.getInstance();
        const bmanager = BichoManager.getInstance();

        if (this.game.phase === 'betting') {
            // Selection logic
            if (input.wasPressedOrHeld('ArrowUp', dt) || input.wasPressedOrHeld('KeyW', dt)) {
                this.game.selectedDog = (this.game.selectedDog - 1 + 8) % 8;
                SoundManager.getInstance().play('menu_select');
            }
            if (input.wasPressedOrHeld('ArrowDown', dt) || input.wasPressedOrHeld('KeyS', dt)) {
                this.game.selectedDog = (this.game.selectedDog + 1) % 8;
                SoundManager.getInstance().play('menu_select');
            }

            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                if (bmanager && bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startRace(this.game.selectedDog);
                    SoundManager.getInstance().play('bet_place');
                    SoundManager.getInstance().playArpeggio('dog');
                }
            }
        } else if (this.game.phase === 'racing') {
            this.game.update(dt);
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE') || input.wasPressed('KeyR')) {
                const payout = this.game.getPayout();
                const totalMoney = (bmanager?.playerMoney || 0) + payout;

                if (totalMoney < 10) {
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('dog', 'lose');
                    bmanager?.addNotification("Você está sem grana para apostar!", 3);
                    this.onExit(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                    SoundManager.getInstance().playFanfare('dog', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                    this.game.reset(); // Reset includes bet refresh
                }
            }
        }

        if (input.wasPressed('Escape')) {
            const payout = this.game.phase === 'result' ? this.game.getPayout() : 0;
            this.onExit(payout);
        }

    }

    public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const theme = MINIGAME_THEMES.dogracing;

        drawMinigameBackground(ctx, w, h, theme);

        if (this.game.phase === 'betting') {
            this.drawBettingUI(ctx, w, h, theme);
        } else {
            this.drawRacingUI(ctx, w, h, theme);
            if (this.game.phase === 'result') {
                this.drawResultUI(ctx, w, h, theme);
            }
        }
    }

    private drawBettingUI(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const cx = w / 2;

        drawMinigameTitle(ctx, w, h, theme, "CORRIDA DE GALGOS");

        // ── Selection List ──
        const listW = Math.min(w * 0.9, s(mobile ? 380 : 500));
        const itemH = s(mobile ? 30 : 42);
        const listX = cx - listW / 2;
        const listY = h * 0.18;

        this.game.dogs.forEach((dog, i) => {
            const isSelected = this.game.selectedDog === i;
            const y = listY + i * itemH;

            if (isSelected) {
                const grad = ctx.createLinearGradient(listX, 0, listX + listW, 0);
                grad.addColorStop(0, theme.accent + '33');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(listX, y, listW, itemH);

                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(2);
                ctx.beginPath();
                ctx.moveTo(listX, y);
                ctx.lineTo(listX, y + itemH);
                ctx.stroke();
            }

            // Dog Badge
            ctx.fillStyle = isSelected ? '#fff' : theme.textMuted;
            ctx.font = `800 ${r(mobile ? 12 : 14)}px ${theme.bodyFont}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const numText = `#${i + 1}`;
            ctx.fillText(numText, listX + s(10), y + itemH / 2);

            // Name
            ctx.font = `bold ${r(mobile ? 14 : 17)}px ${theme.titleFont}`;
            ctx.fillStyle = isSelected ? '#fff' : '#aaa';
            ctx.textAlign = 'left';
            ctx.fillText(dog.name.toUpperCase(), listX + s(50), y + itemH / 2);
        });

        // ── Fixed Bet Display ──
        const betY = h * 0.78;
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText('ENTRADA', cx, betY);

        const bmanager = (window as any).bmanager;
        const isBroke = (bmanager?.playerMoney || 0) < this.game.betAmount;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.font = `bold ${r(24)}px ${theme.titleFont}`;
            ctx.fillText('SEM GRANA!', cx, betY + s(45));
        } else {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(48)}px ${theme.titleFont}`;
            ctx.fillText(`R$ ${this.game.betAmount}`, cx, betY + s(45));
        }

        const hint = mobile ? '[DPAD] Selecionar • [OK] Correr' : '↑↓ SELECIONAR • ESPAÇO INICIAR';
        drawMinigameFooter(ctx, w, h, theme, hint);
    }

    private drawRacingUI(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Track Background
        const trackY = h * 0.15;
        const trackH = h * 0.65;
        const laneH = trackH / 8;

        // Sand/Dirt Track Effect
        ctx.fillStyle = '#b68e5a'; // stadium dirt
        ctx.fillRect(0, trackY, w, trackH);

        // Lane Lines
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = s(2);
        for (let i = 0; i <= 8; i++) {
            const ly = trackY + i * laneH;
            ctx.beginPath();
            ctx.moveTo(0, ly);
            ctx.lineTo(w, ly);
            ctx.stroke();
        }

        const startX = s(60);
        const finishX = w - s(80);
        const raceW = finishX - startX;

        // Finish Line Checkers
        const chkS = s(12);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < (trackH / chkS); i++) {
            if (i % 2 === 0) ctx.fillRect(finishX, trackY + i * chkS, chkS, chkS);
            else ctx.fillRect(finishX + chkS, trackY + i * chkS, chkS, chkS);
        }

        // Dogs
        this.game.dogs.forEach((dog, i) => {
            const progress = dog.position / this.game.RACE_DISTANCE;
            const dx = startX + progress * raceW;
            const dy = trackY + i * laneH + laneH / 2;

            ctx.save();
            ctx.translate(dx, dy);

            // Ghost shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(0, s(12), s(16), s(5), 0, 0, Math.PI * 2);
            ctx.fill();

            // Highlight player's dog
            if (dog.id === this.game.selectedDog) {
                ctx.shadowBlur = s(15);
                ctx.shadowColor = '#fde047';
                ctx.strokeStyle = '#fde047';
                ctx.lineWidth = s(2);
                ctx.setLineDash([s(4), s(4)]);
                ctx.beginPath();
                ctx.arc(0, 0, s(24), 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.setLineDash([]);
            }

            // Sprite
            const jump = Math.sin(this.game.raceTime * 20 + i) * s(4);
            this.renderDogIcon(ctx, 0, jump, s(36), dog);

            // Minimal label if in lead or selected
            const isLeader = dog === this.game.dogs.reduce((prev, curr) => prev.position > curr.position ? prev : curr);
            if (isLeader || dog.id === this.game.selectedDog) {
                ctx.fillStyle = dog.id === this.game.selectedDog ? '#fde047' : '#fff';
                ctx.font = `bold ${r(10)}px ${theme.bodyFont}`;
                ctx.textAlign = 'center';
                ctx.fillText(dog.name.toUpperCase(), 0, -s(30));
            }

            ctx.restore();
        });

        // UI Information
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(14)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(`TEMPO: ${this.game.raceTime.toFixed(1)}s`, w / 2, trackY - s(20));
    }

    private renderDogIcon(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number, dog: any) {
        ctx.save();
        ctx.translate(x, y);
        ctx.filter = this.getDogFilter(dog.color);
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.fillText("🐕", 0, 0);
        ctx.restore();
    }

    private getDogFilter(color: string): string {
        switch (color.toUpperCase()) {
            case '#FFFFFF': return 'grayscale(1) brightness(1.8)';
            case '#D2B48C': return 'sepia(0.3) saturate(1.2) brightness(1.1)';
            case '#5C4033': return 'sepia(0.6) brightness(0.7) contrast(1.2)';
            default: return 'none';
        }
    }

    private drawResultUI(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = w / 2;
        const cy = h / 2;
        const mobile = isMobile();

        ctx.fillStyle = 'rgba(0,0,10,0.90)';
        ctx.fillRect(0, 0, w, h);

        const placement = this.game.getPlacement();
        const payout = this.game.getPayout();
        const isWin = placement <= 4;
        const ordinals = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];
        const prizeLabels: Record<number, string> = {
            1: `RECUPEROU R$ ${payout}  (🥇 PRIMEIRO!)`,
            2: `RECUPEROU R$ ${payout}  (🥈 SEGUNDO)`,
            3: `RECUPEROU R$ ${payout}  (🥉 TERCEIRO)`,
            4: `RECUPEROU R$ ${payout}  (🏅 QUARTO - Consolação)`,
        };

        // Title
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('RESULTADO DA CORRIDA', cx, cy - s(130));

        // Big placement line
        ctx.fillStyle = isWin ? '#4ade80' : '#f87171';
        ctx.font = `900 ${r(mobile ? 34 : 44)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = ctx.fillStyle + '88';
        const placeLine = isWin
            ? `SEU GALGO CHEGOU EM ${ordinals[placement]} LUGAR!`
            : `SEU GALGO CHEGOU EM ${ordinals[placement]} LUGAR`;
        ctx.fillText(placeLine, cx, cy - s(70));
        ctx.shadowBlur = 0;

        // Prize label or loss
        if (isWin) {
            ctx.fillStyle = placement === 3 ? theme.textMuted : theme.accent;
            ctx.font = `bold ${r(mobile ? 20 : 26)}px ${theme.bodyFont}`;
            ctx.fillText(prizeLabels[placement], cx, cy - s(20));
        } else {
            ctx.fillStyle = '#f87171';
            ctx.font = `bold ${r(mobile ? 20 : 26)}px ${theme.bodyFont}`;
            ctx.fillText(`VOCÊ PERDEU — R$ ${this.game.betAmount}`, cx, cy - s(20));
        }

        // Top-4 podium list
        const podiumLabels = ['🥇', '🥈', '🥉', '🏅'];
        const podiumY = cy + s(25);
        const podiumStep = s(mobile ? 28 : 32);
        ctx.font = `bold ${r(mobile ? 13 : 15)}px ${theme.bodyFont}`;
 
        const top4 = this.game.winners.slice(0, 4);
        top4.forEach((d, idx) => {
            const isChosen = d.id === this.game.selectedDog;
            ctx.fillStyle = isChosen ? '#fde047' : (idx === 0 ? '#fff' : theme.textMuted);
            ctx.textAlign = 'center';
            ctx.fillText(`${podiumLabels[idx]}  ${d.name.toUpperCase()}${isChosen ? '  ◄' : ''}`, cx, podiumY + idx * podiumStep);
        });

        // Footer hint
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText(mobile ? '[OK] Sair' : 'ESPAÇO PARA SAIR', cx, h - s(80));
    }
}
