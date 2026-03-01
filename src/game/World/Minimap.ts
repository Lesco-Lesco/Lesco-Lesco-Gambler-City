import { Camera } from '../Core/Camera';
import { TileMap } from './TileMap';
import { TILE_TYPES, MAP_WIDTH, STREET_SIGNS, AREA_LABELS } from './MapData';
import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';
import { InputManager } from '../Core/InputManager';

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
    [TILE_TYPES.BAR]: '#ffaa00', // Bright Orange
};

// Colors for the maximized paper map (ink-washed look)
const MAXIMIZED_COLORS: Record<number, string> = {
    [TILE_TYPES.STREET]: '#6d6150',
    [TILE_TYPES.SIDEWALK]: '#8c7d6a',
    [TILE_TYPES.ALLEY]: '#5a4d3d',
    [TILE_TYPES.BUILDING_LOW]: '#af9a7e',
    [TILE_TYPES.BUILDING_TALL]: '#9d886d',
    [TILE_TYPES.PLAZA]: '#8e816d',
    [TILE_TYPES.GRASS]: '#7a856a',
    [TILE_TYPES.SHOPPING]: '#7a6a85',
    [TILE_TYPES.WALL]: '#5a5050',
    [TILE_TYPES.STAIRS_UP]: '#a0a0a0',
    [TILE_TYPES.STAIRS_DOWN]: '#808080',
    [TILE_TYPES.ENTRANCE]: '#5a5a5a',
    [TILE_TYPES.FENCE]: '#6a5a4a',
    [TILE_TYPES.TREE]: '#4a654a',
    [TILE_TYPES.BAR]: '#d48806', // Gold/Orange for paper
};

export class Minimap {
    private minimapCanvas: HTMLCanvasElement;
    private minimapCtx: CanvasRenderingContext2D;
    private maximizedCanvas: HTMLCanvasElement;
    private maximizedCtx: CanvasRenderingContext2D;
    private isMaximized: boolean = false;

    // Maximized Map Zoom
    private zoomLevels: number[] = [1.0, 1.8, 3.0];
    private zoomIndex: number = 0;
    private zoomButtonRect = { x: 0, y: 0, w: 60, h: 60 };

    constructor(tileMap: TileMap) {
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = MINIMAP_BASE_SIZE;
        this.minimapCanvas.height = MINIMAP_BASE_SIZE;
        const ctx = this.minimapCanvas.getContext('2d');
        if (!ctx) throw new Error('Minimap canvas context failed');
        this.minimapCtx = ctx;

        this.maximizedCanvas = document.createElement('canvas');
        this.maximizedCanvas.width = 1000;
        this.maximizedCanvas.height = 1000;
        const mctx = this.maximizedCanvas.getContext('2d');
        if (!mctx) throw new Error('Maximized map canvas context failed');
        this.maximizedCtx = mctx;

        this.prerenderMap(tileMap);
    }

    private prerenderMap(tileMap: TileMap) {
        const mapW = tileMap.getWidth();
        const mapH = tileMap.getHeight();
        const data = tileMap.getData();

        // --- 1. Small corner minimap (Glowy/Digital look) ---
        const tileSize = MINIMAP_BASE_SIZE / Math.max(mapW, mapH);
        this.minimapCtx.fillStyle = '#101018';
        this.minimapCtx.fillRect(0, 0, MINIMAP_BASE_SIZE, MINIMAP_BASE_SIZE);

        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const tile = data[y][x];
                if (tile === TILE_TYPES.VOID || tile === TILE_TYPES.GRASS) continue;
                this.minimapCtx.fillStyle = MINIMAP_COLORS[tile] || '#050508';
                this.minimapCtx.fillRect(x * tileSize, y * tileSize, tileSize + 0.1, tileSize + 0.1);
            }
        }

        // --- 2. Full paper map (Aged ink look) ---
        const maxTileSize = 1000 / Math.max(mapW, mapH);
        this.maximizedCtx.fillStyle = '#e4dcc4'; // Aged Paper
        this.maximizedCtx.fillRect(0, 0, 1000, 1000);

        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const tile = data[y][x];
                if (tile === TILE_TYPES.VOID) continue;

                const color = MAXIMIZED_COLORS[tile];
                if (color) {
                    this.maximizedCtx.fillStyle = color;
                    this.maximizedCtx.fillRect(x * maxTileSize, y * maxTileSize, maxTileSize + 0.1, maxTileSize + 0.1);
                }
            }
        }

        // Draw grid lines on paper for that "drafted" look
        this.maximizedCtx.strokeStyle = 'rgba(51, 43, 30, 0.05)';
        this.maximizedCtx.lineWidth = 0.5;
        for (let i = 0; i <= 1000; i += 50) {
            this.maximizedCtx.beginPath();
            this.maximizedCtx.moveTo(i, 0); this.maximizedCtx.lineTo(i, 1000);
            this.maximizedCtx.stroke();
            this.maximizedCtx.beginPath();
            this.maximizedCtx.moveTo(0, i); this.maximizedCtx.lineTo(1000, i);
            this.maximizedCtx.stroke();
        }
    }

    public toggleMaximized() {
        this.isMaximized = !this.isMaximized;
        if (!this.isMaximized) this.zoomIndex = 0; // Reset zoom when closing
    }

    public getMaximized(): boolean {
        return this.isMaximized;
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, playerX: number, playerY: number, camera: Camera, npcs: any[]) {
        if (this.isMaximized) {
            this.handleInteraction(screenW, screenH);
            this.renderMaximized(ctx, screenW, screenH, playerX, playerY, npcs);
        } else {
            this.renderMinimap(ctx, screenW, screenH, playerX, playerY, camera, npcs);
        }
    }

    private handleInteraction(screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        // The button is placed at the top right of the paper map
        const paperSize = Math.min(screenW - s(40), screenH - s(120), s(950));
        const px = (screenW - paperSize) / 2;
        const py = (screenH - paperSize) / 2;

        this.zoomButtonRect = {
            x: px + paperSize - s(70),
            y: py + s(10),
            w: s(60),
            h: s(60)
        };

        const input = InputManager.getInstance();

        if (input.wasPressed('MouseLeft')) {
            const pos = input.getMousePos();
            if (pos.x >= this.zoomButtonRect.x && pos.x <= this.zoomButtonRect.x + this.zoomButtonRect.w &&
                pos.y >= this.zoomButtonRect.y && pos.y <= this.zoomButtonRect.y + this.zoomButtonRect.h) {
                this.zoomIndex = (this.zoomIndex + 1) % this.zoomLevels.length;
            }
        }

        if (input.wasPressed('KeyZ')) {
            this.zoomIndex = (this.zoomIndex + 1) % this.zoomLevels.length;
        }
    }

    private renderMinimap(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, playerX: number, playerY: number, _camera: Camera, npcs: any[]) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const mmSize = mobile ? s(200) : s(MINIMAP_BASE_SIZE);
        const mmPad = mobile ? s(10) : s(MINIMAP_BASE_PADDING);

        const mmX = screenW - mmSize - mmPad;
        const mmY = mobile ? mmPad : screenH - mmSize - mmPad;

        // Background with border
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(mmX - s(3), mmY - s(3), mmSize + s(6), mmSize + s(6));
        ctx.strokeStyle = '#4a4a55';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX - s(3), mmY - s(3), mmSize + s(6), mmSize + s(6));

        // Draw pre-rendered map
        ctx.drawImage(this.minimapCanvas, 0, 0, MINIMAP_BASE_SIZE, MINIMAP_BASE_SIZE, mmX, mmY, mmSize, mmSize);

        const tileSize = mmSize / MAP_WIDTH;
        const blipSize = Math.max(s(2), 2);

        // Draw NPCs
        if (npcs) {
            for (const npc of npcs) {
                if (npc.type !== 'gambler') continue;
                const nx = mmX + npc.x * tileSize;
                const ny = mmY + npc.y * tileSize;
                this.drawNpcBlip(ctx, nx, ny, npc.minigameType, blipSize);
            }
        }

        // Player blip
        const blipX = mmX + playerX * tileSize;
        const blipY = mmY + playerY * tileSize;
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
        ctx.fillText('SANTA CRUZ (M)', mmX + mmSize / 2, mmY - s(6));
    }

    private renderMaximized(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, playerX: number, playerY: number, npcs: any[]) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Background Overlay
        ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
        ctx.fillRect(0, 0, screenW, screenH);

        // Paper Dimensions (Increased size)
        const paperSize = Math.min(screenW - s(40), screenH - s(120), s(950));
        const px = (screenW - paperSize) / 2;
        const py = (screenH - paperSize) / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(px + s(10), py + s(10), paperSize, paperSize);

        // Border / Outer Paper
        ctx.fillStyle = '#332b1e';
        ctx.fillRect(px - s(2), py - s(2), paperSize + s(4), paperSize + s(4));

        // --- ZOOM CALCULATIONS ---
        const zoom = this.zoomLevels[this.zoomIndex];
        const tileSize = (paperSize / MAP_WIDTH) * zoom;

        // Offset to keep player centered when zooming
        let offsetX = px - (playerX * tileSize) + (paperSize / 2);
        let offsetY = py - (playerY * tileSize) + (paperSize / 2);

        // Clamp offsets so we don't show outside the map if possible
        const minX = px + paperSize - (1000 * (paperSize / 1000) * zoom);
        const minY = py + paperSize - (1000 * (paperSize / 1000) * zoom);

        if (zoom > 1.0) {
            offsetX = Math.min(px, Math.max(offsetX, minX));
            offsetY = Math.min(py, Math.max(offsetY, minY));
        } else {
            offsetX = px;
            offsetY = py;
        }

        // Draw Paper Map with Zoom
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, paperSize, paperSize);
        ctx.clip();

        ctx.translate(offsetX, offsetY);
        ctx.scale((paperSize / 1000) * zoom, (paperSize / 1000) * zoom);
        ctx.drawImage(this.maximizedCanvas, 0, 0);
        ctx.restore();

        // --- DRAW STREET NAMES & LABELS (Inside paper, matching zoom) ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, paperSize, paperSize);
        ctx.clip();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Neighbors / Areas
        AREA_LABELS.forEach(label => {
            const lx = offsetX + label.x * tileSize;
            const ly = offsetY + label.y * tileSize;

            if (lx < px - s(100) || lx > px + paperSize + s(100) || ly < py - s(100) || ly > py + paperSize + s(100)) return;

            ctx.shadowColor = 'rgba(228, 220, 196, 0.9)';
            ctx.shadowBlur = s(6);
            ctx.fillStyle = '#1a1a1a';
            ctx.font = `bold ${r(label.type === 'shopping' ? 14 : 11)}px serif`;

            const lines = label.name.split('\n');
            lines.forEach((line, i) => {
                ctx.fillText(line, lx, ly + (i - (lines.length - 1) / 2) * r(15));
            });
            ctx.shadowBlur = 0;
        });

        // Priority rendering: Streets first, then Bars (with overlap check)
        const drawnRects: { x1: number, y1: number, x2: number, y2: number }[] = [];
        const sortedSigns = [...STREET_SIGNS].sort((a, b) => {
            if (a.type === 'street' && b.type !== 'street') return -1;
            if (a.type !== 'street' && b.type === 'street') return 1;
            return 0;
        });

        if (zoom > 1.1) {
            sortedSigns.forEach(sign => {
                const sx = offsetX + sign.x * tileSize;
                const sy = offsetY + sign.y * tileSize;

                if (sx < px - s(50) || sx > px + paperSize + s(50) || sy < py - s(50) || sy > py + paperSize + s(50)) return;

                const isBar = sign.type === 'bar';
                const fontSize = isBar ? r(12) : r(15);
                ctx.font = `bold ${isBar ? '' : 'italic'} ${fontSize}px serif`;

                // Estimate dimensions for overlap check
                const metrics = ctx.measureText(sign.name);
                const textW = metrics.width;
                const textH = fontSize;
                const pad = s(5);
                const rect = {
                    x1: sx - textW / 2 - pad,
                    y1: sy - textH / 2 - pad,
                    x2: sx + textW / 2 + pad,
                    y2: sy + textH / 2 + pad
                };

                // Overlap Check (Only bars check against streets)
                if (isBar) {
                    const overlaps = drawnRects.some(r =>
                        rect.x1 < r.x2 && rect.x2 > r.x1 &&
                        rect.y1 < r.y2 && rect.y2 > r.y1
                    );
                    if (overlaps) return; // Skip drawing this bar label
                }

                ctx.save();
                if (isBar) {
                    // Bar Style: White with Black Outline
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = s(3);
                    ctx.lineJoin = 'round';
                    ctx.strokeText(sign.name, sx, sy);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(sign.name, sx, sy);
                } else {
                    // Street Style: Aged Ink
                    ctx.shadowColor = 'rgba(228, 220, 196, 0.8)';
                    ctx.shadowBlur = s(4);
                    ctx.fillStyle = '#332b1e';

                    if (sign.direction === 'h') {
                        ctx.fillText(sign.name, sx, sy);
                    } else {
                        ctx.save();
                        ctx.translate(sx, sy);
                        ctx.rotate(-Math.PI / 2);
                        ctx.fillText(sign.name, 0, 0);
                        ctx.restore();
                    }
                }
                ctx.restore();

                // Only register rects for Streets to prevent bars from covering them
                if (!isBar) drawnRects.push(rect);
            });
        }

        // NPCs / Gamblers
        if (npcs) {
            const blipSize = Math.max(s(4), 4) * (zoom > 1.5 ? 1.5 : 1);
            for (const npc of npcs) {
                if (npc.type !== 'gambler') continue;
                const nx = offsetX + npc.x * tileSize;
                const ny = offsetY + npc.y * tileSize;
                if (nx < px || nx > px + paperSize || ny < py || ny > py + paperSize) continue;
                this.drawNpcBlip(ctx, nx, ny, npc.minigameType, blipSize);
            }
        }

        // Player Position
        const blipX = offsetX + playerX * tileSize;
        const blipY = offsetY + playerY * tileSize;
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 1.25;

        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.arc(blipX, blipY, s(6) * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(blipX, blipY, s(3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- GLASS ZOOM BUTTON ---
        this.drawZoomButton(ctx, s);

        // Legend
        this.renderLegend(ctx, px, py + paperSize + s(15), paperSize);

        // Instructions
        ctx.fillStyle = '#e4dcc4';
        ctx.font = `bold ${r(14)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText("[ 'M' - VOLTAR  |  'Z' - ZOOM ]", screenW / 2, py - s(20));
    }

    private drawZoomButton(ctx: CanvasRenderingContext2D, s: (v: number) => number) {
        const { x, y, w, h } = this.zoomButtonRect;
        const r = s(12);

        ctx.save();
        // Glass Morphism Back
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = s(1.5);

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
        ctx.stroke();

        // Highlight shine
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        grad.addColorStop(0.5, 'transparent');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Magnifying glass icon
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = s(3);
        const centerX = x + w / 2 - s(3);
        const centerY = y + h / 2 - s(3);
        const radius = s(10);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.moveTo(centerX + radius * 0.7, centerY + radius * 0.7);
        ctx.lineTo(centerX + s(18), centerY + s(18));
        ctx.stroke();

        // Zoom level indicator (small text)
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${s(12)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`${this.zoomLevels[this.zoomIndex]}x`, x + w - s(8), y + h - s(8));
        ctx.restore();
    }

    private drawNpcBlip(ctx: CanvasRenderingContext2D, x: number, y: number, gameType: string, size: number) {
        switch (gameType) {
            case 'dice': ctx.fillStyle = '#3333ff'; break;
            case 'ronda': ctx.fillStyle = '#33ff33'; break;
            case 'purrinha': ctx.fillStyle = '#ffff33'; break;
            case 'heads_tails': ctx.fillStyle = '#ff9933'; break;
            case 'palitinho': ctx.fillStyle = '#ff66cc'; break;
            case 'fan_tan': ctx.fillStyle = '#dc143c'; break;
            default: ctx.fillStyle = '#ffffff'; break;
        }
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    private renderLegend(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
        const r = UIScale.r.bind(UIScale);
        const s = UIScale.s.bind(UIScale);

        const games = [
            { name: 'Dados', color: '#3333ff' },
            { name: 'Ronda', color: '#33ff33' },
            { name: 'Purrinha', color: '#ffff33' },
            { name: 'Cara ou Coroa', color: '#ff9933' },
            { name: 'Palitinho', color: '#ff66cc' },
            { name: 'Fan Tan', color: '#dc143c' }
        ];

        const itemW = width / games.length;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `${r(11)}px monospace`;

        games.forEach((g, i) => {
            const gx = x + i * itemW;
            ctx.fillStyle = g.color;
            ctx.fillRect(gx, y, s(8), s(8));
            ctx.fillStyle = '#e4dcc4';
            ctx.fillText(g.name, gx + s(12), y + s(4));
        });
    }
}

