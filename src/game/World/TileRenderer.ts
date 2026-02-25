/**
 * TileRenderer — renders the isometric map with pixel art tile visuals.
 * Split into ground pass and structures pass for proper depth sorting.
 * Supports all tile types including walls, trees, fences, stairs, entrances.
 */

import { Camera, TILE_WIDTH, TILE_HEIGHT } from '../Core/Camera';
import { Renderer } from '../Core/Renderer';
import { TileMap } from './TileMap';
import { TILE_TYPES, STREET_SIGNS, AREA_LABELS, BUS_STOPS, CROSSWALKS, LAMPPOST_POSITIONS } from './MapData';

// Simple seeded random for consistent visuals per tile
function seededRandom(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

export class TileRenderer {
    /**
     * PASS 1: Render only ground tiles (flat surfaces).
     * Call this first, before any entities.
     */
    public renderGround(renderer: Renderer, camera: Camera, tileMap: TileMap) {
        const mapW = tileMap.getWidth();
        const mapH = tileMap.getHeight();
        const data = tileMap.getData();
        const ctx = renderer.getContext();

        // View Culling for Ground using properly projected corners
        const p1 = camera.screenToWorld(0, 0);
        const p2 = camera.screenToWorld(renderer.width, 0);
        const p3 = camera.screenToWorld(renderer.width, renderer.height);
        const p4 = camera.screenToWorld(0, renderer.height);

        const pad = 5; // Buffer tiles
        let minX = Math.floor(Math.min(p1.wx, p2.wx, p3.wx, p4.wx)) - pad;
        let maxX = Math.ceil(Math.max(p1.wx, p2.wx, p3.wx, p4.wx)) + pad;
        let minY = Math.floor(Math.min(p1.wy, p2.wy, p3.wy, p4.wy)) - pad;
        let maxY = Math.ceil(Math.max(p1.wy, p2.wy, p3.wy, p4.wy)) + pad;

        // Fail-safe
        if (isNaN(minX) || isNaN(maxX) || maxX < minX) {
            minX = 0; maxX = mapW; minY = 0; maxY = mapH;
        } else {
            minX = Math.max(0, minX);
            maxX = Math.min(mapW, maxX);
            minY = Math.max(0, minY);
            maxY = Math.min(mapH, maxY);
        }

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = data[y][x];

                // Skip void
                if (tile === TILE_TYPES.VOID) continue;

                // 1. Buildings/Walls — Simple sidewalk base (no heavy border strips)
                if (tile === TILE_TYPES.BUILDING_LOW || tile === TILE_TYPES.BUILDING_TALL ||
                    tile === TILE_TYPES.SHOPPING || tile === TILE_TYPES.WALL) {
                    // Use same color for stroke as base to remove the 'grid' look
                    renderer.drawIsoTile(camera, x, y, '#888890', '#888890');
                    continue;
                }

                // 2. Trees (Grass base)
                if (tile === TILE_TYPES.TREE) {
                    const grassPalette = TILE_COLORS[TILE_TYPES.GRASS];
                    renderer.drawIsoTile(camera, x, y, grassPalette.base[0], grassPalette.stroke);
                    continue;
                }

                // 3. Streets & Alleys — Asphalt + Sidewalks + Lightweight Edge Contours
                if (tile === TILE_TYPES.STREET || tile === TILE_TYPES.ALLEY) {
                    const z = camera.zoom;
                    const isAlley = tile === TILE_TYPES.ALLEY;

                    // Inline road neighbor check (avoids function call overhead per tile)
                    const getRoadType = (tx: number, ty: number): number => {
                        if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return -1;
                        return data[ty][tx];
                    };
                    const isRoadType = (t: number) => t === TILE_TYPES.STREET || t === TILE_TYPES.ALLEY;
                    const isSolidType = (t: number) => t === TILE_TYPES.BUILDING_LOW || t === TILE_TYPES.BUILDING_TALL ||
                        t === TILE_TYPES.SHOPPING || t === TILE_TYPES.WALL ||
                        t === TILE_TYPES.CHURCH || t === TILE_TYPES.GRASS;

                    const tN = getRoadType(x, y - 1);
                    const tS = getRoadType(x, y + 1);
                    const tE = getRoadType(x + 1, y);
                    const tW = getRoadType(x - 1, y);

                    const nRoad = isRoadType(tN), sRoad = isRoadType(tS);
                    const eRoad = isRoadType(tE), wRoad = isRoadType(tW);
                    const connections = (nRoad ? 1 : 0) + (sRoad ? 1 : 0) + (eRoad ? 1 : 0) + (wRoad ? 1 : 0);
                    const isIntersection = connections > 2;

                    // Screen-space isometric diamond corners
                    const { sx, sy } = camera.worldToScreen(x, y);
                    const hw = (TILE_WIDTH / 2) * z;
                    const hh = (TILE_HEIGHT / 2) * z;

                    // STEP 1 — Full-width asphalt (edge-to-edge, creates continuous roads)
                    ctx.fillStyle = isAlley ? '#2e2e38' : '#48485a';
                    ctx.beginPath();
                    ctx.moveTo(sx, sy - hh);
                    ctx.lineTo(sx + hw, sy);
                    ctx.lineTo(sx, sy + hh);
                    ctx.lineTo(sx - hw, sy);
                    ctx.closePath();
                    ctx.fill();

                    // STEP 2 — Per-edge sidewalk strips (ONLY on building-facing edges)
                    // Edge→neighbor mapping (verified for this isometric projection):
                    //   ptTop→ptRight  ↔  N neighbor (x, y-1)
                    //   ptRight→ptBot  ↔  E neighbor (x+1, y)
                    //   ptBot→ptLeft   ↔  S neighbor (x, y+1)
                    //   ptLeft→ptTop   ↔  W neighbor (x-1, y)
                    const sw = isAlley ? '#5e5e64' : '#7a7a82';
                    const si = isAlley ? 0.34 : 0.24;        // sidewalk inset fraction
                    const isRes = (t: number) => t === TILE_TYPES.BUILDING_LOW || t === TILE_TYPES.BUILDING_TALL;

                    // North edge: faces neighbor tN (x, y-1)
                    let drawN = !nRoad && isSolidType(tN);
                    if (!drawN && !nRoad) {
                        const hasResN = (eRoad && isRes(getRoadType(x + 1, y - 1))) || (wRoad && isRes(getRoadType(x - 1, y - 1)));
                        if (hasResN && seededRandom(x, y * 7) < 0.6) drawN = true;
                    }
                    if (drawN) {
                        ctx.fillStyle = sw;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy - hh);           // ptTop
                        ctx.lineTo(sx + hw, sy);                // ptRight
                        ctx.lineTo(sx + hw * (1 - si), sy);                // inset ptRight
                        ctx.lineTo(sx, sy - hh * (1 - si));    // inset ptTop
                        ctx.closePath(); ctx.fill();
                    }

                    // East edge: faces neighbor tE (x+1, y)
                    let drawE = !eRoad && isSolidType(tE);
                    if (!drawE && !eRoad) {
                        const hasResE = (nRoad && isRes(getRoadType(x + 1, y - 1))) || (sRoad && isRes(getRoadType(x + 1, y + 1)));
                        if (hasResE && seededRandom(100 + x, y * 3) < 0.6) drawE = true;
                    }
                    if (drawE) {
                        ctx.fillStyle = sw;
                        ctx.beginPath();
                        ctx.moveTo(sx + hw, sy);                // ptRight
                        ctx.lineTo(sx, sy + hh);           // ptBot
                        ctx.lineTo(sx, sy + hh * (1 - si));    // inset ptBot
                        ctx.lineTo(sx + hw * (1 - si), sy);                // inset ptRight
                        ctx.closePath(); ctx.fill();
                    }

                    // South edge: faces neighbor tS (x, y+1)
                    let drawS = !sRoad && isSolidType(tS);
                    if (!drawS && !sRoad) {
                        const hasResS = (eRoad && isRes(getRoadType(x + 1, y + 1))) || (wRoad && isRes(getRoadType(x - 1, y + 1)));
                        if (hasResS && seededRandom(200 + x, y * 5) < 0.6) drawS = true;
                    }
                    if (drawS) {
                        ctx.fillStyle = sw;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy + hh);           // ptBot
                        ctx.lineTo(sx - hw, sy);                // ptLeft
                        ctx.lineTo(sx - hw * (1 - si), sy);                // inset ptLeft
                        ctx.lineTo(sx, sy + hh * (1 - si));    // inset ptBot
                        ctx.closePath(); ctx.fill();
                    }

                    // West edge: faces neighbor tW (x-1, y)
                    let drawW = !wRoad && isSolidType(tW);
                    if (!drawW && !wRoad) {
                        const hasResW = (nRoad && isRes(getRoadType(x - 1, y - 1))) || (sRoad && isRes(getRoadType(x - 1, y + 1)));
                        if (hasResW && seededRandom(300 + x, y * 11) < 0.6) drawW = true;
                    }
                    if (drawW) {
                        ctx.fillStyle = sw;
                        ctx.beginPath();
                        ctx.moveTo(sx - hw, sy);                // ptLeft
                        ctx.lineTo(sx, sy - hh);           // ptTop
                        ctx.lineTo(sx, sy - hh * (1 - si));    // inset ptTop
                        ctx.lineTo(sx + -hw * (1 - si), sy);                // inset ptLeft
                        ctx.closePath(); ctx.fill();
                    }

                    // (asphalt is now full-width in STEP 1, per-edge sidewalk in STEP 2)

                    // STEP 2b — Asphalt micro-texture (2 random specks, fully static/seeded)
                    if (z > 0.8) {
                        const r1 = seededRandom(x * 11, y * 7);
                        const r2 = seededRandom(x * 7, y * 13);
                        const r3 = seededRandom(x * 3, y * 17);
                        // Speck 1
                        ctx.fillStyle = isAlley ? 'rgba(30,30,38,0.5)' : 'rgba(45,45,58,0.45)';
                        ctx.fillRect(
                            (sx - hw * 0.4 + r1 * hw * 0.8) | 0,
                            (sy - hh * 0.35 + r2 * hh * 0.7) | 0,
                            Math.max(1, z * 0.8 | 0), Math.max(1, z * 0.8 | 0)
                        );
                        // Speck 2 (only when zoomed in enough)
                        if (r3 > 0.4) {
                            ctx.fillRect(
                                (sx - hw * 0.3 + r3 * hw * 0.6) | 0,
                                (sy - hh * 0.25 + r1 * hh * 0.5) | 0,
                                Math.max(1, z * 0.6 | 0), Math.max(1, z * 0.6 | 0)
                            );
                        }
                    }

                    // STEP 3 — Curb: single stroke per building-facing edge (cheap)
                    // Isometric mapping: N tile(x,y-1) → upper-left edge (ptLeft→ptTop)
                    //                   E tile(x+1,y) → upper-right edge (ptTop→ptRight)
                    //                   S tile(x,y+1) → lower-right edge (ptRight→ptBot)
                    //                   W tile(x-1,y) → lower-left edge (ptBot→ptLeft)
                    // STEP 3 — Curb stroke on the boundary between asphalt and sidewalk (inner inset)
                    {
                        const curbColor = isAlley ? 'rgba(110,108,102,0.9)' : 'rgba(150,150,158,0.9)';
                        ctx.strokeStyle = curbColor;
                        ctx.lineWidth = Math.max(0.8, z * 1.1);

                        // Inner curb lines (separating sidewalk strip from asphalt center)
                        if (drawN) {
                            ctx.beginPath();
                            ctx.moveTo(sx, sy - hh * (1 - si));
                            ctx.lineTo(sx + hw * (1 - si), sy);
                            ctx.stroke();
                        }
                        if (drawE) {
                            ctx.beginPath();
                            ctx.moveTo(sx + hw * (1 - si), sy);
                            ctx.lineTo(sx, sy + hh * (1 - si));
                            ctx.stroke();
                        }
                        if (drawS) {
                            ctx.beginPath();
                            ctx.moveTo(sx, sy + hh * (1 - si));
                            ctx.lineTo(sx - hw * (1 - si), sy);
                            ctx.stroke();
                        }
                        if (drawW) {
                            ctx.beginPath();
                            ctx.moveTo(sx - hw * (1 - si), sy);
                            ctx.lineTo(sx, sy - hh * (1 - si));
                            ctx.stroke();
                        }
                    }

                    // STEP 4 — Road markings
                    if (!isIntersection && !isAlley) {
                        const seed = seededRandom(x, y);
                        // Center-line dashes (yellow, shows road direction)
                        if (seed > 0.55) {
                            ctx.fillStyle = 'rgba(210, 195, 100, 0.32)';
                            if (nRoad && sRoad) {
                                // Vertical road → horizontal dash
                                ctx.fillRect((sx - 1.5 * z) | 0, (sy - 0.4 * z) | 0, (3 * z) | 0, (0.8 * z) | 0);
                            } else if (eRoad && wRoad) {
                                // Horizontal road → vertical dash
                                ctx.fillRect((sx - 0.4 * z) | 0, (sy - 1.5 * z) | 0, (0.8 * z) | 0, (3 * z) | 0);
                            } else {
                                // Mixed → small dot
                                ctx.fillRect((sx - 0.6 * z) | 0, (sy - 0.6 * z) | 0, (1.2 * z) | 0, (1.2 * z) | 0);
                            }
                        }
                    }

                    continue;
                }

                // 5. Generic Tiles & Overlays
                const palette = TILE_COLORS[tile];
                if (palette) {
                    const variation = Math.floor(seededRandom(x, y) * palette.base.length);
                    const color = palette.base[variation];
                    renderer.drawIsoTile(camera, x, y, color, palette.stroke);
                }

                // Plaza decorative pattern
                if (tile === TILE_TYPES.PLAZA && seededRandom(x * 3, y * 7) > 0.85) {
                    renderer.drawIsoTile(camera, x, y, '#555565');
                }

                // Stairs pattern
                if (tile === TILE_TYPES.STAIRS_UP || tile === TILE_TYPES.STAIRS_DOWN) {
                    this.drawStairs(ctx, camera, x, y, tile === TILE_TYPES.STAIRS_DOWN);
                }

                // Entrance glow
                if (tile === TILE_TYPES.ENTRANCE) {
                    this.drawEntrance(ctx, camera, x, y);
                }

                // Fence (drawn on ground pass since it's low)
                if (tile === TILE_TYPES.FENCE) {
                    this.drawFence(ctx, camera, x, y);
                }
            }

            // Render Crosswalks (on top of street tiles)
            for (const cw of CROSSWALKS) {
                this.drawCrosswalk(ctx, camera, cw.x, cw.y, cw.direction === 'h');
            }
        }
    }

    /**
     * PASS 2: Collect all structures (buildings, walls, trees) as drawables
     * with their Y position, so they can be depth-sorted with entities.
     */
    public getStructureDrawables(renderer: Renderer, camera: Camera, tileMap: TileMap): StructureDrawable[] {
        const mapW = tileMap.getWidth();
        const mapH = tileMap.getHeight();
        const data = tileMap.getData();
        const ctx = renderer.getContext();
        const drawables: StructureDrawable[] = [];

        // View Culling using properly projected corners
        const p1 = camera.screenToWorld(0, 0);
        const p2 = camera.screenToWorld(renderer.width, 0);
        const p3 = camera.screenToWorld(renderer.width, renderer.height);
        const p4 = camera.screenToWorld(0, renderer.height);

        // Extra padding for tall structures (they project upwards)
        const pad = 15;
        let minX = Math.floor(Math.min(p1.wx, p2.wx, p3.wx, p4.wx)) - pad;
        let maxX = Math.ceil(Math.max(p1.wx, p2.wx, p3.wx, p4.wx)) + pad;
        let minY = Math.floor(Math.min(p1.wy, p2.wy, p3.wy, p4.wy)) - pad;
        let maxY = Math.ceil(Math.max(p1.wy, p2.wy, p3.wy, p4.wy)) + pad;

        // Fail-safe: If calculation goes wild (NaN or inverted), fallback to full map or safe center
        if (isNaN(minX) || isNaN(maxX) || maxX < minX) {
            console.warn("Culling calc failed, rendering full map");
            minX = 0; maxX = mapW; minY = 0; maxY = mapH;
        } else {
            // Clamp to map bounds
            minX = Math.max(0, minX);
            maxX = Math.min(mapW, maxX);
            minY = Math.max(0, minY);
            maxY = Math.min(mapH, maxY);
        }

        for (let y = minY; y < maxY; y++) {
            for (let x = minX; x < maxX; x++) {
                const tile = data[y][x];
                // Cull voids
                if (tile === TILE_TYPES.VOID) continue;

                const rand = seededRandom(x, y);
                const tileX = x;
                const tileY = y;

                if (tile === TILE_TYPES.BUILDING_LOW || tile === TILE_TYPES.BUILDING_TALL || tile === TILE_TYPES.SHOPPING) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            // Check connections
                            const isSame = (tx: number, ty: number) => {
                                if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return false;
                                return data[ty][tx] === tile; // Connect to same type
                            };

                            const n = isSame(tileX, tileY - 1);
                            const s = isSame(tileX, tileY + 1);
                            const e = isSame(tileX + 1, tileY);
                            const w = isSame(tileX - 1, tileY);

                            // Default wide contour (0.2 inset)
                            let minX = 0.2, maxX = 0.8, minY = 0.2, maxY = 0.8;

                            // If connected, extend to edge (0 or 1)
                            if (w) minX = 0;
                            if (e) maxX = 1;
                            if (n) minY = 0;
                            if (s) maxY = 1;

                            // Noble Area Logic (Near Shopping)
                            // If Shopping or Tall Building near shopping coordinates
                            // Customize colors or details to look less "standardized"

                            let h = 4 + rand * 14;
                            let top, left, right;

                            if (tile === TILE_TYPES.BUILDING_LOW) {
                                h = 4 + rand * 14;
                                const ci = Math.floor(rand * BUILDING_COLORS.low.length);
                                const c = BUILDING_COLORS.low[ci];
                                top = c.top; left = c.left; right = c.right;
                            } else if (tile === TILE_TYPES.BUILDING_TALL) {
                                h = 15 + rand * 15;
                                const ci = Math.floor(rand * BUILDING_COLORS.tall.length);
                                const c = BUILDING_COLORS.tall[ci];
                                top = c.top; left = c.left; right = c.right;
                            } else { // Shopping
                                h = 10;
                                const c = BUILDING_COLORS.shopping;
                                top = c.top; left = c.left; right = c.right;
                            }

                            renderer.drawCustomIsoBlock(camera, tileX, tileY, h, top, left, right, minX, maxX, minY, maxY);

                            // Only draw details if enough space or centered
                            const width = (maxX - minX);
                            const depth = (maxY - minY);

                            if (width > 0.3 && depth > 0.3) {
                                this.drawWindows(renderer, camera, tileX, tileY, h, rand, tile);
                                if (tile === TILE_TYPES.BUILDING_LOW) {
                                    this.drawRoofDetail(ctx, camera, tileX, tileY, h, rand);
                                    if (seededRandom(tileX * 11, tileY * 13) > 0.7 && !s) {
                                        this.drawDoor(ctx, camera, tileX, tileY);
                                    }
                                    this.drawMortarLines(ctx, camera, tileX, tileY, h, rand);
                                } else if (tile === TILE_TYPES.BUILDING_TALL) {
                                    this.drawFloorDivision(ctx, camera, tileX, tileY, h);
                                    if (seededRandom(tileX * 7, tileY * 11) > 0.5 && width < 0.9) {
                                        this.drawExternalStaircase(ctx, camera, tileX, tileY, h);
                                    }
                                }
                            }
                        },
                    });
                } else if (tile === TILE_TYPES.CHURCH) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            // Church Visuals
                            // Tall (40)
                            const h = 40;
                            const top = '#e0e0e0'; // White/Cream
                            const left = '#c0c0c0';
                            const right = '#d0d0d0';

                            // Draw Main Body
                            renderer.drawIsoBlock(camera, tileX, tileY, h, top, left, right);

                            // Entrance is facing North (Y=80), so it's on the "back" side relative to camera.
                            // We don't draw a door on the South face.

                            // Draw Windows (Simple Stained Glass emulation - colorful pixels)
                            // Reuse drawWindows but maybe different color?
                            // For now just standard windows is okay, or maybe custom

                            // Draw Cross on Top (Only on center tile to avoid repetition)
                            // Church is at 125..135, 86..98. Center roughly 130, 92.
                            if (tileX === 130 && tileY === 92) {
                                const { sx, sy } = camera.worldToScreen(tileX, tileY);
                                const topY = sy - h * camera.zoom - (TILE_HEIGHT * camera.zoom); // Center of roof roughly

                                ctx.fillStyle = '#D4AF37'; // Gold
                                const z = camera.zoom;
                                // Make it larger/taller since it's just one
                                ctx.fillRect(sx - 2 * z, topY - 14 * z, 4 * z, 16 * z); // Vertical part
                                ctx.fillRect(sx - 6 * z, topY - 8 * z, 12 * z, 4 * z);  // Horizontal part
                            }
                        },
                    });
                } else if (tile === TILE_TYPES.SHOPPING) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            const c = BUILDING_COLORS.shopping;
                            // 3 Layers representing "crescent layers from bottom up"
                            // Layer 1 (Base)
                            renderer.drawIsoBlock(camera, tileX, tileY, 12, c.top, c.left, c.right, 1.0);

                            // Layer 2 (Mid)
                            // We need to draw ON TOP of the previous block. 
                            // drawIsoBlock draws from ground z=0. 
                            // We need a way to stack.
                            // Actually drawIsoBlock logic takes blockHeight.
                            // To stack, we'd need to shift the sy (screen Y) upwards by the height of the previous block.

                            // Custom stacking:
                            const z = camera.zoom;

                            // Draw L1
                            // renderer.drawIsoBlock(camera, tileX, tileY, h1, c.top, c.left, c.right, 1.0);
                            // To draw L2 sitting on L1, we simulate it by drawing a floating block?
                            // Renderer doesn't support "elevation".
                            // BUT, we can just manipulate the screen Y coordinate passed to a custom draw?
                            // OR, since it's 2D iso, drawing a block at `y - h1` works visually.

                            // Hack: Draw L2 as a VERY tall block that starts at ground but has the bottom cut off? No.

                            // Correct way: Add 'baseHeight' or 'elevation' to drawIsoBlock.
                            // Since I can't easily change Renderer signature again right now without touching other calls,
                            // I will implement the stacking manually here by calculating screen coords.

                            // Helper to draw stacked block
                            const drawStacked = (elevation: number, height: number, scale: number) => {
                                const { sx, sy } = camera.worldToScreen(tileX, tileY);
                                // Shift sy UP by elevation * z
                                const elevatedSy = sy - elevation * z;

                                const hw = (TILE_WIDTH / 2) * z * scale;
                                const hh = (TILE_HEIGHT / 2) * z * scale;
                                const h = height * z;

                                // Vertices relative to elevated center
                                // Top: (0, -hh - h)
                                // Top-Right: (hw, -h)
                                // Bottom: (0, 0) -- This is the bottom front corner
                                // Top-Left: (-hw, -h)
                                // Wait, standard drawIsoBlock (Renderer.ts:109)
                                // MoveTo sx-hw, sy (Left Point)
                                // LineTo sx, sy+hh (Bottom Point)
                                // LineTo sx, sy+hh-h (Bottom-Top Point?)

                                // Let's just copy the drawing logic locally for this unique building
                                // Left Face
                                ctx.beginPath();
                                ctx.moveTo(sx - hw, elevatedSy);
                                ctx.lineTo(sx, elevatedSy + hh);
                                ctx.lineTo(sx, elevatedSy + hh - h);
                                ctx.lineTo(sx - hw, elevatedSy - h);
                                ctx.closePath();
                                ctx.fillStyle = c.left;
                                ctx.fill();

                                // Right Face
                                ctx.beginPath();
                                ctx.moveTo(sx + hw, elevatedSy);
                                ctx.lineTo(sx, elevatedSy + hh);
                                ctx.lineTo(sx, elevatedSy + hh - h);
                                ctx.lineTo(sx + hw, elevatedSy - h);
                                ctx.closePath();
                                ctx.fillStyle = c.right;
                                ctx.fill();

                                // Top Face
                                ctx.beginPath();
                                ctx.moveTo(sx, elevatedSy - hh - h);
                                ctx.lineTo(sx + hw, elevatedSy - h);
                                ctx.lineTo(sx, elevatedSy + hh - h);
                                ctx.lineTo(sx - hw, elevatedSy - h);
                                ctx.closePath();
                                ctx.fillStyle = c.top;
                                ctx.fill();
                            };

                            // 2-Tier Shopping Mall Design
                            const h1 = 22; // Base height
                            const h2 = 14; // Top height

                            // Base Layer
                            drawStacked(0, h1, 1.0);

                            // Top Layer (Set back)
                            drawStacked(h1, h2, 0.75);

                            // Windows on Base
                            this.drawWindows(renderer, camera, tileX, tileY, h1, rand, TILE_TYPES.SHOPPING, 0, 1.0);

                            // Windows on Top
                            this.drawWindows(renderer, camera, tileX, tileY, h2, rand, TILE_TYPES.SHOPPING, h1, 0.75);
                        },
                    });
                } else if (tile === TILE_TYPES.BENCH) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            // Simple Bench (Wooden)
                            const h = 3;
                            // Draw legs + seat? Or just a block for pixel art style
                            // Let's draw a small block
                            // 0.6 width, 0.3 depth, centered
                            // top, left, right colors
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, h, '#8b5a2b', '#6b4226', '#7b4b29', 0.2, 0.8, 0.35, 0.65);
                        },
                    });
                } else if (tile === TILE_TYPES.FOUNTAIN) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            // Tiered Fountain
                            // Base (Stone)
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 4, '#888', '#666', '#777', 0.1, 0.9, 0.1, 0.9);
                            // Mid Tier (Stone)
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 8, '#999', '#777', '#888', 0.3, 0.7, 0.3, 0.7);
                            // Top Water
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 10, '#44aaff', '#3388cc', '#3399dd', 0.4, 0.6, 0.4, 0.6);
                        },
                    });
                } else if (tile === TILE_TYPES.DOMINO_TABLE) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            const h = 6;
                            // Wooden Domino Table
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, h, '#5c4033', '#4a332a', '#3d2b23', 0.3, 0.7, 0.3, 0.7);

                            // Dots on Top
                            const { sx, sy } = camera.worldToScreen(tileX, tileY);
                            const z = camera.zoom;
                            const topY = sy - h * z;
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(sx - 2 * z, topY - 1 * z, 1.5 * z, 1.5 * z);
                            ctx.fillRect(sx + 1 * z, topY + 2 * z, 1.5 * z, 1.5 * z);
                            ctx.fillRect(sx - 4 * z, topY + 0.5 * z, 1.5 * z, 1.5 * z);
                        },
                    });
                } else if (tile === TILE_TYPES.MONUMENT) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            // Historical Marco Imperial Onze (Milestone)
                            const cTop = '#f8f8f8';
                            const cLeft = '#e0e0e0';
                            const cRight = '#d0d0d0';

                            // base
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 3, cTop, cLeft, cRight, 0.1, 0.9, 0.1, 0.9);
                            // body
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 15, cTop, cLeft, cRight, 0.35, 0.65, 0.35, 0.65);
                            // cap (narrower)
                            renderer.drawCustomIsoBlock(camera, tileX, tileY, 18, cTop, cLeft, cRight, 0.4, 0.6, 0.4, 0.6);
                        }
                    });
                } else if (tile === TILE_TYPES.WALL) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            const h = 4; // Consistent wall height
                            const ci = Math.floor(rand * BUILDING_COLORS.wall.length);
                            const c = BUILDING_COLORS.wall[ci];
                            // Scale 0.6 to match house "sidewalk contour" (0.2 inset)
                            renderer.drawIsoBlock(camera, tileX, tileY, h, c.top, c.left, c.right, 0.6);

                            this.drawMortarLines(ctx, camera, tileX, tileY, h, rand);
                        },
                    });
                } else if (tile === TILE_TYPES.TREE) {
                    drawables.push({
                        y: tileY + 0.5,
                        draw: () => {
                            this.drawTree(ctx, camera, tileX, tileY, rand);
                        },
                    });
                }
            }
        }

        // Add Street Lamps as drawables
        for (const lamp of LAMPPOST_POSITIONS) {
            drawables.push({
                y: lamp.y + 0.5,
                draw: () => {
                    this.drawStreetLamp(ctx, camera, lamp.x, lamp.y);
                }
            });
        }

        // Add Bus Stops as drawables
        for (const stop of BUS_STOPS) {
            drawables.push({
                y: stop.y + 0.8, // slightly in front of tile center
                draw: () => {
                    this.drawBusStop(ctx, camera, stop.x, stop.y, stop.direction === 'h');
                },
            });
        }

        return drawables;
    }

    /**
     * PASS 3: Render signs and labels (always on top).
     */
    public renderOverlays(ctx: CanvasRenderingContext2D, camera: Camera) {
        this.renderStreetSigns(ctx, camera);
        this.renderAreaLabels(ctx, camera);
    }

    /**
     * Legacy method — full render in one call (for backwards compat).
     */
    public render(renderer: Renderer, camera: Camera, tileMap: TileMap) {
        this.renderGround(renderer, camera, tileMap);
        const drawables = this.getStructureDrawables(renderer, camera, tileMap);
        drawables.sort((a, b) => a.y - b.y);
        for (const d of drawables) d.draw();
        this.renderOverlays(renderer.getContext(), camera);
    }

    // ==================== DETAIL DRAWING METHODS ====================

    /** Draw zebra crosswalk on street */
    private drawCrosswalk(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, horizontal: boolean) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const stripes = 4;

        ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
        ctx.save();

        if (horizontal) {
            for (let i = 0; i < stripes; i++) {
                const offset = (i - stripes / 2) * 3 * z;
                ctx.fillRect(sx - 5 * z, sy + offset, 10 * z, 1.5 * z);
            }
        } else {
            for (let i = 0; i < stripes; i++) {
                const offset = (i - stripes / 2) * 4 * z;
                ctx.fillRect(sx + offset, sy - 2 * z, 2 * z, 6 * z);
            }
        }
        ctx.restore();
    }

    /** Draw a bus stop shelter */
    private drawBusStop(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, _horizontal: boolean) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const roofY = sy - 14 * z;

        ctx.fillStyle = '#3a3a4a'; // dark metal
        ctx.fillRect(sx - 6 * z, roofY, 12 * z, 2 * z); // top

        ctx.fillStyle = '#555';
        ctx.fillRect(sx - 5 * z, roofY + 2 * z, 1 * z, 12 * z); // left post
        ctx.fillRect(sx + 5 * z, roofY + 2 * z, 1 * z, 12 * z); // right post

        ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
        ctx.fillRect(sx - 5 * z, roofY + 4 * z, 10 * z, 8 * z); // glass

        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(sx - 4 * z, sy - 4 * z, 8 * z, 2 * z); // bench

        // Bus sign
        ctx.fillStyle = '#1a5aca';
        ctx.fillRect(sx + 6 * z, sy - 16 * z, 4 * z, 4 * z);
        ctx.fillStyle = '#fff';
        ctx.font = `${3 * z}px monospace`;
        ctx.fillText('BUS', sx + 8 * z, sy - 13 * z);

        ctx.fillStyle = '#555';
        ctx.fillRect(sx + 7.5 * z, sy - 12 * z, 1 * z, 12 * z); // sign post
    }

    /** Draw mortar/brick lines on walls */
    private drawMortarLines(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, blockHeight: number, seed: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.5;

        const lines = Math.floor(blockHeight / 6);
        for (let i = 1; i < lines; i++) {
            const ly = sy - (i * 6) * z;
            if (ly < sy - blockHeight * z) break;
            ctx.beginPath();
            ctx.moveTo(sx - 8 * z, ly + seed * 0.5 * z);
            ctx.lineTo(sx, ly);
            ctx.stroke();
        }

        for (let i = 1; i < lines; i++) {
            const ly = sy - (i * 6) * z;
            if (ly < sy - blockHeight * z) break;
            const offset = (i % 2 === 0) ? -4 : -2;
            ctx.beginPath();
            ctx.moveTo(sx + offset * z, ly);
            ctx.lineTo(sx + offset * z, ly - 5 * z);
            ctx.stroke();
        }
    }

    /** Draw roof detail (corrugated tin or flat concrete) */
    private drawRoofDetail(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, blockHeight: number, seed: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const topY = sy - blockHeight * z;

        if (seed > 0.5) {
            ctx.strokeStyle = 'rgba(100,80,50,0.3)';
            ctx.lineWidth = 0.5;
            for (let i = -3; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(sx + i * 2 * z, topY - 1 * z);
                ctx.lineTo(sx + i * 2 * z, topY + 2 * z);
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = 'rgba(60,50,40,0.15)';
            ctx.fillRect(sx - 4 * z, topY, 3 * z, 2 * z);
        }
    }

    /** Draw floor division line on tall buildings */
    private drawFloorDivision(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, blockHeight: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const midH = blockHeight * 0.5;

        ctx.fillStyle = 'rgba(80,80,100,0.4)';
        ctx.fillRect(sx - 8 * z, sy - midH * z - 1 * z, 8 * z, 2 * z);
        ctx.fillRect(sx, sy - midH * z - 1 * z, 8 * z, 2 * z);

        ctx.fillStyle = 'rgba(200,200,220,0.3)';
        ctx.font = `${4 * z}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('2', sx + 4 * z, sy - (midH + 3) * z);
    }

    /** Draw external lateral staircase */
    private drawExternalStaircase(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, blockHeight: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const midH = blockHeight * 0.5;
        const stairX = sx + 7 * z;
        const stairBottom = sy;
        const stairTop = sy - midH * z;
        const steps = 6;

        ctx.strokeStyle = '#5a5a6a';
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath(); ctx.moveTo(stairX, stairBottom); ctx.lineTo(stairX, stairTop); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(stairX + 4 * z, stairBottom); ctx.lineTo(stairX + 4 * z, stairTop); ctx.stroke();

        ctx.strokeStyle = '#7a7a8a';
        ctx.lineWidth = 1 * z;
        for (let i = 0; i <= steps; i++) {
            const stepY = stairBottom - (i / steps) * (stairBottom - stairTop);
            ctx.beginPath(); ctx.moveTo(stairX, stepY); ctx.lineTo(stairX + 4 * z, stepY); ctx.stroke();
        }

        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(stairX - 1 * z, stairTop - 1 * z, 6 * z, 2 * z);
    }

    /**
     * PASS 4: Night Time Overlay (Atmosphere)
     */
    public renderNightOverlay(ctx: CanvasRenderingContext2D) {
        // 1. Darken everything (Dusk/Night feel)
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(20, 20, 60, 0.3)'; // Deep Blue tint
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // 2. Additive Lights (Street Lamps & Windows)
        ctx.globalCompositeOperation = 'lighter';

        // For now, let's skip complex point lights to save performance, 
        // effectively the "Darken" layer is enough for "Atmosphere".
        ctx.restore();
    }

    /** Draw windows */
    private drawWindows(renderer: Renderer, camera: Camera, tileX: number, tileY: number, blockHeight: number, seed: number, tileType: number, elevation: number = 0, scale: number = 1) {
        const ctx = renderer.getContext();
        const { sx, sy: baseSy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const sy = baseSy - elevation * z; // Adjust sy based on elevation
        const h = blockHeight * z;
        const time = Date.now();

        const hasFlowerPot = seed > 0.7;
        const rows = Math.floor(h / (10 * z * scale)); // Adjust rows based on scaled window height
        const winW = 3 * z * scale;
        const winH = 5 * z * scale;
        const gap = 2 * z * scale;
        const isShopping = tileType === TILE_TYPES.SHOPPING;

        const drawFace = (faceIndex: number, wxBase: number, yOffBase: number) => {
            for (let r = 0; r < rows; r++) {
                const yOff = yOffBase + r * (winH + gap);
                const wx = wxBase;
                const wy = sy + yOff;

                // Default base
                ctx.fillStyle = '#1a1a25';
                ctx.fillRect(wx, wy, winW, winH);

                if (isShopping) {
                    // Decorative Light Scheme: Stable, Bright.
                    // Rare, sporadic failure (individual bulb)
                    // Use specific unique seed per window
                    const unique = tileX * 100 + tileY * 10 + r + elevation;
                    const tick = Math.floor(time / 200); // Slow ticks (200ms)

                    // Noise for flicker
                    const noise = Math.sin(tick * 13.0 + unique * 41.0);

                    // Very rare failure
                    if (noise > 0.98) {
                        ctx.fillStyle = '#666'; // Dim
                    } else {
                        // Standard bright decorative
                        ctx.fillStyle = '#fff9ef'; // Warm white
                    }

                    ctx.fillRect(wx, wy, winW, winH);
                } else {
                    // Residential: Realistic, more stable window lighting
                    const unique = tileX * 13 + tileY * 7 + r * 3 + faceIndex * 5;
                    // Significantly slower and subtler breathing effect
                    const val = Math.sin(time / 4000 + unique);
                    const alpha = (val + 1) / 2;

                    if (alpha > 0.15) {
                        // Variety in window color (stable choice per window)
                        const isCool = seededRandom(tileX * 7, tileY * 11) > 0.8;
                        const baseColor = isCool ? 'rgba(230, 240, 255' : 'rgba(255, 230, 150';

                        // Lower flicker for real immersion
                        const flickerAlpha = alpha * (0.9 + Math.sin(time / 800 + unique) * 0.05);

                        ctx.fillStyle = `${baseColor}, ${flickerAlpha * 0.95})`;
                        ctx.shadowBlur = 8 * z;
                        ctx.shadowColor = isCool ? 'rgba(150, 200, 255, 0.3)' : 'rgba(255, 200, 50, 0.4)';
                        ctx.fillRect(wx, wy, winW, winH);

                        // Subtle window detail: silhoutte or curtain (stable)
                        if (seededRandom(tileX * 3, unique * 2) > 0.65) {
                            ctx.fillStyle = 'rgba(0,0,0,0.2)';
                            ctx.fillRect(wx + winW * 0.3, wy, winW * 0.4, winH);
                        }

                        ctx.shadowBlur = 0;
                    }
                }

                // Flowers on first row of house
                if (!isShopping && hasFlowerPot && r === 0 && faceIndex === 0) {
                    ctx.fillStyle = '#d66';
                    ctx.fillRect(wx, wy + winH - 2 * z * scale, winW, 2 * z * scale);
                }
            }
        }

        // Left Face
        drawFace(0, sx - 10 * z * scale, -h + 5 * z * scale + 3 * z * scale);
        // Right Face
        drawFace(1, sx + 5 * z * scale, -h + 6 * z * scale + 3 * z * scale);
    }

    /** Draw door */
    private drawDoor(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, height: number = 1, color: string = '#3a2a1a') {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const h = 6 * height * z;
        ctx.fillStyle = color;
        ctx.fillRect(sx - 2 * z, sy - h, 4 * z, h);
        ctx.fillStyle = '#aa8844';
        ctx.fillRect(sx + 0.5 * z, sy - h * 0.5, 1 * z, 1 * z);
    }

    /** Draw stairs pattern */
    private drawStairs(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, goingDown: boolean) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const steps = 4;
        const stepColor = goingDown ? '#4a4a5a' : '#6a6a72';
        const lineColor = goingDown ? '#3a3a4a' : '#5a5a62';

        for (let i = 0; i < steps; i++) {
            const offset = (i - steps / 2) * 3 * z;
            ctx.fillStyle = i % 2 === 0 ? stepColor : lineColor;
            ctx.fillRect(sx - 6 * z, sy + offset, 12 * z, 2.5 * z);
        }

        ctx.fillStyle = '#aaaacc';
        ctx.font = `${8 * z}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(goingDown ? '\u25BC' : '\u25B2', sx, sy - 5 * z);
    }

    /** Draw a pixel art street lamp */
    private drawStreetLamp(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const h = 25 * z;

        // Pole
        ctx.fillStyle = '#222';
        ctx.fillRect(sx - 1 * z, sy - h, 2 * z, h);

        // Arm
        ctx.fillRect(sx - 1 * z, sy - h, 6 * z, 1.5 * z);

        // Lamp head
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 3 * z, sy - h + 1 * z, 4 * z, 2 * z);

        // Emissive Light Source with BLOOM
        const flicker = Math.sin(Date.now() / 150 + tileX * 10) * 0.08 + 0.92;
        const lx = sx + 5 * z;
        const ly = sy - h + 2.75 * z;

        // Layered bloom for richness
        const bloomSize = 12 * z * flicker;
        const bloomGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, bloomSize);
        bloomGrad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
        bloomGrad.addColorStop(0.4, 'rgba(255, 200, 50, 0.3)');
        bloomGrad.addColorStop(1, 'rgba(255, 200, 50, 0)');

        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, bloomSize, 0, Math.PI * 2);
        ctx.fill();

        // The bulb itself
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 3.5 * z, sy - h + 2 * z, 3 * z, 1.5 * z);
    }

    /** Draw entrance with glowing frame */
    private drawEntrance(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const pulse = Math.sin(Date.now() / 500) * 0.15 + 0.85;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#55aaff';
        ctx.lineWidth = 2 * z;
        ctx.strokeRect(sx - 5 * z, sy - 10 * z, 10 * z, 10 * z);
        ctx.fillStyle = 'rgba(80, 160, 255, 0.15)';
        ctx.fillRect(sx - 5 * z, sy - 10 * z, 10 * z, 10 * z);
        ctx.restore();
    }

    /** Draw fence posts */
    private drawFence(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        ctx.strokeStyle = '#6a6a5a';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            const px = sx + i * 4 * z;
            ctx.beginPath();
            ctx.moveTo(px, sy);
            ctx.lineTo(px, sy - 8 * z);
            ctx.stroke();
        }
        ctx.strokeStyle = '#7a7a6a';
        ctx.beginPath();
        ctx.moveTo(sx - 5 * z, sy - 5 * z);
        ctx.lineTo(sx + 5 * z, sy - 5 * z);
        ctx.moveTo(sx - 5 * z, sy - 3 * z);
        ctx.lineTo(sx + 5 * z, sy - 3 * z);
        ctx.stroke();
    }

    /** Draw a pixel art tree */
    private drawTree(ctx: CanvasRenderingContext2D, camera: Camera, tileX: number, tileY: number, seed: number) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const size = (6 + seed * 4) * z;

        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(sx - 1.5 * z, sy - size * 0.4, 3 * z, size * 0.4);

        const greenShade = seed > 0.5 ? '#2a6a22' : '#1a5a18';
        ctx.fillStyle = greenShade;
        ctx.beginPath();
        ctx.arc(sx, sy - size * 0.7, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = seed > 0.5 ? '#3a8a32' : '#2a7a28';
        ctx.beginPath();
        ctx.arc(sx - size * 0.15, sy - size * 0.8, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    /** Render improved street name signs */
    private renderStreetSigns(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const sign of STREET_SIGNS) {
            const { sx, sy } = camera.worldToScreen(sign.x, sign.y);
            const z = camera.zoom;

            if (sx < -100 || sx > ctx.canvas.width + 100 || sy < -100 || sy > ctx.canvas.height + 100) continue;

            const fontSize = 6.5 * z;
            ctx.font = `bold ${fontSize}px "Press Start 2P", monospace`;
            const textWidth = ctx.measureText(sign.name).width;
            const signH = 10 * z;
            const signX = sx - textWidth / 2;
            const signY = sy - 24 * z;

            // Pole
            ctx.fillStyle = '#444';
            ctx.fillRect(sx - 1 * z, signY + signH - 2 * z, 2 * z, 26 * z);

            // Sign plate background (Green)
            ctx.fillStyle = '#0a5a1a';
            ctx.fillRect(signX - 3 * z, signY, textWidth + 6 * z, signH);

            // White border
            ctx.strokeStyle = '#eee';
            ctx.lineWidth = 1 * z;
            ctx.strokeRect(signX - 3 * z, signY, textWidth + 6 * z, signH);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(sign.name, sx, signY + signH - 3.5 * z);
        }
    }

    /** Render area labels */
    private renderAreaLabels(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const label of AREA_LABELS) {
            const { sx, sy } = camera.worldToScreen(label.x, label.y);
            const z = camera.zoom;
            if (sx < -200 || sx > ctx.canvas.width + 200 || sy < -200 || sy > ctx.canvas.height + 200) continue;

            const lines = label.name.split('\n');
            const fontSize = label.type === 'shopping' ? 7 * z : 6 * z;
            ctx.font = `${fontSize}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';

            // Measure box
            let maxWidth = 0;
            for (const line of lines) {
                maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
            }
            const lineHeight = fontSize + 4 * z;
            const totalH = lines.length * lineHeight;
            const boxY = sy - 25 * z - totalH;

            // Draw Background Box for Readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(sx - maxWidth / 2 - 5 * z, boxY - 3 * z, maxWidth + 10 * z, totalH + 6 * z);
            ctx.strokeStyle = label.type === 'shopping' ? 'rgba(255, 136, 204, 0.6)' : 'rgba(170, 221, 170, 0.6)';
            ctx.lineWidth = 1 * z;
            ctx.strokeRect(sx - maxWidth / 2 - 5 * z, boxY - 3 * z, maxWidth + 10 * z, totalH + 6 * z);

            for (let i = 0; i < lines.length; i++) {
                const ly = boxY + i * lineHeight + fontSize + 1 * z;

                // Text Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillText(lines[i], sx + 1, ly + 1);

                // Actual Text
                ctx.fillStyle = label.type === 'shopping' ? '#ff88cc' : '#aaddaa';
                ctx.fillText(lines[i], sx, ly);
            }
        }
    }
}



/** Tile color palettes */
const TILE_COLORS: Record<number, { base: string[]; stroke?: string }> = {
    [TILE_TYPES.VOID]: { base: ['#050508'] },
    [TILE_TYPES.STREET]: { base: ['#3a3a42', '#383840', '#3c3c46'], stroke: '#2a2a32' },
    [TILE_TYPES.SIDEWALK]: { base: ['#5a5a62', '#585860', '#5c5c66'], stroke: '#4a4a52' },
    [TILE_TYPES.ALLEY]: { base: ['#2a2a32', '#282830', '#2c2c34'], stroke: '#1a1a24' },
    [TILE_TYPES.BUILDING_LOW]: { base: ['#4a3a2a'] },
    [TILE_TYPES.BUILDING_TALL]: { base: ['#3a3a4a'] },
    [TILE_TYPES.PLAZA]: { base: ['#4a4a56', '#484854', '#4c4c58'], stroke: '#3a3a46' },
    [TILE_TYPES.GRASS]: { base: ['#2a4a28', '#284826', '#2c4c2a'], stroke: '#1a3a18' },
    [TILE_TYPES.SHOPPING]: { base: ['#4a4058'] },
    [TILE_TYPES.WALL]: { base: ['#5a5050'] },
    [TILE_TYPES.STAIRS_UP]: { base: ['#6a6a6a', '#686868'], stroke: '#4a4a4a' },
    [TILE_TYPES.STAIRS_DOWN]: { base: ['#5a5a6a', '#585868'], stroke: '#3a3a4a' },
    [TILE_TYPES.ENTRANCE]: { base: ['#3a4a5a', '#384858'], stroke: '#2a3a4a' },
    [TILE_TYPES.FENCE]: { base: ['#4a4a3a'] },
    [TILE_TYPES.TREE]: { base: ['#2a4a28'] },
    [TILE_TYPES.MONUMENT]: { base: ['#eeeeee'], stroke: '#cccccc' },
};

/** Building color palettes */
const BUILDING_COLORS = {
    low: [
        { top: '#6a5a4a', left: '#4a3a2a', right: '#5a4a3a' },
        { top: '#685848', left: '#483828', right: '#58483a' },
        { top: '#6c5c4c', left: '#4c3c2c', right: '#5c4c3c' },
        { top: '#7a6050', left: '#5a4030', right: '#6a5040' },
        { top: '#6a584a', left: '#4a3828', right: '#5a483a' },
        // New Colors (Variety)
        { top: '#6a7a8a', left: '#4a5a6a', right: '#5a6a7a' }, // Faded Blue
        { top: '#8a6a6a', left: '#6a4a4a', right: '#7a5a5a' }, // Worn Pink
        { top: '#8a8a6a', left: '#6a6a4a', right: '#7a7a5a' }, // Ochre
        { top: '#9a9a9a', left: '#7a7a7a', right: '#8a8a8a' }, // Dirty White
        { top: '#5a7a6a', left: '#3a5a4a', right: '#4a6a5a' }, // Teal
    ],
    tall: [
        { top: '#5a5a6a', left: '#3a3a4a', right: '#4a4a5a' },
        { top: '#585868', left: '#383848', right: '#484858' },
        { top: '#5c5c6c', left: '#3c3c4c', right: '#4c4c5c' },
    ],
    shopping: {
        top: '#6a608a', left: '#4a4068', right: '#5a5078',
    },
    wall: [
        { top: '#7a7068', left: '#5a5048', right: '#6a6058' },
        { top: '#786e66', left: '#584e46', right: '#685e56' },
        { top: '#7c7270', left: '#5c524a', right: '#6c625a' },
    ],
};

/** A drawable structure at a Y position for depth sorting */
export interface StructureDrawable {
    y: number;
    draw: () => void;
}
