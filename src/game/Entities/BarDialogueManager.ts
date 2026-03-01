import { Camera } from '../Core/Camera';
import { BARS } from '../World/MapData';

interface BarState {
    x: number;
    y: number;
    name: string;
    owner: string;
    propaganda: string;
    dialogueCooldown: number;
    activeDialogue: string | null;
    activeTimer: number;
}

export class BarDialogueManager {
    private bars: BarState[] = [];
    private readonly DETECTION_RADIUS = 3;

    constructor() {
        this.bars = BARS.map(b => ({
            ...b,
            dialogueCooldown: 0,
            activeDialogue: null,
            activeTimer: 0
        }));
    }

    public update(dt: number, px: number, py: number) {
        for (const bar of this.bars) {
            if (bar.activeTimer > 0) {
                bar.activeTimer -= dt;
                if (bar.activeTimer <= 0) {
                    bar.activeDialogue = null;
                    bar.dialogueCooldown = 5 + Math.random() * 10;
                }
            }

            if (bar.dialogueCooldown > 0) {
                bar.dialogueCooldown -= dt;
            }

            if (bar.activeDialogue === null && bar.dialogueCooldown <= 0) {
                const dx = px - bar.x;
                const dy = py - bar.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.DETECTION_RADIUS) {
                    this.triggerDialogue(bar);
                }
            }
        }
    }

    private triggerDialogue(bar: BarState) {
        const genericMessages = [
            "Cerveja gelada é aqui!",
            "Já viu as propostas do homem?",
            "O som tá alto, mas a resenha é boa.",
            "Aqui a polícia não entra!",
            "Bota mais uma dose aí!"
        ];

        const randomGeneric = genericMessages[Math.floor(Math.random() * genericMessages.length)];
        bar.activeDialogue = `${randomGeneric}\n"${bar.propaganda}"\nVote ${bar.owner}!`;
        bar.activeTimer = 4.0;
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const bar of this.bars) {
            if (bar.activeDialogue) {
                const { sx, sy } = camera.worldToScreen(bar.x, bar.y);
                const zoom = camera.zoom;

                // Simple bubble
                ctx.save();
                ctx.font = `${Math.round(10 * zoom)}px monospace`;
                const lines = bar.activeDialogue.split('\n');
                let maxW = 0;
                lines.forEach(l => {
                    const w = ctx.measureText(l).width;
                    if (w > maxW) maxW = w;
                });

                const padding = 5 * zoom;
                const lineHeight = 12 * zoom;
                const bw = maxW + padding * 2;
                const bh = lines.length * lineHeight + padding * 2;

                const bx = sx - bw / 2;
                const by = sy - 80 * zoom - bh; // Above the bar

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.strokeStyle = '#ffcc00'; // Political gold/yellow
                ctx.lineWidth = 1 * zoom;

                ctx.beginPath();
                ctx.roundRect(bx, by, bw, bh, 5 * zoom);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                lines.forEach((line, i) => {
                    ctx.fillText(line, sx, by + padding + (i + 0.8) * lineHeight);
                });
                ctx.restore();
            }
        }
    }
}
