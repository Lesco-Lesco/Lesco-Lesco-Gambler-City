import { HorseRacingGame } from './HorseRacingGame';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';
import { SoundManager } from '../Core/SoundManager';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';

export class HorseRacingUI implements IMinigameUI {
    private game: HorseRacingGame;
    private onExit: (payout: number) => void;
    private onPlayAgain: (payout: number) => void;

    constructor(
        game: HorseRacingGame,
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
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) this.game.selectedHorse = (this.game.selectedHorse - 1 + 8) % 8;
            if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) this.game.selectedHorse = (this.game.selectedHorse + 1) % 8;

            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE')) {
                if (bmanager && bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startRace(this.game.selectedHorse);
                    SoundManager.getInstance().play('bet_place');
                    SoundManager.getInstance().playArpeggio('horse');
                }
            }
        } else if (this.game.phase === 'racing') {
            this.game.update(dt);
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter') || input.wasPressed('KeyE') || input.wasPressed('KeyR')) {
                const payout = this.game.getPayout();
                const totalMoney = (bmanager?.playerMoney || 0) + payout;

                if (totalMoney < 10) { // Horse racing min bet is fixed at 10 in this UI
                    SoundManager.getInstance().play('lose');
                    SoundManager.getInstance().playFanfare('horse', 'lose');
                    bmanager?.addNotification("Você está sem grana para apostar!", 3);
                    this.onExit(payout); // Exit if broke
                } else {
                    SoundManager.getInstance().play(payout > 0 ? 'win_small' : 'lose');
                    SoundManager.getInstance().playFanfare('horse', payout > 0 ? 'win' : 'lose');
                    this.onPlayAgain(payout);
                }
            }
        }

        if (input.wasPressed('Escape')) {
            const payout = (this.game.phase === 'result') ? this.game.getPayout() : 0;
            this.onExit(payout);
        }

    }

    public render(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const theme = MINIGAME_THEMES.horseracing;

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

        drawMinigameTitle(ctx, w, h, theme, "GP LESCO-LESCO");

        // ── Selection List ──
        const listW = Math.min(w * 0.9, s(mobile ? 380 : 500));
        const itemH = s(mobile ? 32 : 42);
        const listX = cx - listW / 2;
        const listY = h * 0.18;

        this.game.horses.forEach((horse, i) => {
            const isSelected = this.game.selectedHorse === i;
            const y = listY + i * itemH;

            if (isSelected) {
                // Classic gold underline selection
                ctx.fillStyle = theme.accent + '15';
                ctx.fillRect(listX, y, listW, itemH);

                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(3);
                ctx.beginPath();
                ctx.moveTo(listX, y + itemH - s(2));
                ctx.lineTo(listX + listW, y + itemH - s(2));
                ctx.stroke();
            }

            // Horse Icon & Name
            ctx.fillStyle = isSelected ? '#fff' : theme.textMuted;
            ctx.font = `bold ${r(mobile ? 14 : 17)}px ${theme.titleFont}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const numText = `${i + 1}.`;
            ctx.fillText(numText, listX + s(10), y + itemH / 2);
            ctx.fillText(horse.name.toUpperCase(), listX + s(50), y + itemH / 2);
        });

        // ── Fixed Bet Display ──
        const betY = h * 0.80;
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText('ENTRADA', cx, betY);

        const bmanager = (window as any).bmanager;
        const isBroke = (bmanager?.playerMoney || 0) < this.game.betAmount;
        if (isBroke) {
            ctx.fillStyle = '#f87171';
            ctx.font = `bold ${r(24)}px ${theme.titleFont}`;
            ctx.fillText('SEM GRANA!', cx, betY + s(40));
        } else {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(42)}px ${theme.titleFont}`;
            ctx.fillText(`R$ ${this.game.betAmount}`, cx, betY + s(40));
        }

        const hint = mobile ? 'DPAD Selecionar • [OK] Apostar' : '↑↓ SELECIONAR • ESPAÇO CONFIRMAR';
        drawMinigameFooter(ctx, w, h, theme, hint);
    }

    private drawRacingUI(ctx: CanvasRenderingContext2D, w: number, h: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Classic Grass Track
        const trackY = h * 0.15;
        const trackH = h * 0.65;
        const laneH = trackH / 8;

        // Striped Grass Effect
        for (let i = 0; i < 8; i++) {
            const ly = trackY + i * laneH;
            ctx.fillStyle = i % 2 === 0 ? '#1b4d3e' : '#235e4d'; // Aristocratic greens
            ctx.fillRect(0, ly, w, laneH);

            // White rail markers
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(0, ly, w, s(1));
        }

        const startX = s(60);
        const finishX = w - s(80);
        const raceW = finishX - startX;

        // Checkerboard Finish Line
        const chkS = s(12);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < (trackH / chkS); i++) {
            if (i % 2 === 0) ctx.fillRect(finishX, trackY + i * chkS, chkS, chkS);
            else ctx.fillRect(finishX + chkS, trackY + i * chkS, chkS, chkS);
        }

        // Horses
        this.game.horses.forEach((horse, i) => {
            const progress = horse.position / this.game.RACE_DISTANCE;
            const hx = startX + progress * raceW;
            const hy = trackY + i * laneH + laneH / 2;

            ctx.save();
            ctx.translate(hx, hy);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(0, s(12), s(18), s(6), 0, 0, Math.PI * 2);
            ctx.fill();

            // Player Marker
            if (horse.id === this.game.selectedHorse) {
                ctx.strokeStyle = theme.accent;
                ctx.lineWidth = s(2);
                ctx.setLineDash([s(4), s(4)]);
                ctx.beginPath();
                ctx.arc(0, 0, s(28), 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Pulsing glow
                const glow = Math.sin(this.game.raceTime * 10) * 0.5 + 0.5;
                ctx.shadowBlur = s(10) * glow;
                ctx.shadowColor = theme.accent;
            }

            // Sprite
            const bounce = Math.sin(this.game.raceTime * 15 + i) * s(5);
            this.renderHorseIcon(ctx, 0, bounce, s(42), horse);

            // Label
            const isLeader = horse === this.game.horses.reduce((prev, curr) => prev.position > curr.position ? prev : curr);
            if (isLeader || horse.id === this.game.selectedHorse) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = horse.id === this.game.selectedHorse ? theme.accent : '#fff';
                ctx.font = `bold ${r(11)}px ${theme.titleFont}`;
                ctx.textAlign = 'center';
                ctx.fillText(horse.name.toUpperCase(), 0, -s(35));
            }

            ctx.restore();
        });
    }

    private renderHorseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number, horse: any) {
        ctx.save();
        ctx.translate(x, y);
        ctx.filter = this.getHorseFilter(horse.color);
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.fillText("🐎", 0, 0);
        ctx.restore();
    }

    private getHorseFilter(color: string): string {
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

        ctx.fillStyle = 'rgba(10,25,10,0.93)';
        ctx.fillRect(0, 0, w, h);

        const placement = this.game.getPlacement();
        const payout = this.game.getPayout();
        const isWin = placement <= 3;
        const ordinals = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];
        // Prize in reais received (payout already includes bet return for 3rd)
        const prizeLabels: Record<number, string> = {
            1: `+ R$ ${payout - this.game.betAmount}  (🥇 PRIMEIRO!)`,
            2: `+ R$ ${payout - this.game.betAmount}  (🥈 SEGUNDO)`,
            3: `0  (🥉 TERCEIRO — aposta devolvida)`,
        };

        // Title
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(12)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('RESULTADO DA CORRIDA', cx, cy - s(130));

        // Big placement line
        ctx.fillStyle = isWin ? '#fff' : '#ff4444';
        ctx.font = `900 ${r(mobile ? 34 : 44)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(20);
        ctx.shadowColor = isWin ? theme.accent : '#ff0000';
        const placeLine = isWin
            ? `SEU CAVALO CHEGOU EM ${ordinals[placement]} LUGAR!`
            : `SEU CAVALO CHEGOU EM ${ordinals[placement]} LUGAR`;
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

        // Top-3 podium list
        const podiumLabels = ['🥇', '🥈', '🥉'];
        const podiumY = cy + s(25);
        const podiumStep = s(mobile ? 28 : 32);
        ctx.font = `bold ${r(mobile ? 13 : 15)}px ${theme.bodyFont}`;

        const top3 = this.game.winners.slice(0, 3);
        top3.forEach((h, idx) => {
            const isChosen = h.id === this.game.selectedHorse;
            ctx.fillStyle = isChosen ? theme.accent : (idx === 0 ? '#fff' : theme.textMuted);
            ctx.textAlign = 'center';
            ctx.fillText(`${podiumLabels[idx]}  ${h.name.toUpperCase()}${isChosen ? '  ◄' : ''}`, cx, podiumY + idx * podiumStep);
        });

        // Footer hint
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        const footerHint = mobile ? '[OK] NOVA PARTIDA' : '[ESPAÇO] NOVA PARTIDA';
        ctx.fillText(footerHint, cx, h - s(80));
    }
}
