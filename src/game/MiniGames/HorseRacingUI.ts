import { HorseRacingGame } from './HorseRacingGame';
import { UIScale } from '../Core/UIScale';

export class HorseRacingUI {
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

    public draw(ctx: CanvasRenderingContext2D, w: number, h: number) {

        ctx.fillStyle = '#1a3a1a'; // Turf Green
        ctx.fillRect(0, 0, w, h);

        if (this.game.phase === 'betting') {
            this.drawBetting(ctx, w, h);
        } else if (this.game.phase === 'racing') {
            this.drawRacing(ctx, w, h);
        } else if (this.game.phase === 'result') {
            this.drawRacing(ctx, w, h); // Keep track visible
            this.drawResult(ctx, w, h);
        }
    }

    private drawBetting(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.textAlign = 'center';

        // Header
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(32)}px "Segoe UI"`;
        ctx.fillText("GRANDE PRÊMIO LESCO-LESCO", w / 2, s(60));

        // Horse List
        const listX = w / 2 - s(200);
        const listY = s(125);
        const itemH = s(42);

        this.game.horses.forEach((horse, i) => {
            const isSelected = this.game.selectedHorse === i;
            const y = listY + i * itemH;

            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(listX - s(15), y - s(30), s(430), itemH - s(2));
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = s(2);
                ctx.strokeRect(listX - s(15), y - s(30), s(430), itemH - s(2));
            }

            // Consistent Rendering
            this.renderHorseIcon(ctx, listX + s(15), y - s(10), s(28), horse);

            ctx.fillStyle = isSelected ? '#fff' : '#ccc';
            ctx.font = `bold ${UIScale.r(18)}px monospace`;
            ctx.textAlign = 'left';
            ctx.fillText(`${horse.name.toUpperCase()}`, listX + s(60), y - s(10));

            ctx.textAlign = 'right';
            ctx.fillStyle = isSelected ? '#00ff00' : '#888';
            ctx.fillText(`ODDS: ${horse.odds.toFixed(1)}x`, listX + s(400), y - s(10));
        });

        // Bet Box
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(22)}px monospace`;
        ctx.fillText(`SUA APOSTA: R$ ${this.game.betAmount}`, w / 2, h - s(110));

        ctx.fillStyle = '#aaa';
        ctx.font = `${UIScale.r(14)}px monospace`;
        ctx.fillText("[↑↓] ESCOLHER CAVALO  [←→] AJUSTAR VALOR", w / 2, h - s(75));
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(18)}px monospace`;
        ctx.fillText("APOSTE COM [ESPAÇO] PARA COMEÇAR", w / 2, h - s(45));
    }

    private drawRacing(ctx: CanvasRenderingContext2D, w: number, _h: number) {
        const s = UIScale.s.bind(UIScale);

        const trackY = s(100);
        const trackH = s(400);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, trackY, w, trackH);

        const startX = s(100);
        const finishX = w - s(100);
        const trackW = finishX - startX;

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.setLineDash([s(5), s(5)]);
        ctx.lineWidth = 1;

        const laneH = trackH / 8;
        for (let i = 0; i <= 8; i++) {
            const py = trackY + i * laneH;
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(w, py);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Finish Line
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 16; i++) {
            const blockH = trackH / 16;
            if (i % 2 === 0) ctx.fillRect(finishX, trackY + i * blockH, s(12), blockH);
            else ctx.fillRect(finishX + s(12), trackY + i * blockH, s(12), blockH);
        }

        // Horses
        this.game.horses.forEach((horse, i) => {
            const py = trackY + i * laneH + laneH / 2;
            const progress = horse.position / this.game.RACE_DISTANCE;
            const hx = startX + progress * trackW;

            // Name label
            const nameSize = UIScale.r(13);
            ctx.font = `bold ${nameSize}px Arial`;
            const nameW = ctx.measureText(horse.name).width;

            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.beginPath();
            ctx.roundRect(hx - nameW / 2 - s(10), py - s(38), nameW + s(20), s(18), s(4));
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(horse.name, hx, py - s(24));

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.ellipse(hx, py + s(8), s(15), s(5), 0, 0, Math.PI * 2);
            ctx.fill();

            // Unified Rendering
            const bounce = Math.sin(this.game.raceTime * 15 + i) * s(4);
            this.renderHorseIcon(ctx, hx, py + bounce, s(38), horse);

            if (horse.id === this.game.selectedHorse) {
                ctx.strokeStyle = '#ffff00';
                ctx.setLineDash([s(4), s(2)]);
                ctx.lineWidth = s(3);
                ctx.beginPath();
                ctx.arc(hx, py, s(28), 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.moveTo(hx, py - s(45));
                ctx.lineTo(hx - s(7), py - s(58));
                ctx.lineTo(hx + s(7), py - s(58));
                ctx.fill();
            }
        });
    }

    private renderHorseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, fontSize: number, horse: any) {
        ctx.save();
        ctx.translate(x, y);

        ctx.filter = this.getHorseFilter(horse.color);
        ctx.font = `${fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("🐎", 0, 0);

        ctx.restore();
    }

    private getHorseFilter(color: string): string {
        switch (color.toUpperCase()) {
            case '#FFFFFF': // Realistic White
                return 'grayscale(1) brightness(1.8) contrast(1.1)';
            case '#D2B48C': // Light Brown (Tan)
            case '#C19A6B':
                return 'sepia(0.3) brightness(1.1) saturate(1.1)';
            case '#5C4033': // Dark Brown (Rich)
            case '#3D2B1F':
            case '#4B3621':
            case '#A0522D':
                return 'sepia(0.6) brightness(0.65) saturate(0.9)';
            default:
                return 'none';
        }
    }

    private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number) {
        const s = UIScale.s.bind(UIScale);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        const winner = this.game.winners[0];
        const isPlayerWinner = winner.id === this.game.selectedHorse;

        ctx.fillStyle = isPlayerWinner ? '#00ff00' : '#ff4444';
        ctx.font = `bold ${UIScale.r(50)}px "Segoe UI"`;
        ctx.fillText(isPlayerWinner ? "VOCÊ VENCEU!" : "VOCÊ PERDEU!", w / 2, h / 2 - s(80));

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(24)}px monospace`;
        ctx.fillText(`1º LUGAR: ${winner.name.toUpperCase()}`, w / 2, h / 2 - s(20));

        if (this.game.winners.length > 1) {
            ctx.font = `${UIScale.r(18)}px monospace`;
            ctx.fillStyle = '#aaa';
            ctx.fillText(`2º: ${this.game.winners[1].name}  3º: ${this.game.winners[2]?.name || "---"}`, w / 2, h / 2 + s(15));
        }

        if (isPlayerWinner) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `bold ${UIScale.r(30)}px monospace`;
            ctx.fillText(`PRÊMIO: R$ ${this.game.getPayout()}`, w / 2, h / 2 + s(70));
        }

        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(14)}px monospace`;
        ctx.fillText("Pressione [ESPAÇO] para continuar", w / 2, h / 2 + s(120));
    }
}
