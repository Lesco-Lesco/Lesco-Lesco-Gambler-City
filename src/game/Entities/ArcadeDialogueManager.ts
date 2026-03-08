import { Camera } from '../Core/Camera';
import { ARCADES } from '../World/MapData';
import { SoundManager } from '../Core/SoundManager';

interface ArcadeState {
    x: number;
    y: number;
    name: string;
    phrases: string[];
    dialogueCooldown: number;
    activeDialogue: string | null;
    activeTimer: number;
}

export class ArcadeDialogueManager {
    private arcades: ArcadeState[] = [];
    private readonly DETECTION_RADIUS = 3;

    constructor() {
        this.arcades = ARCADES.map(a => ({
            x: a.x,
            y: a.y,
            name: a.name,
            phrases: a.phrases,
            dialogueCooldown: 0,
            activeDialogue: null,
            activeTimer: 0
        }));
    }

    public update(dt: number, px: number, py: number) {
        for (const arcade of this.arcades) {
            if (arcade.activeTimer > 0) {
                arcade.activeTimer -= dt;
                if (arcade.activeTimer <= 0) {
                    arcade.activeDialogue = null;
                    arcade.dialogueCooldown = 5 + Math.random() * 10;
                }
            }

            if (arcade.dialogueCooldown > 0) {
                arcade.dialogueCooldown -= dt;
            }

            if (arcade.activeDialogue === null && arcade.dialogueCooldown <= 0) {
                const dx = px - arcade.x;
                const dy = py - arcade.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.DETECTION_RADIUS) {
                    this.triggerDialogue(arcade);
                }
            }
        }
    }

    private triggerDialogue(arcade: ArcadeState) {
        // Use the arcade's own unique phrases
        const phrase = arcade.phrases[Math.floor(Math.random() * arcade.phrases.length)];
        arcade.activeDialogue = phrase;
        arcade.activeTimer = 3.5;
        SoundManager.getInstance().play('dialogue_bip');
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const arcade of this.arcades) {
            if (arcade.activeDialogue) {
                const { sx, sy } = camera.worldToScreen(arcade.x, arcade.y);
                const zoom = camera.zoom;

                ctx.save();
                ctx.font = `${Math.round(10 * zoom)}px monospace`;
                const lines = arcade.activeDialogue.split('\n');
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
                const by = sy - 80 * zoom - bh;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.strokeStyle = '#00ff88'; // Neon green
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
