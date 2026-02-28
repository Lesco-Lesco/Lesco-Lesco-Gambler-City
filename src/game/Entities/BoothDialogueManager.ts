import { Camera } from '../Core/Camera';

interface Booth {
    x: number;
    y: number;
    dialogueCooldown: number;
    activeDialogue: string | null;
    activeTimer: number;
    scriptQueue: string[];
    scriptDelayCallback: number;
    wasInRange: boolean; // Track for "speak on approach"
}

const POLICE_PHRASES = [
    "Circulando, cidadão. Meus olhos estão 'fechados' hoje, se é que me entende.",
    "Bela noite... dependendo do quanto você está disposto a colaborar com o café da guarnição.",
    "A lei é clara, mas para bons amigos, a gente sempre encontra um ponto cego.",
    "Ande na linha. Ou pelo menos não faça barulho enquanto estiver fora dela.",
    "A segurança tem um preço, e o café aqui na cabine anda meio caro ultimamente.",
    "Não vi nada, não ouvi nada. Desde que o 'incentivo' continue chegando.",
    "Santa Cruz é uma cidade de oportunidades... para quem sabe conversar.",
];

const GAME_INFO = [
    "Dizem que o ar condicionado do Shopping esconde barulhos interessantes lá embaixo...",
    "Se você perder o trem, talvez encontre algo mais lucrativo nos fundos da Estação.",
    "A Praça Marques de Herval tem uns 'matemáticos' muito dedicados em certas mesas.",
    "Procurando por animais? O bicheiro da esquina costuma ser bem atencioso com estranhos.",
    "Cuidado com os dados na praça. A sorte é cega, mas a gente também pode ser.",
    "Se o bolso estiver pesado, tem gente no subsolo do Shopping que pode te ajudar a aliviar.",
];

export class BoothDialogueManager {
    private booth: Booth;

    constructor(x: number, y: number) {
        this.booth = {
            x,
            y,
            dialogueCooldown: 2, // Reduced initial cooldown
            activeDialogue: null,
            activeTimer: 0,
            scriptQueue: [],
            scriptDelayCallback: 0,
            wasInRange: false
        };
    }

    public update(dt: number, playerX: number, playerY: number) {
        const b = this.booth;

        // 1. Update Active Dialogue
        if (b.activeDialogue) {
            b.activeTimer -= dt;
            if (b.activeTimer <= 0) {
                b.activeDialogue = null;
            }
        }

        // 2. Process Scripts
        if (b.scriptQueue.length > 0) {
            b.scriptDelayCallback -= dt;
            if (b.scriptDelayCallback <= 0) {
                const line = b.scriptQueue.shift();
                if (line) {
                    b.activeDialogue = line;
                    const readTime = 2.5 + (line.length * 0.05);
                    b.activeTimer = readTime;
                    b.scriptDelayCallback = readTime + 1.0;
                }
            }
            return;
        }

        // 3. Proximity Trigger
        const dist = Math.sqrt((b.x - playerX) ** 2 + (b.y - playerY) ** 2);
        const TRIGGER_DIST = 8.0; // Slightly larger range for a larger booth
        const isInRange = dist <= TRIGGER_DIST;

        // Special Trigger: Just entered the range
        if (isInRange && !b.wasInRange) {
            this.startRandomDialogue();
            b.dialogueCooldown = 15 + Math.random() * 10; // Shorter cooldown after approach
        }

        b.wasInRange = isInRange;

        if (!isInRange) {
            b.dialogueCooldown -= dt * 0.5;
            return;
        }

        // Regular random chatter while in range
        b.dialogueCooldown -= dt;

        if (b.dialogueCooldown <= 0) {
            this.startRandomDialogue();
            // Reset Cooldown (Reduced: 15-25s)
            b.dialogueCooldown = 15 + Math.random() * 10;
        }
    }

    private startRandomDialogue() {
        const roll = Math.random();
        let pool = roll < 0.6 ? POLICE_PHRASES : GAME_INFO;
        const phrase = pool[Math.floor(Math.random() * pool.length)];

        this.booth.scriptQueue = [phrase];
        this.booth.scriptDelayCallback = 0;
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (this.booth.activeDialogue) {
            const { sx, sy } = camera.worldToScreen(this.booth.x, this.booth.y);
            const z = camera.zoom;

            if (sx < -100 || sx > camera.screenWidth + 100 || sy < -100 || sy > camera.screenHeight + 100) return;

            this.drawBubble(ctx, sx, sy - 20 * z, this.booth.activeDialogue, z);
        }
    }

    private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, z: number) {
        ctx.font = `${Math.max(12, 9 * z)}px monospace`;
        const metrics = ctx.measureText(text);
        const padding = 6 * z;
        const w = metrics.width + padding * 2;
        const h = 20 * z;

        // Dark Blue/Police theme bubble
        ctx.fillStyle = 'rgba(20, 30, 80, 0.95)';
        ctx.fillRect(x - w / 2, y - h, w, h);

        ctx.strokeStyle = '#ffd700'; // Gold border
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - w / 2, y - h, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - h / 2);

        // Tail
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5 * z, y + 8 * z);
        ctx.lineTo(x + 5 * z, y);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
    }
}
