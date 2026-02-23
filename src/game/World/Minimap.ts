/**
 * Minimap — renders a small top-down overview of the map in the corner.
 * Updated for 60×60 map with new tile types.
 */

import { Camera } from '../Core/Camera';
import { TileMap } from './TileMap';
import { TILE_TYPES, MAP_WIDTH } from './MapData';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

const MINIMAP_BASE_SIZE = 160;
const MINIMAP_BASE_PADDING = 15;

const MINIMAP_COLORS: Record<number, string> = {
    [TILE_TYPES.VOID]: '#050508',
    [TILE_TYPES.STREET]: '#3a3a44',
    [TILE_TYPES.SIDEWALK]: '#4a4a55',
    [TILE_TYPES.ALLEY]: '#1a1a22',
    [TILE_TYPES.BUILDING_LOW]: '#5a4a3a',
    [TILE_TYPES.BUILDING_TALL]: '#4a4a5a',
    [TILE_TYPES.PLAZA]: '#5a5a66',
    [TILE_TYPES.GRASS]: '#1a3a18',
    [TILE_TYPES.SHOPPING]: '#6a5078',
    [TILE_TYPES.WALL]: '#5a5050',
    [TILE_TYPES.STAIRS_UP]: '#6a6a6a',
    [TILE_TYPES.STAIRS_DOWN]: '#5a5a6a',
    [TILE_TYPES.ENTRANCE]: '#3a5a7a',
    [TILE_TYPES.FENCE]: '#4a4a3a',
    [TILE_TYPES.TREE]: '#2a5a22',
};

export class Minimap {
    private minimapCanvas: HTMLCanvasElement;
    private minimapCtx: CanvasRenderingContext2D;

    constructor(tileMap: TileMap) {
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = MINIMAP_BASE_SIZE;
        this.minimapCanvas.height = MINIMAP_BASE_SIZE;
        const ctx = this.minimapCanvas.getContext('2d');
        if (!ctx) throw new Error('Minimap canvas context failed');
        this.minimapCtx = ctx;

        this.prerenderMap(tileMap);
    }

    private prerenderMap(tileMap: TileMap) {
        const mapW = tileMap.getWidth();
        const mapH = tileMap.getHeight();
        const data = tileMap.getData();
        const tileSize = MINIMAP_BASE_SIZE / Math.max(mapW, mapH);

        this.minimapCtx.fillStyle = '#050508';
        this.minimapCtx.fillRect(0, 0, MINIMAP_BASE_SIZE, MINIMAP_BASE_SIZE);

        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const tile = data[y][x];
                this.minimapCtx.fillStyle = MINIMAP_COLORS[tile] || '#050508';
                this.minimapCtx.fillRect(
                    x * tileSize, y * tileSize,
                    tileSize + 0.5, tileSize + 0.5
                );
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, playerX: number, playerY: number, _camera: Camera, npcs: any[]) {
        const s = UIScale.s.bind(UIScale);

        // Detect mobile using shared helper
        const mobile = isMobile();
        const mmSize = mobile ? s(200) : s(MINIMAP_BASE_SIZE);
        const mmPad = mobile ? s(10) : s(MINIMAP_BASE_PADDING);

        // On mobile, position top-right to avoid action buttons. On desktop, bottom-right.
        const mmX = screenW - mmSize - mmPad;
        const mmY = mobile ? mmPad : screenH - mmSize - mmPad;

        // Background with border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(mmX - s(3), mmY - s(3), mmSize + s(6), mmSize + s(6));
        ctx.strokeStyle = '#4a4a55';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX - s(3), mmY - s(3), mmSize + s(6), mmSize + s(6));

        // Draw pre-rendered map (scale from MINIMAP_BASE_SIZE to mmSize)
        ctx.drawImage(this.minimapCanvas, 0, 0, MINIMAP_BASE_SIZE, MINIMAP_BASE_SIZE, mmX, mmY, mmSize, mmSize);

        const tileSize = mmSize / MAP_WIDTH;
        const blipSize = Math.max(s(2), 2);

        // Draw NPCs if they are Gamblers
        if (npcs) {
            for (const npc of npcs) {
                // "somente os NPCS que jogam"
                if (npc.type !== 'gambler') continue;

                const nx = mmX + npc.x * tileSize;
                const ny = mmY + npc.y * tileSize;

                // Color code by minigame
                if (npc.minigameType === 'dice') {
                    ctx.fillStyle = '#3333ff'; // Blue
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else if (npc.minigameType === 'ronda') {
                    ctx.fillStyle = '#33ff33'; // Green
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else if (npc.minigameType === 'purrinha') {
                    ctx.fillStyle = '#ffff33'; // Yellow
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else if (npc.minigameType === 'heads_tails') {
                    ctx.fillStyle = '#ff9933'; // Orange
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else if (npc.minigameType === 'palitinho') {
                    ctx.fillStyle = '#ff66cc'; // Pink
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else if (npc.minigameType === 'fan_tan') {
                    ctx.fillStyle = '#dc143c'; // Crimson
                    ctx.fillRect(nx - blipSize / 2, ny - blipSize / 2, blipSize, blipSize);
                } else {
                    // Fallback for generic gamblers
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(nx, ny, Math.max(s(1), 1), Math.max(s(1), 1));
                }
            }
        }

        // Player blip — use actual MAP_WIDTH
        const blipX = mmX + playerX * tileSize;
        const blipY = mmY + playerY * tileSize;

        // Pulsing effect
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 1.5;

        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(blipX, blipY, s(2) * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(blipX, blipY, Math.max(s(1), 1), 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(8)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('SANTA CRUZ', mmX + mmSize / 2, mmY - s(6));
    }
}
