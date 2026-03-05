import { HorseRacingGame } from './HorseRacingGame';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import type { IMinigameUI } from './BaseMinigame';

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
        const input = (window as any).gameInput;
        if (!input) return;

        if (this.game.phase === 'betting') {
            // Selection logic
            if (input.wasPressed('ArrowUp')) this.game.selectedHorse = (this.game.selectedHorse - 1 + 8) % 8;
            if (input.wasPressed('ArrowDown')) this.game.selectedHorse = (this.game.selectedHorse + 1) % 8;

            // Bet adjustment
            if (input.wasPressed('ArrowLeft')) this.game.betAmount = Math.max(10, this.game.betAmount - 10);
            if (input.wasPressed('ArrowRight')) this.game.betAmount = Math.min(500, this.game.betAmount + 10);

            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                const bmanager = (window as any).bmanager;
                if (bmanager && bmanager.playerMoney >= this.game.betAmount) {
                    bmanager.playerMoney -= this.game.betAmount;
                    this.game.startRace(this.game.selectedHorse, this.game.betAmount);
                }
            }
        } else if (this.game.phase === 'racing') {
            this.game.update(dt);
        } else if (this.game.phase === 'result') {
            if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                this.onPlayAgain(this.game.getPayout());
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

            // Odds
            ctx.textAlign = 'right';
            ctx.fillStyle = isSelected ? theme.accent : theme.textMuted;
            ctx.font = `bold ${r(mobile ? 12 : 15)}px ${theme.bodyFont}`;
            ctx.fillText(`${horse.odds.toFixed(1)}x`, listX + listW - s(10), y + itemH / 2);
        });

        // ── Bet Context ──
        const betY = h * 0.80;
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText("APOSTA ATUAL", cx, betY);

        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(42)}px ${theme.titleFont}`;
        ctx.fillText(`R$ ${this.game.betAmount}`, cx, betY + s(40));

        const hint = mobile ? 'DPAD Selecionar • [OK] Apostar' : '↑↓ SELECIONAR • ←→ VALOR • ESPAÇO CONFIRMAR';
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

        ctx.fillStyle = 'rgba(10,25,10,0.92)'; // Deep green overlay
        ctx.fillRect(0, 0, w, h);

        const winner = this.game.winners[0];
        const isWin = winner.id === this.game.selectedHorse;

        // Royal Label
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${r(16)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText("RESULTADO OFICIAL", cx, cy - s(100));

        // Result Status
        ctx.fillStyle = isWin ? '#fff' : '#aaa';
        ctx.font = `900 ${r(54)}px ${theme.titleFont}`;
        ctx.shadowBlur = s(15);
        ctx.shadowColor = theme.accent + '44';
        ctx.fillText(isWin ? "VENCEDOR!" : "PERDEDOR", cx, cy - s(40));
        ctx.shadowBlur = 0;

        // Winner Details
        ctx.fillStyle = '#fff';
        ctx.font = `italic 700 ${r(22)}px ${theme.titleFont}`;
        ctx.fillText(winner.name.toUpperCase(), cx, cy + s(20));

        if (isWin) {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(28)}px ${theme.bodyFont}`;
            ctx.fillText(`+ R$ ${this.game.getPayout()}`, cx, cy + s(70));
        }

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText("ESPAÇO PARA NOVA PARTIDA", cx, h - s(80));
    }
}
