/**
 * Map data for Santa Cruz ("Lesco Lesco City") — HIGH DENSITY EDITION.
 * 300x300 tiles.
 *
 * Changes:
 * - Streets narrowed (Main: 4->3, Side: 3->2)
 * - Buildings taller (via TileRenderer constants, verified here by types)
 * - Casino Clandestino restored at Shopping back entrance.
 * - Residential areas densified.
 */

export const TILE_TYPES = {
    VOID: 0,
    STREET: 1,
    SIDEWALK: 2,
    ALLEY: 3,
    BUILDING_LOW: 4,
    BUILDING_TALL: 5,
    PLAZA: 6,
    GRASS: 7,
    CHURCH: 8,
    SHOPPING: 9, // Renumbered from 8 to 9
    LAMPPOST: 10, // Renumbered from 9 to 10
    WALL: 11, // Renumbered from 10 to 11
    STAIRS_UP: 12, // Renumbered from 11 to 12
    STAIRS_DOWN: 13, // Renumbered from 12 to 13
    ENTRANCE: 14, // Renumbered from 13 to 14
    FENCE: 15, // Renumbered from 14 to 15
    TREE: 16,
    BENCH: 17,
    FOUNTAIN: 18,
    DOMINO_TABLE: 19,
    MONUMENT: 20,
    DECORATIVE_ENTRANCE: 21,
    INFORMATION_BOOTH: 22,
} as const;

export type TileType = typeof TILE_TYPES[keyof typeof TILE_TYPES];

// ... (existing code) ...

export const AREA_LABELS: { x: number; y: number; name: string; type: 'neighborhood' | 'shopping' }[] = [
    { x: 130, y: 125, name: 'SANTA CRUZ\nSHOPPING', type: 'shopping' },
    { x: 242, y: 165, name: 'ESTAÇÃO\nSANTA CRUZ', type: 'shopping' },
    { x: 235, y: 135, name: 'MARCO IMPERIAL\nONZE', type: 'neighborhood' },
    { x: 158, y: 170, name: 'PRAÇA MARQUES\nDE HERVAL', type: 'neighborhood' },
    { x: 130, y: 83, name: 'IGREJA N.S.\nDA CONCEIÇÃO', type: 'neighborhood' },
];

export interface POI {
    x: number;
    y: number;
    type: 'purrinha' | 'ronda' | 'dice' | 'domino' | 'npc_homeless' | 'npc_info' | 'npc_casino_promoter' | 'bingo' | 'pedinte' | 'domino_table';
    name: string;
}

export interface StreetSign { x: number; y: number; name: string; direction: 'h' | 'v'; }
export interface Crosswalk { x: number; y: number; direction: 'h' | 'v'; }
export type CityLightType = 'street' | 'streetglow' | 'residential' | 'plaza' | 'shopping' | 'alley';
export interface CityLight { x: number; y: number; type: CityLightType; }

export const MAP_WIDTH = 300;
export const MAP_HEIGHT = 300;

// Aliases for brevity
const S = TILE_TYPES.STREET;
const W = TILE_TYPES.SIDEWALK;
const A = TILE_TYPES.ALLEY;
const BL = TILE_TYPES.BUILDING_LOW;
const BT = TILE_TYPES.BUILDING_TALL;
const PZ = TILE_TYPES.PLAZA;
const G = TILE_TYPES.GRASS;
const SH = TILE_TYPES.SHOPPING;
const EN = TILE_TYPES.ENTRANCE;
const FN = TILE_TYPES.FENCE;
const TR = TILE_TYPES.TREE;
const BN = TILE_TYPES.BENCH;
const FT = TILE_TYPES.FOUNTAIN;
const CH = TILE_TYPES.CHURCH;
const DT = TILE_TYPES.DOMINO_TABLE;
const MT = TILE_TYPES.MONUMENT;
const DE = TILE_TYPES.DECORATIVE_ENTRANCE;

function generateMap(): number[][] {
    const map: number[][] = [];

    // Initialize Grass (Void)
    for (let y = 0; y < MAP_HEIGHT; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            map[y][x] = G;
        }
    }

    const set = (x: number, y: number, t: number) => {
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) map[y][x] = t;
    };

    const fill = (x1: number, y1: number, x2: number, y2: number, t: number) => {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, t);
    };

    const safeSet = (x: number, y: number, t: number) => {
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            // Only overwrite Grass or Void
            if (map[y][x] === G || map[y][x] === TILE_TYPES.VOID) {
                map[y][x] = t;
            }
        }
    };

    const safeFill = (x1: number, y1: number, x2: number, y2: number, t: number) => {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) safeSet(x, y, t);
    };

    const safeFillRect = (x: number, y: number, w: number, h: number, t: number) => {
        safeFill(x, y, x + w - 1, y + h - 1, t);
    };

    // --- UTILS: Building Generation ---

    /**
     * Fills a block with dense buildings separated by alleys.
     * Higher density = less open space.
     */
    const fillBlockWithAlleys = (x1: number, y1: number, x2: number, y2: number, density: number = 0.85, tallChance: number = 0.3) => {
        // Reduced grid step to 3 (2 for bldg + 1 for alley) for maximum density
        for (let y = y1; y <= y2; y += 3) {
            for (let x = x1; x <= x2; x += 3) {
                if (Math.random() < density) {
                    const w = 2;
                    const h = 2;
                    const type = Math.random() < tallChance ? BT : BL;
                    if (x + w <= x2 && y + h <= y2) {
                        safeFillRect(x, y, w, h, type);
                    }
                } else {
                    if (Math.random() > 0.7) safeFillRect(x, y, 1, 1, A);
                }
            }
        }

        // Fill remaining gaps with alleys
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (map[y][x] === G) safeSet(x, y, A);
            }
        }

        // --- AGGRESSIVE CONNECTIVITY: Deep Punch-Throughs ---
        // Create 2-tile deep "slots" to break through the building perimeter
        const createSlot = (sx: number, sy: number, dx: number, dy: number) => {
            safeSet(sx, sy, A);
            safeSet(sx + dx, sy + dy, A);
        };

        // 3-4 random slots per side
        for (let i = 0; i < 4; i++) {
            createSlot(x1 + Math.floor(Math.random() * (x2 - x1)), y1, 0, 1);  // Top
            createSlot(x1 + Math.floor(Math.random() * (x2 - x1)), y2, 0, -1); // Bottom
            createSlot(x1, y1 + Math.floor(Math.random() * (y2 - y1)), 1, 0);  // Left
            createSlot(x2, y1 + Math.floor(Math.random() * (y2 - y1)), -1, 0); // Right
        }
    };

    // --- MAIN ARTERIES (Narrower Edition) ---

    // 1. Rua Felipe Cardoso (Main Avenue) Y=150
    // Reduced from 8 tiles wide to ~5 (Sidewalk, Street, Median, Street, Sidewalk)
    const fcY = 150;
    for (let x = 0; x < MAP_WIDTH; x++) {
        set(x, fcY - 2, W);
        set(x, fcY - 1, S); // Eastbound
        set(x, fcY, (x % 10 === 0) ? TR : S); // Median
        set(x, fcY + 1, S); // Westbound
        set(x, fcY + 2, W);
    }

    // 2. Rua Barão de Laguna (Commercial) X=100
    // Typically pedestrian heavy, so narrow street, wide sidewalk?
    // Let's make it tight: Sidewalk, Street, Sidewalk (3 tiles total)
    const blX = 100;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        set(blX - 1, y, W);
        set(blX, y, S);
        set(blX + 1, y, W);
    }

    // 3. Rua Lucindo Passos (Station) Y=200
    const lpY = 200;
    for (let x = 0; x < MAP_WIDTH; x++) {
        set(x, lpY - 1, W);
        set(x, lpY, S);
        set(x, lpY + 1, S); // 2 lane one-way?
        set(x, lpY + 2, W);
    }

    // 4. Rua General Olímpio (North) Y=80
    const goY = 80;
    for (let x = 0; x < MAP_WIDTH; x++) {
        set(x, goY - 1, W);
        set(x, goY, S);
        set(x, goY + 1, W);
    }

    // 5. Rua Fernanda X=40
    const rfX = 40;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        set(rfX - 1, y, W);
        set(rfX, y, S);
        set(rfX + 1, y, W);
    }

    // 6. Rua Severiano das Chagas X=220
    const scX = 220;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        set(scX - 1, y, W);
        set(scX, y, S);
        set(scX + 1, y, W);
    }

    // 7. Rua Lemos X=160
    const rlX = 160;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        if (y > fcY) {
            set(rlX, y, S); // Just a street, no sidewalks (favela style)
        }
    }

    // 8. Rua Doze de Fevereiro Y=30
    const dfY = 30;
    for (let x = 0; x < MAP_WIDTH; x++) {
        set(x, dfY, S);
    }

    // 9. NEW: Rua Senador Camará (Central Residential) Y=115
    const scmY = 115;
    for (let x = 45; x < 215; x++) {
        // Break for Shopping
        if (x >= 117 && x <= 143) continue;
        set(x, scmY, S);
    }

    // 10. NEW: Rua Lopes de Moura (West-Central) X=110
    const lmX = 110;
    for (let y = 80; y < 150; y++) {
        set(lmX, y, S);
    }

    // 11. NEW: Rua General Canabarro (East-Central) X=190
    const gcX = 190;
    for (let y = 80; y < 150; y++) {
        set(gcX, y, S);
    }


    // --- ZONES & FILLING ---

    // A. Santa Cruz Shopping Zone (Smaller footprint - 15% reduction)
    // Original: 115-145 (30) x 110-145 (35) = 1050
    // Target: ~890. 
    // New: 117-143 (26) x 112-143 (31) = 806 (approx 23% less, close enough to visually shrink)
    fill(117, 112, 143, 143, SH);
    // Entrance facing Felipe Cardoso
    fill(127, 144, 133, 146, PZ);
    set(130, 143, DE); // Aesthetic Entrance

    // *** CLANDESTINE CASINO ***
    // Hidden entrance at the back/side of the shopping
    // Located at (115, 120) - West wall
    set(114, 120, EN); // The secret door
    // Add a small "alley" leading to it
    fill(110, 120, 113, 120, A);

    // B. Station Structure (MOVED to Intersection of Felipe Cardoso & Severiano)
    // Old location removed.
    // New Location: South-East corner (X=225..260, Y=155..175)
    fill(225, 155, 260, 175, BT); // Station Building
    fill(225, 176, 260, 178, FN); // Station Fence

    // --- NEW: STATION PASSAGES (Refined) ---
    // Carve one vertical and one horizontal passage through the station with more randomness
    const carveX = 227 + Math.floor(Math.random() * 32); // Random through building width (225-260)
    const carveY = 157 + Math.floor(Math.random() * 16); // Random through building height (155-175)

    fill(carveX, 155, carveX, 175, A); // Vertical passage
    fill(225, carveY, 260, carveY, A); // Horizontal passage

    // Open a gap in the fence at the back for the hidden entrance
    set(226, 176, W);
    set(226, 177, W);
    set(226, 178, W);

    // *** MARCO IMPERIAL ONZE (Plaza) ***
    // North-East corner of Felipe/Severiano (X=225..245, Y=130..149)
    fill(225, 130, 245, 149, PZ);

    // Enclose with Walls (Limit to 2 entrances)
    const enclose = (x1: number, y1: number, x2: number, y2: number, gaps: { x: number, y: number }[]) => {
        // Horizontal Walls
        for (let x = x1; x <= x2; x++) {
            if (!gaps.some(g => g.x === x && g.y === y1)) set(x, y1, TILE_TYPES.WALL);
            if (!gaps.some(g => g.x === x && g.y === y2)) set(x, y2, TILE_TYPES.WALL);
        }
        // Vertical Walls
        for (let y = y1; y <= y2; y++) {
            if (!gaps.some(g => g.x === x1 && g.y === y)) set(x1, y, TILE_TYPES.WALL);
            if (!gaps.some(g => g.x === x2 && g.y === y)) set(x2, y, TILE_TYPES.WALL);
        }
    };

    // Marco Imperial Entrances: West (Towards Station/Shop), South (Towards Felipe/Severiano)
    enclose(225, 130, 245, 149, [
        { x: 225, y: 140 }, // West gap
        { x: 235, y: 149 }, // South gap
    ]);

    // Decorate Marco Imperial
    // Trees in corners
    set(226, 131, TR); set(244, 131, TR);
    set(226, 148, TR); set(244, 148, TR);
    // Benches near center
    set(232, 140, BN); set(238, 140, BN);
    set(235, 136, BN); set(235, 144, BN);
    // Marco Imperial Center Monument
    set(235, 140, MT);

    // Hidden Station Casino Entrance (Santa Cruz Station - South Corner)
    set(226, 175, EN);

    // Station Main Entrance (Aesthetic - Non-functional)
    set(242, 155, DE);

    // Domino Tables (5 tables)
    set(229, 137, DT); set(229, 143, DT);
    set(241, 137, DT); set(241, 143, DT);
    set(235, 133, DT);

    // *** IGREJA NOSSA SENHORA DA CONCEIÇÃO ***
    // Moved to General Olímpio (Y=80). "Glued to street", facing North (away from Shopping).
    // Plaza first (North), then Church (South).
    // Plaza: 125..135, Y=81..85 (Touches street at Y=80)
    fill(125, 81, 135, 85, PZ);
    // Church: 125..135, Y=86..98
    fill(125, 86, 135, 98, CH);

    // C. Commercial Blocks (Barão de Laguna)
    // Very tall, very dense
    fillBlockWithAlleys(45, 35, 95, 75, 0.95, 0.6);
    fillBlockWithAlleys(45, 85, 95, 145, 0.95, 0.7);

    /**
     * Recursive Favela Labyrinth Generator.
     * Uses recursive division to create a connected grid of alleys/streets.
     */
    const generateFavelaLabyrinth = (x1: number, y1: number, x2: number, y2: number) => {
        const w = x2 - x1;
        const h = y2 - y1;

        if (w < 10 || h < 10) {
            for (let y = y1; y <= y2; y += 2) {
                for (let x = x1; x <= x2; x += 2) {
                    if (map[y][x] === G) {
                        if (Math.random() < 0.8) {
                            const type = Math.random() < 0.2 ? BT : BL;
                            const bw = Math.random() > 0.3 ? 2 : 1;
                            const bh = Math.random() > 0.3 ? 2 : 1;
                            let canBuild = true;
                            if (x + bw > x2 + 1 || y + bh > y2 + 1) canBuild = false;
                            if (canBuild) {
                                for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++)
                                    if (x + bx < MAP_WIDTH && y + by < MAP_HEIGHT && map[y + by][x + bx] !== G) canBuild = false;
                            }
                            if (canBuild) safeFillRect(x, y, bw, bh, type);
                        }
                    }
                }
            }
            // Fill gaps with Alleys
            for (let y = y1; y <= y2; y++) {
                for (let x = x1; x <= x2; x++) {
                    if (map[y][x] === G) safeSet(x, y, A);
                }
            }
            return;
        }

        const splitH = w > h ? false : (h > w ? true : Math.random() > 0.5);

        if (splitH) {
            const splitY = Math.floor(y1 + 4 + Math.random() * (h - 8));
            const roadType = Math.random() > 0.7 ? S : A;
            const rw = roadType === S ? 1 : 0;
            // STITCHING: Ensure road hits the parent boundaries
            safeFill(x1, splitY, x2, splitY + rw, roadType);

            // --- AGGRESSIVE PUNCH-THROUGH (Favela) ---
            // Randomly create wider openings (2-tile) at boundaries
            if (Math.random() < 0.5) safeFillRect(x1, Math.floor(y1 + Math.random() * (h - 1)), (w > 20 ? 2 : 1), 1, A);
            if (Math.random() < 0.5) safeFillRect(x2 - 1, Math.floor(y1 + Math.random() * (h - 1)), (w > 20 ? 2 : 1), 1, A);

            generateFavelaLabyrinth(x1, y1, x2, splitY - 1);
            generateFavelaLabyrinth(x1, splitY + rw + 1, x2, y2);
        } else {
            const splitX = Math.floor(x1 + 4 + Math.random() * (w - 8));
            const roadType = Math.random() > 0.7 ? S : A;
            const rw = roadType === S ? 1 : 0;
            // STITCHING: Ensure road hits the parent boundaries
            safeFill(splitX, y1, splitX + rw, y2, roadType);

            // --- AGGRESSIVE PUNCH-THROUGH (Favela) ---
            if (Math.random() < 0.5) safeFillRect(Math.floor(x1 + Math.random() * (w - 1)), y1, 1, (h > 20 ? 2 : 1), A);
            if (Math.random() < 0.5) safeFillRect(Math.floor(x1 + Math.random() * (w - 1)), y2 - 1, 1, (h > 20 ? 2 : 1), A);

            generateFavelaLabyrinth(x1, y1, splitX - 1, y2);
            generateFavelaLabyrinth(splitX + rw + 1, y1, x2, y2);
        }
    };


    // D. Residential / Mixed (Central - kept semi-regular)
    // High density residential (favelas/apartments)
    fillBlockWithAlleys(165, 35, 215, 75, 0.9, 0.4);
    fillBlockWithAlleys(165, 85, 215, 145, 0.9, 0.5);

    // E. Deep Favela (Edges) - LABYRINTH
    // Far Left
    generateFavelaLabyrinth(10, 10, 35, 290);
    // Far Right
    generateFavelaLabyrinth(225, 10, 290, 290);

    // F. The "Loop" Area (South-West) - LABYRINTH
    generateFavelaLabyrinth(45, 205, 215, 280);

    // *** PRAÇA MARQUES DE HERVAL ***
    // Moved to gap Diagonal to Shopping (X=148..168, Y=160..190)
    fill(148, 160, 168, 190, PZ);

    // Enclose with Walls (Large Plaza -> 4 entrances)
    enclose(148, 160, 168, 190, [
        { x: 158, y: 160 }, // North
        { x: 158, y: 190 }, // South
        { x: 148, y: 175 }, // West
        { x: 168, y: 175 }, // East
    ]);

    // Decorate Marques de Herval
    // Trees grid
    for (let y = 162; y <= 188; y += 4) {
        for (let x = 150; x <= 166; x += 4) {
            if (x !== 158 || y !== 175) set(x, y, TR); // Don't block center/paths
        }
    }
    // Benches along main paths
    set(156, 175, BN); set(160, 175, BN); // East-West path benches
    set(158, 173, BN); set(158, 177, BN); // North-South path benches
    // Center feature
    fill(156, 173, 160, 177, G);
    set(158, 175, FT); // Ensure fountain is back if G fill cleared it

    // Domino Tables (8 tables)
    set(152, 165, DT); set(152, 175, DT); set(152, 185, DT);
    set(164, 165, DT); set(164, 175, DT); set(164, 185, DT);
    set(158, 165, DT); set(158, 185, DT);

    // --- G. IRREGULAR RESIDENTIAL STREETS (Carved out) ---

    // 1. Rua do Império (Winding through East Block)
    // Starts at Severiano das Chagas (X=220) goes West, then turns South
    // Segment 1: Horizontal X[180..220] at Y=60
    fill(180, 59, 220, 61, S);
    // Segment 2: Vertical X[180] from Y=60 to Y=80 (connects to Gen. Olimpio?)
    fill(179, 60, 181, 80, S);

    // 2. Rua Álvaro Alberto (Connects East Res to Central/Shopping)
    // Horizontal cut through the block at Y=110, from X=165 to X=220
    fill(160, 109, 220, 111, S);
    // Connects to Rua Lemos (X=160) which is a Favela street

    // 3. Beco do Matadouro (The Loop / South-West Maze)
    // Irregular alley/street network
    // A diagonal-ish cut? Or just a cross
    fill(60, 220, 120, 222, S); // East-West cut
    fill(80, 205, 82, 260, S);  // North-South cut
    fill(80, 260, 150, 262, S); // Bottom connection towards Station


    // --- H. SUBDIVISION AVENUES (Nicely Demarcated) ---

    // 4. Rua São Benedito (Vertical Split of West Block) - X=70
    // From Y=35 to Y=280
    // Demarcation: Sidewalk - Street - Sidewalk
    const sbX = 70;
    for (let y = 35; y < 280; y++) {
        set(sbX - 1, y, W);
        set(sbX, y, S);
        set(sbX + 1, y, W);
    }

    // 5. Avenida Antares (Horizontal Crossing South) - Y=240
    // From X=10 to X=290
    // Demarcation: Sidewalk - Street - Street - Sidewalk (Wider)
    const aaY = 240;
    for (let x = 10; x < 290; x++) {
        set(x, aaY - 2, W);
        set(x, aaY - 1, S);
        set(x, aaY, S);
        set(x, aaY + 1, W);
    }

    // 6. Travessa das Flores (East Block Subdivision)
    // Small connecting alleys/streets in X=165..215 area
    // Horizontal cut at Y=45 and Y=130
    fill(165, 45, 215, 45, S); // Narrow street
    fill(165, 130, 215, 130, S);

    // 7. MASSIVE RESIDENTIAL INTERCONNECTIVITY ( ~120+ Interlinked Transpassos)
    // Carving out a network ONLY within residential/favela sectors
    const residentialZones = [
        { x: [10, 35], y: [10, 290] },   // Far West Favela
        { x: [45, 95], y: [10, 145] },   // West Residential
        { x: [165, 215], y: [10, 145] }, // East Residential
        { x: [225, 290], y: [10, 290] }, // Far East Favela
        { x: [45, 215], y: [205, 290] }, // South Loop/Favela
    ];

    for (let i = 0; i < 140; i++) {
        const zone = residentialZones[Math.floor(Math.random() * residentialZones.length)];
        const isH = Math.random() > 0.5;
        let x1 = Math.floor(zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]));
        let y1 = Math.floor(zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]));

        if (isH) {
            let xS = x1, xE = Math.min(x1 + 35, zone.x[1]);
            // Forced connectivity: 90% chance to reach a main vertical artery
            if (Math.random() < 0.9) {
                if (x1 < 100 && xE >= 95) xE = 100; // Hit Barão de Laguna
                if (x1 > 215 && xS <= 225) xS = 220; // Hit Severiano
                if (x1 < 45 && xE >= 35) xE = 40;   // Hit Rua Fernanda
            }
            fill(xS, y1, xE, y1, S);
        } else {
            let yS = y1, yEnd = Math.min(y1 + 35, zone.y[1]);
            if (Math.random() < 0.9) {
                if (y1 < 155 && yEnd >= 145) yEnd = 150; // Hit Felipe Cardoso
                if (y1 < 245 && yEnd >= 235) yEnd = 240; // Hit Antares
                if (y1 < 85 && yEnd >= 75) yEnd = 80;    // Hit General Olimpio
            }
            fill(x1, yS, x1, yEnd, S);
        }
    }

    // --- FINAL PROTECTION & POLISH ---
    fill(117, 112, 143, 143, SH);
    for (let x = 0; x < MAP_WIDTH; x++) { set(x, fcY - 1, S); set(x, fcY + 1, S); }
    for (let y = 0; y < MAP_HEIGHT; y++) { set(blX, y, S); set(rfX, y, S); set(scX, y, S); }

    // --- STRATEGIC FAVELA CONNECTORS (The "Veins") ---
    fill(10, 99, 45, 101, A); fill(10, 179, 45, 181, A);
    fill(215, 60, 230, 60, A); fill(215, 109, 230, 111, A); fill(215, 219, 240, 221, A);
    fill(40, 240, 220, 241, S);

    // --- CRITICAL: CLEAR STATION CASINO ENTRANCE ---
    fill(225, 176, 227, 178, W); // Clear path through fence (X=226)
    fill(225, 173, 227, 175, A); // Clearing small "alcove" for the entrance

    // --- FINAL SCATTER PASS: "The Massive Leakage" ---
    const isStreetOrSidewalk = (t: number) => t === S || t === W;
    for (let i = 0; i < 4000; i++) {
        const x = Math.floor(30 + Math.random() * (MAP_WIDTH - 60));
        const y = Math.floor(30 + Math.random() * (MAP_HEIGHT - 60));

        if (isStreetOrSidewalk(map[y][x])) {
            const dx = Math.random() > 0.5 ? 1 : -1, dy = Math.random() > 0.5 ? 1 : -1;
            const depth = Math.floor(Math.random() * 3) + 2;
            for (let d = 1; d <= depth; d++) {
                const tx = x + dx * d, ty = y + dy * d;
                if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                    const t = map[ty][tx];
                    if (t === BL || t === BT || t === TILE_TYPES.WALL) map[ty][tx] = A;
                }
            }
        }
    }

    // --- CLEAR STATION ENTRANCE PLAZA ---
    // Make sure the 5x larger entrance has plenty of space
    fill(235, 149, 250, 161, PZ);

    // Final specific placements (Aesthetic & Social) - MUST BE LAST TO AVOID OVERWRITE
    set(130, 143, DE); // Shopping Santa Cruz Entrance facing Felipe Cardoso
    set(242, 155, TILE_TYPES.INFORMATION_BOOTH); // Estação Santa Cruz Info Booth (Replaced DE)
    set(226, 175, EN); // Hidden Station Casino Entrance

    return map;
}

export const MAP_DATA = generateMap();

export function findSafeSpawn(): { x: number, y: number } {
    return { x: 130, y: 152 }; // On the street/median of Felipe Cardoso
}

export const STREET_SIGNS: StreetSign[] = [
    { x: 130, y: 155, name: 'R. Felipe Cardoso', direction: 'h' },
    { x: 100, y: 130, name: 'R. Barão de Laguna', direction: 'v' },
    { x: 130, y: 205, name: 'R. Lucindo Passos', direction: 'h' },
    { x: 112, y: 120, name: '???', direction: 'h' }, // Shopping Casino Hint
    { x: 226, y: 180, name: '???', direction: 'v' }, // Station Casino Hint

    // New Streets
    { x: 200, y: 62, name: 'R. do Império', direction: 'h' },
    { x: 190, y: 112, name: 'R. Álvaro Alberto', direction: 'h' },
    { x: 90, y: 224, name: 'Beco do Matadouro', direction: 'h' },

    // Subdivision Streets
    { x: 74, y: 100, name: 'R. São Benedito', direction: 'v' },
    { x: 150, y: 236, name: 'Av. Antares', direction: 'h' },
    { x: 170, y: 48, name: 'Tv. das Flores', direction: 'h' },

    // New Residential Connections
    { x: 112, y: 100, name: 'R. Lopes de Moura', direction: 'v' },
    { x: 188, y: 100, name: 'R. Gen. Canabarro', direction: 'v' },
    { x: 165, y: 113, name: 'R. Sen. Camará', direction: 'h' },
];


export const CROSSWALKS: Crosswalk[] = [
    { x: 130, y: 150, direction: 'v' },
    { x: 100, y: 150, direction: 'v' },
];

export const POINTS_OF_INTEREST: POI[] = [
    { x: 128, y: 147, type: 'pedinte', name: 'Zumbi do Shopping' },
    { x: 114, y: 121, type: 'npc_casino_promoter', name: 'Leão do Norte' },
    // Marco Imperial Domino Players
    { x: 229, y: 137, type: 'domino_table', name: 'Geraldo' },
    { x: 229, y: 143, type: 'domino_table', name: 'Seu Jorge' },
    { x: 241, y: 137, type: 'domino_table', name: 'Manoel' },
    { x: 241, y: 143, type: 'domino_table', name: 'Tião' },
    { x: 235, y: 133, type: 'domino_table', name: 'Vicente' },
    // Marques de Herval Domino Players
    { x: 152, y: 165, type: 'domino_table', name: 'Ademir' },
    { x: 152, y: 175, type: 'domino_table', name: 'Valdir' },
    { x: 152, y: 185, type: 'domino_table', name: 'Nelsinho' },
    { x: 164, y: 165, type: 'domino_table', name: 'Jair' },
    { x: 164, y: 175, type: 'domino_table', name: 'Osmar' },
    { x: 164, y: 185, type: 'domino_table', name: 'Delson' },
    { x: 158, y: 165, type: 'domino_table', name: 'Zezé' },
    { x: 158, y: 185, type: 'domino_table', name: 'Carlinhos' },

    // --- MINIGAME SECTOR CLUSTERS ---
    // North Hub: Purrinha (Near Church/North Side)
    { x: 130, y: 75, type: 'purrinha', name: 'do Norte' },
    { x: 125, y: 78, type: 'purrinha', name: 'da Praça' },
    { x: 135, y: 78, type: 'purrinha', name: 'Antigo' },

    // West Hub: Dice (Deep Alleys / Beco do Matadouro)
    { x: 60, y: 235, type: 'dice', name: 'do Beco' },
    { x: 62, y: 245, type: 'dice', name: 'da Sorte' },
    { x: 55, y: 240, type: 'dice', name: 'Viciado' },

    // East Hub: Ronda (Near Station / Marco Imperial)
    { x: 235, y: 160, type: 'ronda', name: 'da Estação' },
    { x: 250, y: 165, type: 'ronda', name: 'do Trem' },
    { x: 240, y: 170, type: 'ronda', name: 'Estratega' },

    // Station Pedintes (With new hints)
    { x: 230, y: 162, type: 'pedinte', name: 'Cego da Estação' },
    { x: 245, y: 158, type: 'pedinte', name: 'Velho do Trem' },
    { x: 255, y: 168, type: 'pedinte', name: '瘸子 (Manco)' },
];

// ── Zone helpers ─────────────────────────────────────────────────────────────
// "Urban" hubs: Santa Cruz Shopping center and the Train Station
const URBAN_HUBS = [
    { x: 130, y: 125 }, // Santa Cruz Shopping
    { x: 242, y: 165 }, // Estação Santa Cruz
];
function distToNearestHub(tx: number, ty: number): number {
    let best = Infinity;
    for (const h of URBAN_HUBS) {
        const d = Math.abs(tx - h.x) + Math.abs(ty - h.y); // Manhattan — fast, no sqrt
        if (d < best) best = d;
    }
    return best;
}

// seededRandom already declared above; reuse it here
// Inline for MapData scope (avoids import dependency)
function mapSeededRand(sx: number, sy: number): number {
    const n = Math.sin(sx * 17.391 + sy * 43.758) * 98765.4321;
    return n - Math.floor(n);
}

export const CITY_LIGHTS: CityLight[] = [];
// Helper for physical proximity (pole-to-pole)
const physicalLampGrid: boolean[][] = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));

function canPlacePhysicalLamp(x: number, y: number, minDist: number): boolean {
    for (let dy = -minDist; dy <= minDist; dy++) {
        for (let dx = -minDist; dx <= minDist; dx++) {
            const tx = x + dx, ty = y + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                if (physicalLampGrid[ty][tx]) return false;
            }
        }
    }
    return true;
}

for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
        const tile = MAP_DATA[y][x];
        const dist = distToNearestHub(x, y);

        // ── STREET tiles: invisible road-glow
        if (tile === TILE_TYPES.STREET) {
            const glowStride = dist < 45 ? 6 : 4; // Denser glow in residential/periphery
            // Use a pattern that avoids diagonals
            if ((x % glowStride === 0 && y % 2 === 0) || (y % glowStride === 0 && x % 2 === 0)) {
                CITY_LIGHTS.push({ x, y, type: 'streetglow' });
            }
        }

        // ── SIDEWALK tiles → physical lampposts (Both sides of the street)
        if (tile === TILE_TYPES.SIDEWALK) {
            const adjN = y > 0 && (MAP_DATA[y - 1][x] === TILE_TYPES.STREET || MAP_DATA[y - 1][x] === TILE_TYPES.ALLEY);
            const adjS = y < MAP_HEIGHT - 1 && (MAP_DATA[y + 1][x] === TILE_TYPES.STREET || MAP_DATA[y + 1][x] === TILE_TYPES.ALLEY);
            const adjE = x < MAP_WIDTH - 1 && (MAP_DATA[y][x + 1] === TILE_TYPES.STREET || MAP_DATA[y][x + 1] === TILE_TYPES.ALLEY);
            const adjW = x > 0 && (MAP_DATA[y][x - 1] === TILE_TYPES.STREET || MAP_DATA[y][x - 1] === TILE_TYPES.ALLEY);
            const hasRoadNeighbor = adjN || adjS || adjE || adjW;
            if (!hasRoadNeighbor) continue;

            const isCorner = ((adjN || adjS) && (adjE || adjW));
            let shouldPlace = false;

            if (dist < 45) {
                // ZONE A: Urban Center
                if (isCorner) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 2);
                } else if (x % 6 === 0 || y % 6 === 0) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 2);
                }
            } else if (dist < 100) {
                // ZONE B: Intermediate (Residential)
                if (isCorner && mapSeededRand(x, y) > 0.1) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 2);
                } else if ((x % 6 === 0 || y % 6 === 0) && mapSeededRand(x, y) > 0.3) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 3);
                }
            } else {
                // ZONE C: Peripheral (Residential)
                if (isCorner && mapSeededRand(x, y) > 0.2) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 2);
                } else if (mapSeededRand(x, y) > 0.75) {
                    shouldPlace = canPlacePhysicalLamp(x, y, 3);
                }
            }

            if (shouldPlace) {
                CITY_LIGHTS.push({ x, y, type: 'street' });
                physicalLampGrid[y][x] = true;
            }
        }

        // ── Alley lights: increase frequency (Favela / Residential Interiors)
        if (tile === TILE_TYPES.ALLEY && (x % 6 === 0 && y % 6 === 0)) {
            if (canPlacePhysicalLamp(x, y, 2)) {
                CITY_LIGHTS.push({ x, y, type: 'alley' });
                physicalLampGrid[y][x] = true;
            }
        }

        // ── Plaza lights (Spaced out for cleaner look)
        if (tile === TILE_TYPES.PLAZA && x % 14 === 0 && y % 14 === 0) {
            if (canPlacePhysicalLamp(x, y, 6)) {
                CITY_LIGHTS.push({ x, y, type: 'plaza' });
                physicalLampGrid[y][x] = true;
            }
        }

        // ── Residential window lights: increase frequency
        if ((tile === TILE_TYPES.BUILDING_LOW || tile === TILE_TYPES.BUILDING_TALL) &&
            x % 2 === 0 && y % 2 === 0 && mapSeededRand(x * 3, y * 7) > 0.2) {
            CITY_LIGHTS.push({ x, y, type: 'residential' });
        }


        // ── Shopping lights
        if (tile === TILE_TYPES.SHOPPING && x % 5 === 0 && y % 5 === 0) {
            CITY_LIGHTS.push({ x, y, type: 'shopping' });
        }

        // ── Entrance glow
        if (tile === TILE_TYPES.ENTRANCE) {
            CITY_LIGHTS.push({ x, y, type: 'alley' });
        }
    }
}

// ── Special landmark lights: strong plaza-level illumination ────────────────
// Igreja N.S. da Conceição — ring of lights AROUND the building, not inside it
// Church center ~(130, 88). Ring at radius ~9 tiles in 8 directions.
const churchCx = 130, churchCy = 88;
const churchRingPositions = [
    { dx: 0, dy: -9 },  // North
    { dx: 7, dy: -6 },  // NE
    { dx: 9, dy: 0 },  // East
    { dx: 7, dy: 6 },  // SE
    { dx: 0, dy: 9 },  // South
    { dx: -7, dy: 6 },  // SW
    { dx: -9, dy: 0 },  // West
    { dx: -7, dy: -6 },  // NW
];
for (const p of churchRingPositions) {
    CITY_LIGHTS.push({ x: churchCx + p.dx, y: churchCy + p.dy, type: 'plaza' });
}
// Estação Santa Cruz (Spaced pattern)
for (let ox = 0; ox <= 3; ox++) {
    for (let oy = 0; oy <= 1; oy++) {
        CITY_LIGHTS.push({ x: 232 + ox * 9, y: 161 + oy * 10, type: 'plaza' });
    }
}
// Marco Imperial Onze (Corner pattern)
for (let ox = 0; ox <= 1; ox++) {
    for (let oy = 0; oy <= 1; oy++) {
        CITY_LIGHTS.push({ x: 228 + ox * 10, y: 133 + oy * 10, type: 'plaza' });
    }
}
// Praça Marques de Herval (Symmetric pattern)
for (let ox = 0; ox <= 1; ox++) {
    for (let oy = 0; oy <= 2; oy++) {
        CITY_LIGHTS.push({ x: 151 + ox * 10, y: 165 + oy * 10, type: 'plaza' });
    }
}

// Physical lamppost positions: ONLY sidewalk-based 'street' lights + plaza + alley
// 'streetglow' (road-center) is intentionally excluded — no post mid-road!
export const LAMPPOST_POSITIONS = CITY_LIGHTS
    .filter(l => l.type === 'street' || l.type === 'plaza' || l.type === 'alley')
    .map(l => ({ x: l.x, y: l.y }));


