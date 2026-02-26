/**
 * NPC entity — procedural street characters with physics and personality.
 * Features:
 * - AABB Collision (stops wall clipping)
 * - Sarcastic/Begging Dialogue System
 * - Enter/Exit Building logic
 */

import { Camera } from '../Core/Camera';
import { TileMap } from '../World/TileMap';
import { TILE_TYPES } from '../World/MapData';
import { drawCharacter } from './CharacterRenderer';
import type { CharacterAppearance } from './CharacterRenderer';

export type NPCType = 'citizen' | 'homeless' | 'gambler' | 'info' | 'pedinte' | 'promoter' | 'police';
export type MinigameType = 'purrinha' | 'dice' | 'ronda' | 'domino' | 'heads_tails' | 'palitinho' | 'fan_tan' | null;

interface NPCAppearance extends CharacterAppearance {
    // NPC-specific appearance can be extended here if needed
}

/** Seeded random for NPC consistency */
function seededRandom(seed: number): number {
    const n = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

function randomColor(seed: number, r: number[], g: number[], b: number[]): string {
    const rv = r[0] + seededRandom(seed) * (r[1] - r[0]);
    const gv = g[0] + seededRandom(seed + 100) * (g[1] - g[0]);
    const bv = b[0] + seededRandom(seed + 200) * (b[1] - b[0]);
    return `rgb(${Math.floor(rv)}, ${Math.floor(gv)}, ${Math.floor(bv)})`;
}

// --- DIALOGUE DATA ---
const DIALOGUES = {
    citizen: [
        ["Tá perigoso aqui hoje, hein?", "Fica esperto com o celular."],
        ["A prefeitura esqueceu da gente...", "Olha esse buraco na rua!"],
        ["O bicho tá pegando lá na praça.", "Melhor não andar sozinho."],
        ["Sabe onde tem um jogo bom?", "Tô querendo apostar uns trocados."],
        ["Eles dizem que vão arrumar, mas nunca arrumam.", "Política é tudo igual."],
        ["Cuidado com a carteira, amigo.", "Tem muito malandro por aí."],
    ],
    sarcastic: [
        ["Olha a roupa desse playboy...", "Achou que aqui era a Zona Sul?"],
        ["Tá perdido, doutor?", "O GPS não funciona na favela não."],
        ["Dinheiro não nasce em árvore, sabia?", "Me arruma 50 conto que eu te ensino a viver."],
        ["Vai ficar olhando ou vai passar o pix?", "Tô cobrando aluguel visual."],
    ],
    homeless: [
        ["Tem um trocado pro café?", "Deus te abençoe..."],
        ["A rua tá fria hoje...", "Me ajuda aí, irmão."],
        ["Tô com fome... fortalece o lanche?", "Qualquer moeda serve."],
    ],
    pedinte_aggressive: [
        ["Ei doutor! Preciso comer!", "Não vai negar um prato de comida?", "Tô vendo essa carteira cheia aí!"],
        ["Qual foi? Vai passar direto?", "Ajuda quem precisa!", "A humidade dói, sabia?"],
    ],
    gambler: [
        ["Hoje eu quebro a banca!", "Sente o cheiro da vitória."],
        ["O bicho tá viciado ali na esquina.", "Se der zebra eu tô ferrado."],
        ["Quer jogar? Aposta mínima de 10.", "Vem perder dinheiro comigo."],
    ],
    purrinha: [
        ["Quantas pedras você acha que eu tenho?", "Essa mão aqui vale ouro."],
        ["Purrinha é arte, o resto é sorte.", "Cuidado com o meu palpite!"],
        ["Lê minha mente ou lê minha mão?", "Só não vale chorar depois."],
        ["O segredo tá no dedinho...", "Apanha 10 e vê se ganha."],
    ],
    dice: [
        ["Os dados não mentem jamais.", "Sorte no jogo, azar nos amores."],
        ["Cada número conta sua história.", "Beco do Matadouro nunca falha."],
        ["Quer ver o 6-6 brilhar?", "A carapaça tá quente hoje."],
        ["Joga os ossos e reza!", "Mão gelada não ganha aposta."],
    ],
    ronda: [
        ["A banca sempre ganha? Hoje não.", "Escolha sua carta com sabedoria."],
        ["Ronda de elite é aqui, parceiro.", "O baralho tá pegando fogo!"],
        ["Corta o deck ou corta o papo.", "Essa dama aqui é traiçoeira."],
        ["Olho no descarte, malandro...", "A sorte é um bicho brabo."],
    ],
    domino: [
        ["Quer ver o 'carro-chefe' passar?", "Aqui o jogo é de mestre."],
        ["Lê a mesa ou dorme no cesto.", "Dominó na praça é tradição, playboy."],
        ["Quem não tem peça, comprou a briga.", "Bate com a 'bucha' pra ver se dói."],
    ],
    propaganda_purrinha: [
        ["Ei! Quer aprender a arte da Purrinha?", "A tradição aqui na Igreja é forte!", "Vem ver quem tem a mão mais rápida."],
        ["Opa, o jogo de purrinha vai começar!", "Aqui não é sorte, é leitura de mente!", "Chega mais, aposta mínima de 10."],
    ],
    propaganda_dice: [
        ["Os dados estão rolando no Matadouro!", "Cuidado pra não perder as calças!", "Sorte pura, sem enganação."],
        ["Quer testar sua sorte nos ossos?", "O Beco do Matadouro é onde a mágica acontece!", "Vem dobrar seus trocados aqui."],
    ],
    propaganda_ronda: [
        ["A Ronda na Estação não para!", "Baralho novo, sorte nova!", "Ganhei do trem, vou ganhar de você."],
        ["Quer uma partida rápida de Ronda?", "Aqui é o jogo dos espertos!", "Vem pra banca, o jogo tá quente."],
    ],
    heads_tails: [
        ["Cara ou coroa? A sorte está no ar!", "Uma moeda, dois destinos."],
        ["Escolha um lado e reze.", "O metal nunca mente."],
        ["O giro da moeda decide quem manda.", "Cuidado pra não perder a cabeça... ou a cara."],
        ["A gravidade é o único juiz aqui.", "Sinta o peso do metal antes do tombo."],
    ],
    palitinho: [
        ["Quem tirar o palito curto paga o pato.", "Sorte no palitinho, azar no amor."],
        ["Mãos escondidas, segredos revelados.", "Não quebre o palito!"],
        ["A ordem dos dados é a ordem do destino.", "Três palitos, uma decepção... pra alguém."],
        ["Sinta a madeira, escolha com a alma.", "Quem rola o dado mais alto, escolhe o destino mais cedo."],
    ],
    fan_tan: [
        ["O mistério do arroz...", "Conte os grãos e vença a banca."],
        ["A sabedoria milenar do Fan-Tan.", "O dragão guia a sua sorte."],
        ["Quatro em quanto, o resto é o que importa.", "O cesto esconde o que o seu olho não viu."],
        ["O dragão de ouro protege quem sabe contar.", "Deixe o arroz fluir, e a sorte virá."],
        ["Lembra: o quatro é o zero na contagem da vida.", "Sinta a seda vermelha e faça sua aposta."],
        ["Quem precisa de sorte quando se tem paciência?", "O Fan-Tan é o jogo da paz... e do lucro."]
    ],
    police: [
        ["O jogo de azar é o caminho mais rápido para a cadeia... ou pra ficar liso.", "Vi muita gente boa perdendo o rumo nesses becos."],
        ["Divertido enquanto dura, triste quando a gente chega.", "A sorte é cega, mas a polícia tem olhos em todo lugar."],
        ["Cuidado com o que aposta, o preço pode ser alto demais.", "Belo dia pra uma batida, não acha?"],
        ["Documentos? Ah, deixa pra lá, tô vendo que o problema é outro.", "Esse 'Lesco Lesco' ainda vai te meter em encrenca."],
        ["Se eu pegar você jogando, o prejuízo vai ser grande.", "A lei é clara, mas o seu juízo parece meio nublado."]
    ]
};

export class NPC {
    public x: number;
    public y: number;
    public type: NPCType;
    public name: string;
    public gameName?: string;
    public dialogue: string[] = [];

    // Appearance
    private appearance: NPCAppearance;

    // Physics
    public width: number = 0.8; // Collision box size
    public height: number = 0.8;
    private wanderTimer: number = 0;
    private wanderDirX: number = 0;
    private wanderDirY: number = 0;
    private wanderSpeed: number = 2.0; // Tiles per second
    private originX: number;
    private originY: number;
    private wanderRadius: number = 8.0; // Can roam further now

    // Stuck Detector
    private lastX: number = 0;
    private lastY: number = 0;
    private stuckTimer: number = 0;

    // Interaction
    public isPlayerNearby: boolean = false;
    public showDialogue: boolean = false;
    private dialogueTimer: number = 0;
    private currentDialogueIdx: number = 0;

    // State
    private isVisible: boolean = true;
    private enterBuildingTimer: number = 0;

    public minigameType: MinigameType = null;
    public isStationary: boolean = false;

    constructor(x: number, y: number, type: NPCType, name: string, gameName?: string, minigameType?: MinigameType, isStationary: boolean = false) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.type = type;
        this.name = name;
        this.gameName = gameName;
        this.minigameType = minigameType || null;
        this.isStationary = isStationary;

        // Auto-assign random minigame if gambler and none specified
        if (this.type === 'gambler' && !this.minigameType) {
            const r = Math.random();
            if (r < 0.15) this.minigameType = 'purrinha';
            else if (r < 0.3) this.minigameType = 'dice';
            else if (r < 0.45) this.minigameType = 'ronda';
            else if (r < 0.6) this.minigameType = 'heads_tails';
            else if (r < 0.8) this.minigameType = 'palitinho';
            else this.minigameType = 'fan_tan';
        }

        const seed = x * 1000 + y;
        this.appearance = this.generateAppearance(seed);
        this.dialogue = this.generateDialogue(seed);
        this.wanderTimer = seededRandom(seed) * 3;
    }

    private generateAppearance(seed: number): NPCAppearance {
        // ... (Similar logic, tweaked colors)
        const isBeggar = this.type === 'homeless' || this.type === 'pedinte';
        if (isBeggar) {
            return {
                bodyColor: randomColor(seed, [50, 80], [40, 60], [30, 50]), // Drab
                legColor: randomColor(seed + 1, [30, 50], [30, 50], [20, 40]),
                skinColor: randomColor(seed + 2, [100, 160], [70, 120], [40, 90]),
                hasHat: seededRandom(seed + 3) > 0.4,
                hatColor: '#333',
            };
        }
        if (this.type === 'police') {
            return {
                bodyColor: '#1a237e', // Police Blue
                legColor: '#121212',  // Black pants
                skinColor: randomColor(seed + 2, [120, 210], [90, 160], [60, 110]),
                hasHat: true,
                hatColor: '#1a237e',
            };
        }
        return {
            bodyColor: randomColor(seed, [40, 200], [40, 200], [40, 200]),
            legColor: randomColor(seed + 1, [20, 60], [20, 60], [40, 90]),
            skinColor: randomColor(seed + 2, [120, 210], [90, 160], [60, 110]),
            hasHat: seededRandom(seed + 3) > 0.7,
            hatColor: randomColor(seed + 4, [20, 200], [20, 200], [20, 200]),
        };
    }

    private generateDialogue(seed: number): string[] {
        // Universal Begging logic: Add begging line at end of ANY idle dialogue
        const beggingLine = seededRandom(seed) > 0.5 ? "Tem um trocado?" : "Fortalece aí o lanche.";

        let lines: string[] = [];

        if (this.type === 'pedinte') {
            const set = DIALOGUES.pedinte_aggressive;
            lines = set[Math.floor(seededRandom(seed) * set.length)];
            return lines; // Aggressive beggars just beg
        } else if (this.type === 'homeless') {
            const set = DIALOGUES.homeless;
            lines = set[Math.floor(seededRandom(seed) * set.length)];
            return lines;
        } else if (this.type === 'gambler') {
            // Use specialized dialogue if minigameType is known
            const set = (this.minigameType && (DIALOGUES as any)[this.minigameType])
                ? (DIALOGUES as any)[this.minigameType]
                : DIALOGUES.gambler;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'police') {
            const set = DIALOGUES.police;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else if (this.type === 'promoter') {
            // Propaganda logic based on minigameType
            const key = `propaganda_${this.minigameType || 'purrinha'}`;
            const set = (DIALOGUES as any)[key] || DIALOGUES.citizen;
            return set[Math.floor(seededRandom(seed) * set.length)];
        } else {
            // Citizen/Info
            if (seededRandom(seed) > 0.7) {
                // 30% Chance of Sarcasm
                const set = DIALOGUES.sarcastic;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            } else {
                const set = DIALOGUES.citizen;
                lines = [...set[Math.floor(seededRandom(seed) * set.length)]];
            }
            // Add begging to universal NPCs
            if (!this.gameName) {
                lines.push(beggingLine);
            }
            return lines;
        }
    }

    public update(dt: number, playerX: number, playerY: number, tileMap: TileMap) {
        if (!this.isVisible) {
            // Hidden (inside building)
            this.enterBuildingTimer -= dt;
            if (this.enterBuildingTimer <= 0) {
                this.isVisible = true; // Reappear
                this.x = this.originX; // Teleport back to spawn vicinity (or door)
                this.y = this.originY; // Simplified logic
            }
            return;
        }

        // --- BEHAVIOR ---
        // 0. Exclusion Zone: Shopping Side Entrance (114, 120)
        // If too close, push away with higher priority than wandering
        const distToEntrance = Math.sqrt((this.x - 114) ** 2 + (this.y - 120) ** 2);
        const exclusionRadius = 2.5;
        if (distToEntrance < exclusionRadius) {
            // Protect against division by zero if NPC is exactly at (114, 120)
            const safeDist = Math.max(distToEntrance, 0.001);
            const pushDirX = (this.x - 114) / safeDist;
            const pushDirY = (this.y - 120) / safeDist;
            const pushForce = (exclusionRadius - safeDist) * 1.5; // Slightly reduced force

            this.wanderDirX = pushDirX;
            this.wanderDirY = pushDirY;
            this.wanderSpeed = 0.8 + pushForce; // Lower base speed for smoother exit
            this.wanderTimer = 0.5; // Reset wander after escaping
        }

        if (!this.isStationary) {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                // Random chance to "enter" building if near one/on sidewalk
                if (Math.random() < 0.05 && this.type !== 'pedinte') {
                    const tile = tileMap.getTile(this.x, this.y);
                    if (tile === 2 || tile === 13) {
                        this.isVisible = false;
                        this.enterBuildingTimer = 10 + Math.random() * 20;
                        return;
                    }
                }

                // Pick new direction
                this.wanderTimer = 4 + Math.random() * 8;
                if (Math.random() > 0.3) {
                    this.wanderDirX = (Math.random() - 0.5) * 2;
                    this.wanderDirY = (Math.random() - 0.5) * 2;
                    const len = Math.sqrt(this.wanderDirX ** 2 + this.wanderDirY ** 2);
                    if (len > 0) { this.wanderDirX /= len; this.wanderDirY /= len; }
                    this.wanderSpeed = 0.5 + Math.random() * 0.4;
                } else {
                    this.wanderDirX = 0; this.wanderDirY = 0; // Idle
                }
            }
        } else {
            // Stationary NPCs never move
            this.wanderDirX = 0;
            this.wanderDirY = 0;
        }

        // --- PHYSICS (AABB) ---
        // Only move if not talking and NOT stationary
        if (!this.showDialogue && !this.isStationary) {
            let nextX = this.x + this.wanderDirX * this.wanderSpeed * dt;
            let nextY = this.y + this.wanderDirY * this.wanderSpeed * dt;

            // Personal Space from Player (Avoid running INTO player)
            const distP = Math.sqrt((nextX - playerX) ** 2 + (nextY - playerY) ** 2);
            if (distP < 1.0) {
                // Too close, stop or move away
                // Just stop for now to avoid "running wildly"
                nextX = this.x;
                nextY = this.y;
            }

            // Constrain to wander radius
            const dist = Math.sqrt((nextX - this.originX) ** 2 + (nextY - this.originY) ** 2);
            if (dist > this.wanderRadius) {
                // Turn back to origin
                const dx = this.originX - this.x;
                const dy = this.originY - this.y;
                const dlen = Math.sqrt(dx * dx + dy * dy);
                if (dlen > 0) {
                    this.wanderDirX = dx / dlen;
                    this.wanderDirY = dy / dlen;
                    // Reset wander timer to force a new choice once back in range
                    this.wanderTimer = 2.0;
                }
            }

            // AABB Collision Check (Realistic Asymmetric Bounds) - Tight front, safe back
            const padN = 0.05;
            const padW = 0.05;
            const padS = 0.45;
            const padE = 0.45;

            const canWalkNPC = (cx: number, cy: number) => {
                // Check all 4 corners with asymmetric padding
                const cornersWalkable =
                    tileMap.isWalkable(cx - padW, cy - padN) &&
                    tileMap.isWalkable(cx + padE, cy - padN) &&
                    tileMap.isWalkable(cx - padW, cy + padS) &&
                    tileMap.isWalkable(cx + padE, cy + padS);

                if (!cornersWalkable) return false;

                // Additional NPC restriction (avoiding entrances/special tiles)
                const tile = tileMap.getTile(cx, cy);
                return tile !== TILE_TYPES.ENTRANCE;
            };

            if (canWalkNPC(nextX, this.y)) this.x = nextX;
            if (canWalkNPC(this.x, nextY)) this.y = nextY;

            // --- STUCK DETECTOR ---
            // If we haven't moved much AND we are trying to move, teleport to spawn
            const moveDist = Math.abs(this.x - this.lastX) + Math.abs(this.y - this.lastY);
            const isTryingToMove = Math.abs(this.wanderDirX) > 0.01 || Math.abs(this.wanderDirY) > 0.01;

            if (moveDist < 0.05 && isTryingToMove) {
                this.stuckTimer += dt;
                if (this.stuckTimer > 5.0) {
                    // Teleport to origin (unstuck)
                    this.x = this.originX;
                    this.y = this.originY;
                    this.stuckTimer = 0;
                }
            } else {
                this.stuckTimer = 0;
                this.lastX = this.x;
                this.lastY = this.y;
            }
        }

        // --- PLAYER INTERACTION ---
        const distToPlayer = Math.sqrt((this.x - playerX) ** 2 + (this.y - playerY) ** 2);
        this.isPlayerNearby = distToPlayer < 2.0;

        if (this.isPlayerNearby && !this.showDialogue) {
            this.showDialogue = true;
            this.currentDialogueIdx = 0;
            this.dialogueTimer = 0;
        }

        if (this.showDialogue) {
            // Look at player
            // ... (optional direction logic)

            this.dialogueTimer += dt;
            // Advance text every 3s
            if (this.dialogueTimer > 3.0) {
                this.currentDialogueIdx++;
                this.dialogueTimer = 0;
                if (this.currentDialogueIdx >= this.dialogue.length) {
                    this.currentDialogueIdx = 0; // Loop or end? Loop for now
                }
            }
        }

        if (!this.isPlayerNearby) {
            this.showDialogue = false;
        }
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (!this.isVisible) return;

        drawCharacter(ctx, camera, this.x, this.y, this.appearance, {
            isMoving: false,
            isRunning: false,
            animFrame: 0,
            direction: 'down',
        });
    }

    public drawUI(ctx: CanvasRenderingContext2D, camera: Camera) {
        if (!this.isVisible) return;

        const { sx, sy } = camera.worldToScreen(this.x, this.y);
        const z = camera.zoom;

        // Dialogue Bubble
        if (this.showDialogue && this.dialogue.length > 0) {
            this.drawBubble(ctx, sx, sy - 35 * z, this.dialogue[this.currentDialogueIdx], z);
        }

        // E Prompt
        if (this.isPlayerNearby && !this.showDialogue) {
            ctx.fillStyle = '#ffdd00';
            ctx.font = `bold ${10 * z}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(this.gameName ? "▶ E - Jogar" : "▶ E - Ouvir", sx, sy - 25 * z);
        }
    }

    private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, z: number) {
        ctx.font = `${Math.max(10, 8 * z)}px monospace`;
        const metrics = ctx.measureText(text);
        const w = metrics.width + 10 * z;
        const h = 16 * z;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(x - w / 2, y - h, w, h);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - w / 2, y - h, w, h);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y - 5 * z);
    }
    public getInteractionType(): string | null {
        if (!this.isPlayerNearby) return null;
        if (this.type === 'gambler' && this.gameName) return 'purrinha';
        return 'dialogue';
    }
}
