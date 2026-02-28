/**
 * TileMap — handles collision detection and tile queries.
 */

import { MAP_DATA, MAP_WIDTH, MAP_HEIGHT, TILE_TYPES } from './MapData';
import type { TileType } from './MapData';

export class TileMap {
    private data: number[][];

    constructor() {
        this.data = MAP_DATA;
    }

    public getTile(x: number, y: number): TileType {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (ix < 0 || ix >= MAP_WIDTH || iy < 0 || iy >= MAP_HEIGHT) {
            return TILE_TYPES.VOID;
        }
        return this.data[iy][ix] as TileType;
    }

    public isWalkable(x: number, y: number): boolean {
        const tile = this.getTile(x, y);
        return (
            tile === TILE_TYPES.STREET ||
            tile === TILE_TYPES.SIDEWALK ||
            tile === TILE_TYPES.ALLEY ||
            tile === TILE_TYPES.PLAZA ||
            tile === TILE_TYPES.GRASS ||
            tile === TILE_TYPES.STAIRS_UP ||
            tile === TILE_TYPES.STAIRS_DOWN ||
            tile === TILE_TYPES.ENTRANCE ||
            tile === TILE_TYPES.DECORATIVE_ENTRANCE
        );
    }

    public isAreaWalkable(cx: number, cy: number, halfW: number = 0.3, halfH: number = 0.3): boolean {
        return (
            this.isWalkable(cx - halfW, cy - halfH) &&
            this.isWalkable(cx + halfW, cy - halfH) &&
            this.isWalkable(cx - halfW, cy + halfH) &&
            this.isWalkable(cx + halfW, cy + halfH)
        );
    }

    /**
     * Stricter walkability for NPCs.
     * Prevents them from entering special buildings (Entrances) or unsafe areas voluntarily.
     */
    public isNPCWalkable(cx: number, cy: number, halfW: number = 0.3, halfH: number = 0.3): boolean {
        // First check basic walkability
        if (!this.isAreaWalkable(cx, cy, halfW, halfH)) return false;

        // Check center tile specifically for restricted types
        const tile = this.getTile(cx, cy);

        // NPCs shouldn't wander into Entrances (unless script commands it, which we don't have yet)
        if (tile === TILE_TYPES.ENTRANCE) return false;

        return true;
    }

    public isBuilding(x: number, y: number): boolean {
        const tile = this.getTile(x, y);
        return (
            tile === TILE_TYPES.BUILDING_LOW ||
            tile === TILE_TYPES.BUILDING_TALL ||
            tile === TILE_TYPES.SHOPPING ||
            tile === TILE_TYPES.INFORMATION_BOOTH
        );
    }

    public getWidth(): number {
        return MAP_WIDTH;
    }

    public getHeight(): number {
        return MAP_HEIGHT;
    }

    public getData(): number[][] {
        return this.data;
    }
}
