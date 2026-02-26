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
            } else if (poi.type === 'dice') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Dados ${poi.name}`, 'dice', 'dice'));
            } else if (poi.type === 'ronda') {
                this.npcs.push(new NPC(poi.x, poi.y, 'gambler', `Ronda ${poi.name}`, 'ronda', 'ronda'));
            } else if (poi.type === 'pedinte') {
                this.npcs.push(new NPC(poi.x, poi.y, 'pedinte', poi.name));
            } else {
                // Generic mapping
                let type: NPCType = 'citizen';
                if (poi.type === 'npc_homeless') type = 'homeless';
                if (poi.type === 'npc_info') type = 'info';
                if (poi.type === 'npc_casino_promoter' as any) type = 'casino_promoter';
                this.npcs.push(new NPC(poi.x, poi.y, type, poi.name));
            }
        }
    }

    private spawnPopulation() {
        const TOTAL_POPULATION = 750; // Increased from 550 for more density in alleys
        let spawned = 0;
        let attempts = 0;

        // Shopping Coordinates (Center of "Order")
        const SHOPPING_X = 130;
        const SHOPPING_Y = 125;
        const SAFE_RADIUS = 40;

        while (spawned < TOTAL_POPULATION && attempts < 12000) {
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

            const distToShop = Math.sqrt((x - SHOPPING_X) ** 2 + (y - SHOPPING_Y) ** 2);
            const isAlley = tile === TILE_TYPES.ALLEY;

            let type: NPCType = 'gambler';
            let minigame: any = null;

            // --- SECTORIZATION LOGIC ---
            if (distToShop < SAFE_RADIUS) {
                // Main Commercial/Shopping Area: mostly citizens, but some gamblers now
                if (Math.random() < 0.70) type = 'citizen';
                else type = 'gambler';
            } else if (isAlley) {
                // Alleys/Residential: almost exclusively gamblers, higher density handled by loop
                if (Math.random() < 0.95) type = 'gambler';
                else type = 'citizen';
            } else {
                // Generic streets: heavy on gamblers (the "Lesco Lesco" spirit)
                if (Math.random() < 0.25) type = 'citizen';
                else type = 'gambler';
            }

            if (type === 'gambler') {
                minigame = this.getMinigameForLocation(x, y);
            }

            // --- POLICE SPAWN CHANCE ---
            // If not a specialist (gambler/promoter), check if it should be police
            const pmanager = PoliceManager.getInstance();
            let finalType: NPCType = type;
            if (type === 'citizen') {
                const isPeriphery = pmanager.isPeriphery(x, y);
                const policeChance = isPeriphery ? 0.25 : 0.05; // 25% in periphery, 5% in city
                if (Math.random() < policeChance) {
                    finalType = 'police';
                }
            }

            this.npcs.push(new NPC(x + 0.5, y + 0.5, finalType, '', undefined, minigame));
            spawned++;
        }

        console.log(`Spawned ${spawned} generic NPCs with sectorized games.`);
    }

    private spawnPromoters() {
        // Promoters at game hubs
        const hubs = [
            { type: 'purrinha', x: 130, y: 80, name: 'Promotor da Purrinha' },   // North (Igreja)
            { type: 'dice', x: 60, y: 240, name: 'Promotor dos Dados' },        // West (Matadouro)
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
            { type: 'dice', x: 60, y: 240, weight: 1.0 },      // West/South-West (Matadouro)
            { type: 'ronda', x: 230, y: 150, weight: 1.0 },     // East (Station/Marco)
            { type: 'fan_tan', x: 130, y: 130, weight: 1.5 },   // Shopping/Central (Chinatown approach)
            { type: 'palitinho', x: 40, y: 40, weight: 1.0 },    // North-West Alleys
            { type: 'heads_tails', x: 250, y: 250, weight: 1.0 } // South-East
        ];

        let weights = { purrinha: 0.1, dice: 0.1, ronda: 0.1, fan_tan: 0.1, palitinho: 0.1, heads_tails: 0.1 };

        for (const hub of hubs) {
            const dist = Math.sqrt((x - hub.x) ** 2 + (y - hub.y) ** 2);
            // Influence decreases with distance
            const influence = Math.max(0, 1.0 - (dist / 100));
            (weights as any)[hub.type] += influence * 2.0;
        }

        const totalWeight = weights.purrinha + weights.dice + weights.ronda + (weights as any).fan_tan + (weights as any).palitinho + (weights as any).heads_tails;
        let r = Math.random() * totalWeight;

        if (r < weights.purrinha) return 'purrinha';
        if (r < weights.purrinha + weights.dice) return 'dice';
        if (r < weights.purrinha + weights.dice + weights.ronda) return 'ronda';
        if (r < weights.purrinha + weights.dice + weights.ronda + (weights as any).fan_tan) return 'fan_tan';
        if (r < weights.purrinha + weights.dice + weights.ronda + (weights as any).fan_tan + (weights as any).palitinho) return 'palitinho';
        return 'heads_tails';
    }

    public update(dt: number, playerX: number, playerY: number, tileMap: TileMap) {
        for (const npc of this.npcs) {
            npc.update(dt, playerX, playerY, tileMap);
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
