import { Camera } from '../Core/Camera';
import { SoundManager } from '../Core/SoundManager';

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
    "O bicho correu? Pois é, aqui na estação ele corre sempre pro mesmo lado.",
    "Sabe aquele matadouro? Pois é, tem muito osso rolando por lá.",
    "A viatura está sem combustível... se é que você me entende.",
    "Mantenha a discrição e a gente mantém a amizade.",
    "O Shopping é bonito por fora, né? Pena que o subsolo é tão 'gelado'.",
    "Estou de olho nessa sua cara de quem vai aprontar.",
    "Um bom cidadão sempre colabora com as forças da lei. E a colaboração é em espécie.",
    "Os becos são escuros, mas a nossa lanterna ilumina quem tem contribuição.",
    "Eu podia te parar agora mesmo, mas minha mão tá no bolso esperando o clima esfriar.",
    "Já viu como as algemas apertam no frio? Melhor evitar o desconforto, amigão.",
    "Tem gente que joga e tem gente que paga pra jogar. Nós somos a mensalidade.",
    "Evite correr na praça. Dá impressão de que você deve algo. E se deve, paga pra nós.",
    "Cuidado com os malandros do shopping. O único pedágio oficial aqui somos nós.",
    "Seja esperto. Fale baixo, ande devagar e sempre traga um extra na carteira."
];

const GAME_INFO = [
    "Dizem que o ar condicionado do Shopping esconde barulhos interessantes lá embaixo...",
    "Se você perder o trem, talvez encontre algo mais lucrativo nos fundos da Estação.",
    "A Praça Marques de Herval tem uns 'matemáticos' muito dedicados em certas mesas.",
    "Procurando por animais? O bicheiro da esquina costuma ser bem atencioso com estranhos.",
    "Cuidado com os dados na praça. A sorte é cega, mas a gente também pode ser.",
    "Se o bolso estiver pesado, tem gente no subsolo do Shopping que pode te ajudar a aliviar.",
    "No Beco do Matadouro, o dado não cai, ele 'voa'.",
    "Já ouviu falar da Ronda da Estação? É onde os trilhos encontram o baralho.",
    "O cassino underground tem um leão na porta. Não esqueça do carinho dele.",
    "A Purrinha ali perto da Igreja é jogo de gente grande.",
    "Quer ganhar rápido? Cuidado pra não perder mais rápido ainda.",
    "O dominó da praça não é para amadores. As velhas raposas têm memória de elefante.",
    "Dizem que a roleta do shopping foi calibrada na Europa. Ou pelo menos é o que o gerente fala.",
    "Tem um cara que lê a mente na purrinha. Ou ele lê a mente, ou ele tem carta na manga.",
    "Se você for pro lado da favela, esconde o relógio. Mas leva dinheiro vivo pro jogo.",
    "Cara ou coroa no beco não tem gravidade, tem magnetismo. Fica esperto com as moedas pesadas.",
    "O jokenpo perto da estação? As crianças de lá apostam o lanche inteiro. São duras na queda.",
    "Se a polícia chegar no meio da ronda, joga o baralho no bueiro e finge que tá esperando o trem.",
    "O Fan-Tan é lento, mas a grana sobe rápido se você souber contar os grãos.",
    "Quem aposta tudo na primeira rodada é turista. Malandro de verdade sente o clima antes."
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
                    SoundManager.getInstance().play('dialogue_bip');
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
        ctx.save();
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
        ctx.restore();
    }
}
