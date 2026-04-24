/**
 * NPCManager — Handles the population explosion.
 * Spawns 150+ NPCs with specific zone logic.
 */

import { Camera } from '../Core/Camera';
import { NPC } from './NPC';
import type { NPCType } from './NPC';
import { POINTS_OF_INTEREST, MAP_WIDTH, MAP_HEIGHT, TILE_TYPES, MAP_DATA } from '../World/MapData';
import { TileMap } from '../World/TileMap';
import { PoliceManager } from '../PoliceManager';

export class NPCManager {
    public npcs: NPC[] = [];

    constructor() {
        this.spawnFromPOIs();
        this.spawnPromoters();
        this.spawnPopulation();
    }

    private spawnFromPOIs() {
        // Fixed NPCs from MapData
        for (const poi of POINTS_OF_INTEREST) {
            if (poi.type === 'purrinha') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Jogador ${poi.name}`, 'purrinha', 'purrinha'));
                this.npcs.push(new NPC(poi.x + 0.5, poi.y + 0.5, 'gambler', 'Apostador', 'purrinha', 'purrinha'));
            } else if (poi.type === 'domino_table') {
                // Stationary domino player
                this.npcs.push(new NPC(
                    poi.x + 0.5,
                    poi.y + 0.5,
                    'gambler',
                    poi.name,
                    'Domino Apostado',
                    'domino',
                    true // isStationary
                ));
            } else if (poi.type === 'dados') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Dados ${poi.name}`, 'dados', 'dados'));
            } else if (poi.type === 'ronda') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Ronda ${poi.name}`, 'ronda', 'ronda'));
            } else if (poi.type === 'jokenpo') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Jo Ken Po ${poi.name}`, 'jokenpo', 'jokenpo'));
            } else if (poi.type === 'pedinte') {
                this.npcs.push(new NPC(poi.x, poi.y, 'pedinte', poi.name));
            } else {
                // Generic mapping
                let type: NPCType = 'citizen';
                if (poi.type === 'npc_homeless') type = 'homeless';
                if (poi.type === 'npc_info') type = 'info';
                if (poi.type === 'npc_casino_promoter' as any) type = 'casino_promoter';
                if (poi.type === 'preacher' as any) type = 'preacher' as any;
                this.npcs.push(new NPC(poi.x, poi.y, type, poi.name));
            }
        }
    }

    private spawnPopulation() {
        const TOTAL_POPULATION = 1800; // Aumento massivo para sensação de cidade lotada
        let spawned = 0;
        let attempts = 0;

        // Shopping Coordinates (Center of "Order")
        const SHOPPING_X = 130;
        const SHOPPING_Y = 125;
        const SAFE_RADIUS = 40;

        while (spawned < TOTAL_POPULATION && attempts < 40000) {
            attempts++;
            const x = Math.floor(Math.random() * MAP_WIDTH);
            const y = Math.floor(Math.random() * MAP_HEIGHT);

            const tile = MAP_DATA[y][x];
            const isWalkable = (
                tile === TILE_TYPES.SIDEWALK ||
                tile === TILE_TYPES.PLAZA ||
                tile === TILE_TYPES.ALLEY ||
                tile === TILE_TYPES.STREET
            );

            if (!isWalkable) continue;

            const isAlley = tile === TILE_TYPES.ALLEY;
            const isStreet = tile === TILE_TYPES.STREET;
            const isPeriphery = PoliceManager.getInstance().isPeriphery(x, y);

            // Evitar que NPCs nasçam no meio da rua (STREET), forçando-os a nascer em calçadas ou praças
            if (isStreet && Math.random() < 0.95) continue;

            // Adensamento massivo em favelas e periferia
            // Descartamos spawns no asfalto/calçada comum com frequência para favorecer becos
            if (!isAlley && Math.random() < 0.25) continue; // 25% de viés para becos/favelas
            if (!isPeriphery && Math.random() < 0.15) continue; // 15% de viés extra para periferia

            const distToShop = Math.sqrt((x - SHOPPING_X) ** 2 + (y - SHOPPING_Y) ** 2);
            const inSpecialLoc = this.isInSpecialLocation(x, y);

            // 1. Redução de 50% em áreas sensíveis (Praças, Estação, Shopping Front, Igreja Front)
            if (inSpecialLoc && Math.random() < 0.5) continue;

            let type: NPCType = 'gambler';
            let minigame: any = null;

            // --- SECTORIZATION LOGIC ---
            if (inSpecialLoc) {
                // Áreas especiais: Proibido jogadores genéricos, apenas cidadãos (que agora têm diálogos locais)
                type = 'citizen';
            } else if (distToShop < SAFE_RADIUS) {
                // Main Commercial/Shopping Area: mostly citizens
                if (Math.random() < 0.85) type = 'citizen';
                else type = 'gambler';
            } else if (isAlley) {
                // Alleys/Residential: exclusively gamblers
                type = 'gambler';
            } else {
                // Generic streets: exclusively citizens
                type = 'citizen';
            }

            if (type === 'gambler') {
                minigame = this.getMinigameForLocation(x, y);
            }

            // --- POLICE SPAWN CHANCE ---
            const pmanager = PoliceManager.getInstance();
            let finalType: NPCType = type;
            if (type === 'citizen') {
                const distToStation = Math.sqrt((x - 242) ** 2 + (y - 165) ** 2);
                if (distToStation < 35 && Math.random() < 0.6) {
                    finalType = 'station_hints' as any;
                } else {
                    const isPeriphery = pmanager.isPeriphery(x, y);
                    const policeChance = isPeriphery ? 0.25 : 0.05;
                    if (Math.random() < policeChance) {
                        finalType = 'police';
                    }
                }
            }

            // --- DENSITY REDUCTION LOGIC ---
            // Consume the budget without spawning to reduce absolute numbers
            if (finalType === 'gambler' && Math.random() < 0.20) {
                spawned++;
                continue;
            }
            if (finalType !== 'gambler' && Math.random() < 0.10) {
                spawned++;
                continue;
            }

            this.npcs.push(new NPC(x + 0.5, y + 0.5, finalType, '', undefined, minigame));
            spawned++;
        }

        console.log(`Spawned ${spawned} generic NPCs with sectorized games.`);
    }

    private isInSpecialLocation(x: number, y: number): boolean {
        // Shopping Plaza
        if (x >= 108 && x <= 142 && y >= 115 && y <= 142) return true;
        // Church Front
        if (x >= 125 && x <= 135 && y >= 81 && y <= 85) return true;
        // Station Front
        if (x >= 235 && x <= 260 && y >= 149 && y <= 165) return true;
        // Square: Marques de Herval
        if (x >= 148 && x <= 168 && y >= 160 && y <= 190) return true;
        // Square: Marco Imperial
        if (x >= 225 && x <= 245 && y >= 130 && y <= 149) return true;

        return false;
    }

    private spawnPromoters() {
        // Promoters at game hubs
        const hubs = [
            { type: 'purrinha', x: 130, y: 80, name: 'Promotor da Purrinha' },   // North (Igreja)
            { type: 'dados', x: 60, y: 240, name: 'Promotor dos Dados' },        // West (Matadouro)
            { type: 'ronda', x: 232, y: 148, name: 'Promotor da Ronda' },       // East (Station)
        ];

        for (const hub of hubs) {
            this.npcs.push(new NPC(
                hub.x + 0.5,
                hub.y + 0.5,
                'promoter',
                hub.name,
                undefined,
                hub.type as any,
                true // Stationary
            ));
        }
    }

    private getMinigameForLocation(x: number, y: number): string {
        // Hubs for sectorization
        const hubs = [
            { type: 'purrinha', x: 130, y: 80, weight: 1.0 },   // North (Igreja)
            { type: 'dados', x: 60, y: 240, weight: 1.0 },      // West/South-West (Matadouro)
            { type: 'ronda', x: 230, y: 150, weight: 1.0 },     // East (Station/Marco)
            { type: 'fan_tan', x: 130, y: 130, weight: 1.5 },   // Shopping/Central (Chinatown approach)
            { type: 'palitinho', x: 40, y: 40, weight: 1.0 },    // North-West Alleys
            { type: 'cara_coroa', x: 250, y: 250, weight: 1.0 }, // South-East
            { type: 'jokenpo', x: 130, y: 190, weight: 1.2 }    // Marques de Herval area
        ];

        let weights = { purrinha: 0.1, dados: 0.1, ronda: 0.1, fan_tan: 0.1, palitinho: 0.1, cara_coroa: 0.1, jokenpo: 0.1 };

        for (const hub of hubs) {
            const dist = Math.sqrt((x - hub.x) ** 2 + (y - hub.y) ** 2);
            // Influence decreases with distance
            const influence = Math.max(0, 1.0 - (dist / 100));
            (weights as any)[hub.type] += influence * 2.0;
        }

        const totalWeight = weights.purrinha + weights.dados + weights.ronda + (weights as any).fan_tan + (weights as any).palitinho + (weights as any).cara_coroa + (weights as any).jokenpo;
        let r = Math.random() * totalWeight;

        if (r < weights.purrinha) return 'purrinha';
        if (r < weights.purrinha + weights.dados) return 'dados';
        if (r < weights.purrinha + weights.dados + weights.ronda) return 'ronda';
        if (r < weights.purrinha + weights.dados + weights.ronda + (weights as any).fan_tan) return 'fan_tan';
        if (r < weights.purrinha + weights.dados + weights.ronda + (weights as any).fan_tan + (weights as any).palitinho) return 'palitinho';
        if (r < weights.purrinha + weights.dados + weights.ronda + (weights as any).fan_tan + (weights as any).palitinho + (weights as any).cara_coroa) return 'cara_coroa';
        return 'jokenpo';
    }

    public update(dt: number, playerX: number, playerY: number, tileMap: TileMap) {
        // Optimization: LOD (Level of Detail) Update System
        // Update physics and logic fully for nearby NPCs, 
        // but throttle updates for those far away to save CPU.
        for (let i = 0; i < this.npcs.length; i++) {
            const npc = this.npcs[i];

            const dx = npc.x - playerX;
            const dy = npc.y - playerY;
            const distSq = dx * dx + dy * dy;

            // Full update for anyone within 25 tiles (increased for immersion)
            if (distSq < 625) {
                npc.update(dt, playerX, playerY, tileMap);
            }
            // Budget update for far NPCs: once every 10 frames
            else if ((i + Math.floor(Date.now() / 16)) % 10 === 0) {
                npc.update(dt * 10, playerX, playerY, tileMap);
            }
        }
    }

    public drawUI(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const npc of this.npcs) {
            // Optimization: Frustum cull
            const { sx, sy } = camera.worldToScreen(npc.x, npc.y);
            if (sx < -100 || sx > ctx.canvas.width + 100 || sy < -100 || sy > ctx.canvas.height + 100) continue;

            npc.drawUI(ctx, camera);
        }
    }

    public getNearbyInteractable(playerX: number, playerY: number): NPC | null {
        let closest: NPC | null = null;
        let closestDist = Infinity;

        for (const npc of this.npcs) {
            if (npc.isPlayerNearby) {
                // Interact range check in generic units
                const dist = Math.sqrt((npc.x - playerX) ** 2 + (npc.y - playerY) ** 2);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = npc;
                }
            }
        }
        return closest;
    }
}
