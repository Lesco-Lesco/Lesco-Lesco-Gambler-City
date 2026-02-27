
import { TileMap } from '../World/TileMap';
import { Camera } from '../Core/Camera';
import { MAP_WIDTH, MAP_HEIGHT, TILE_TYPES } from '../World/MapData';

interface House {
    x: number;
    y: number;
    width: number;
    height: number;
    isPeripheral: boolean;
    dialogueCooldown: number; // Time until next potential conversation
    activeDialogue: string | null;
    activeTimer: number; // Duration of current bubble

    // Script System
    scriptQueue: string[]; // Lines waiting to be said
    scriptDelayCallback: number; // Time until next line
}

// --- SCRIPTS ---
// Format: simply an array of strings played in sequence.

const ARGUMENTS_PERIPHERAL = [
    ["CADÊ MEU DINHEIRO?!", "Gastei no bicho, calma!", "CALMA?! VOU TE MATAR!", "SOCORRO!"],
    ["SAI DAÍ MOLEQUE!", "Tô só olhando, tia!", "VAI PRA CASA AGORA!", "Que saco..."],
    ["Quem é essa aí no zap?", "É minha prima, doida.", "Prima de quem?!", "Da sua mãe!"],
    ["Abaixa esse som!", "Tô curtindo, pô!", "TÁ TREMENDO A JANELA!", "Foda-se!"],
    ["Você bebeu de novo?", "Só uma latinha...", "TÁ CHEIRANDO A CACHAÇA!", "Me deixa em paz."],
];

const GOSSIP_PERIPHERAL = [
    ["Viu o vizinho novo?", "Aquele do carro vermelho?", "Dizem que é bicheiro.", "Misericórdia!"],
    ["A polícia passou aqui...", "Procurando quem?", "O filho da Maria.", "Sabia que ia dar ruim."],
    ["Vai ter churrasco hoje?", "Só se você pagar.", "Tô liso, irmão.", "Então fica com fome."],
];

const ONELINERS_PERIPHERAL = [
    ["Olha a boca, rapá!"],
    ["Se a polícia bater, ninguém viu nada."],
    ["Traz a cerveja, caramba!"],
    ["Vai dar merda isso aí..."],
    ["Desce daí agora, seu sem vergonha!"],
    ["Sai daí, vagabundo!"],
    ["Desce daí, pilantra!"],
    ["Cadê o dinheiro do aluguel?"],
    ["Vizinho fofoqueiro é foda."],
    ["Para de gritar, tem gente dormindo!"],
];

const TV_RADIO = [
    ["GOOOOOL FLAMENGOOO!", "Aumenta aí!", "Chupa vascaíno!"],
    ["Interrompemos a programação...", "Ih, morreu alguém.", "Aumenta pra eu ouvir."],
    ["...a previsão do tempo...", "Vai chover amanhã?", "Diz que sim.", "Vou tirar a roupa do varal."],
];

const ARGUMENTS_CENTRAL = [
    ["Apaga essa luz!", "Tô lendo!", "São 3 da manhã!", "E daí?"],
    ["Você não lavou a louça.", "Lavo amanhã.", "Vai lavar AGORA.", "Que chatice."],
    ["O cachorro fugiu de novo!", "Deixou o portão aberto?", "Foi você!", "Eu não!"],
];

const CASUAL_CENTRAL = [
    ["Que calor insuportável.", "Liga o ventilador.", "Tá quebrado.", "Então sofre."],
    ["O preço da carne subiu.", "De novo?", "Tá impossível viver.", "Vou virar vegetariano."],
];

const ONELINERS_CENTRAL = [
    ["Que calor do cão!"],
    ["Alguém viu o gato?"],
    ["Aumenta a TV aí!"],
    ["Hoje tem jogo, silêncio!"],
    ["Essa conta de luz tá um absurdo."],
    ["Fecha a janela, vai chover."],
    ["Onde tá o controle?"],
    ["Que cheiro de queimado é esse?"],
];


export class HouseDialogueManager {
    private houses: House[] = [];
    private tileMap: TileMap;

    constructor(tileMap: TileMap) {
        this.tileMap = tileMap;
        this.scanHouses();
    }

    private scanHouses() {
        const step = 5;

        for (let y = 0; y < MAP_HEIGHT; y += step) {
            for (let x = 0; x < MAP_WIDTH; x += step) {
                // Check center tile
                const cx = x + Math.floor(step / 2);
                const cy = y + Math.floor(step / 2);
                const tile = this.tileMap.getTile(cx, cy);

                // EXCLUSIONS (Shopping, Church, Plaza, Station)
                if (tile === TILE_TYPES.SHOPPING || tile === TILE_TYPES.CHURCH ||
                    tile === TILE_TYPES.PLAZA || tile === TILE_TYPES.ENTRANCE) continue;

                // Manual Area Exclusions
                // Station
                if (cx >= 220 && cx <= 265 && cy >= 150 && cy <= 180) continue;
                // Marco Imperial
                if (cx >= 225 && cx <= 245 && cy >= 130 && cy <= 150) continue;
                // Marques de Herval
                if (cx >= 148 && cx <= 168 && cy >= 160 && cy <= 190) continue;

                if (this.isBuildingBlock(x, y, step)) {
                    // Check if it's peripheral (Western favela, Far East favela)
                    const isPeripheral = (x < 70 || x > 230 || y > 230 || (x > 160 && y < 100)); // Adjusted for map layout

                    this.houses.push({
                        x: x + step / 2,
                        y: y + step / 2,
                        width: step,
                        height: step,
                        isPeripheral,
                        dialogueCooldown: Math.random() * 30,
                        activeDialogue: null,
                        activeTimer: 0,
                        scriptQueue: [],
                        scriptDelayCallback: 0
                    });
                }
            }
        }
    }

    private isBuildingBlock(startX: number, startY: number, size: number): boolean {
        const cx = startX + Math.floor(size / 2);
        const cy = startY + Math.floor(size / 2);
        return this.tileMap.isBuilding(cx, cy);
    }

    public update(dt: number, playerX: number, playerY: number) {
        for (const house of this.houses) {

            // --- 1. Update Active Dialogue ---
            if (house.activeDialogue) {
                house.activeTimer -= dt;
                if (house.activeTimer <= 0) {
                    house.activeDialogue = null;
                }
            }

            // --- 2. Process Scripts (Conversation Flow) ---
            if (house.scriptQueue.length > 0) {
                house.scriptDelayCallback -= dt;

                // If it's time for the next line AND the previous one is done (or almost done)
                if (house.scriptDelayCallback <= 0) {
                    // Play next line
                    const line = house.scriptQueue.shift();
                    if (line) {
                        house.activeDialogue = line;
                        // Time to read: 2s base + 0.1s per character
                        const readTime = 2.0 + (line.length * 0.05);
                        house.activeTimer = readTime;

                        // Delay before NEXT line: readTime + small pause
                        house.scriptDelayCallback = readTime + 0.5 + Math.random() * 1.0;
                    }
                }

                // If script is running, we don't start new random ones
                continue;
            }

            // --- 3. Trigger New Condition (Strict Proximity) ---

            // Distance check: "Eavesdropping" distance (very close)
            const dist = Math.sqrt((house.x - playerX) ** 2 + (house.y - playerY) ** 2);
            const EAVESDROP_DIST = 4.5; // Very close, basically passing by on sidewalk

            // If player is far, we might cooldown, but we NEVER trigger.
            if (dist > EAVESDROP_DIST) {
                // Decay cooldown slowly even if far, so when you return they might talk
                house.dialogueCooldown -= dt * 0.5;
                continue;
            }

            // If close, update cooldown normally
            house.dialogueCooldown -= dt;

            if (house.dialogueCooldown <= 0) {
                // Trigger a script!
                this.startScript(house);

                // Reset Cooldown (Reduced Frequency: ~2-4 minutes per house)
                house.dialogueCooldown = 120 + Math.random() * 120;
            }
        }
    }

    private startScript(house: House) {
        let scriptPool: string[][] = [];

        if (house.isPeripheral) {
            // Favela / Periphery
            const roll = Math.random();
            // 60% chance of one-liner (short interaction)
            if (roll < 0.60) scriptPool = ONELINERS_PERIPHERAL;
            // 20% chance of Argument
            else if (roll < 0.80) scriptPool = ARGUMENTS_PERIPHERAL;
            // 10% chance of Gossip
            else if (roll < 0.90) scriptPool = GOSSIP_PERIPHERAL;
            // 10% chance of TV
            else scriptPool = TV_RADIO;
        } else {
            // Central / Middle Class
            const roll = Math.random();
            // 70% chance of one-liner
            if (roll < 0.70) scriptPool = ONELINERS_CENTRAL;
            // 15% chance of Casual conversation
            else if (roll < 0.85) scriptPool = CASUAL_CENTRAL;
            // 10% chance of Argument
            else if (roll < 0.95) scriptPool = ARGUMENTS_CENTRAL;
            // 5% chance of TV
            else scriptPool = TV_RADIO;
        }

        // Pick a random script from the pool
        const script = scriptPool[Math.floor(Math.random() * scriptPool.length)];

        // Clone it so we can shift() from it without ruining the source
        house.scriptQueue = [...script];
        house.scriptDelayCallback = 0; // Start immediately
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const house of this.houses) {
            if (house.activeDialogue) {
                const { sx, sy } = camera.worldToScreen(house.x, house.y);
                const z = camera.zoom;

                if (sx < -100 || sx > camera.screenWidth + 100 || sy < -100 || sy > camera.screenHeight + 100) continue;

                this.drawBubble(ctx, sx, sy - 15 * z, house.activeDialogue, z, house.isPeripheral);
            }
        }
    }

    private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, z: number, isPeripheral: boolean) {
        ctx.font = `${Math.max(11, 8.8 * z)}px monospace`;
        const metrics = ctx.measureText(text);
        const padding = 5 * z;
        const w = metrics.width + padding * 2;
        const h = 18 * z;

        // Argument Check
        const isArgument = text === text.toUpperCase() && /[A-Z]/.test(text); // All caps -> Argument

        if (isArgument) {
            x += (Math.random() - 0.5) * 4;
            y += (Math.random() - 0.5) * 4;
        }

        // Box Style
        ctx.fillStyle = isArgument ? 'rgba(50, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)';
        if (isPeripheral && !isArgument) ctx.fillStyle = 'rgba(30, 30, 10, 0.9)'; // Variation

        ctx.fillRect(x - w / 2, y - h, w, h);

        // Border
        ctx.strokeStyle = isArgument ? '#ff3333' : '#ffffff';
        ctx.lineWidth = isArgument ? 2 : 1;
        ctx.strokeRect(x - w / 2, y - h, w, h);

        // Text
        ctx.fillStyle = isArgument ? '#ffcccc' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - h / 2);

        // Tail
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5 * z, y + 8 * z);
        ctx.lineTo(x + 5 * z, y);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    }
}
