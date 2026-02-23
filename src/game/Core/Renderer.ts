/**
 * Isometric Renderer — handles canvas setup, isometric tile drawing,
 * and provides drawing primitives for the game.
 */

import { Camera, TILE_WIDTH, TILE_HEIGHT } from './Camera';

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public width: number;
    public height: number;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');
        this.ctx = context;
        this.width = canvas.width;
        this.height = canvas.height;

        // Pixel art: disable smoothing
        this.ctx.imageSmoothingEnabled = false;
    }

    public resize(width: number, height: number) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;
        // Re-apply after resize
        this.ctx.imageSmoothingEnabled = false;
    }

    public clear(color: string = '#0a0a12') {
        this.canvas.style.cursor = 'none';
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Draw an isometric diamond tile at world position (tileX, tileY).
     */
    public drawIsoTile(
        camera: Camera,
        tileX: number,
        tileY: number,
        fillColor: string,
        strokeColor?: string,
        height: number = 0
    ) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const hw = (TILE_WIDTH / 2) * camera.zoom;
        const hh = (TILE_HEIGHT / 2) * camera.zoom;
        const elevOffset = height * camera.zoom;

        // Cull tiles off screen
        if (sx + hw < 0 || sx - hw > this.width || sy + hh < -100 || sy - hh > this.height + 100) {
            return;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy - hh - elevOffset);         // top
        this.ctx.lineTo(sx + hw, sy - elevOffset);          // right
        this.ctx.lineTo(sx, sy + hh - elevOffset);          // bottom
        this.ctx.lineTo(sx - hw, sy - elevOffset);          // left
        this.ctx.closePath();

        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        if (strokeColor) {
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }
    }

    /**
     * Draw an isometric block (tile with visible sides for buildings).
     */
    public drawIsoBlock(
        camera: Camera,
        tileX: number,
        tileY: number,
        blockHeight: number,
        topColor: string,
        leftColor: string,
        rightColor: string,
        scale: number = 1.0 // New scale parameter
    ) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const hw = (TILE_WIDTH / 2) * camera.zoom * scale;
        const hh = (TILE_HEIGHT / 2) * camera.zoom * scale;
        const h = blockHeight * camera.zoom;

        // Cull
        if (sx + hw < 0 || sx - hw > this.width || sy + hh + h < -50 || sy - hh - h > this.height + 50) {
            return;
        }

        // Left face
        this.ctx.beginPath();
        this.ctx.moveTo(sx - hw, sy);
        this.ctx.lineTo(sx, sy + hh);
        this.ctx.lineTo(sx, sy + hh - h);
        this.ctx.lineTo(sx - hw, sy - h);
        this.ctx.closePath();
        this.ctx.fillStyle = leftColor;
        this.ctx.fill();

        // Right face
        this.ctx.beginPath();
        this.ctx.moveTo(sx + hw, sy);
        this.ctx.lineTo(sx, sy + hh);
        this.ctx.lineTo(sx, sy + hh - h);
        this.ctx.lineTo(sx + hw, sy - h);
        this.ctx.closePath();
        this.ctx.fillStyle = rightColor;
        this.ctx.fill();

        this.ctx.fillStyle = topColor;
        this.ctx.fill();
    }

    /**
     * Draw an isometric block with custom bounds (0..1 relative to tile).
     * Useful for connecting adjacent buildings.
     */
    public drawCustomIsoBlock(
        camera: Camera,
        tileX: number,
        tileY: number,
        blockHeight: number,
        topColor: string,
        leftColor: string,
        rightColor: string,
        minX: number = 0.2,
        maxX: number = 0.8,
        minY: number = 0.2,
        maxY: number = 0.8
    ) {
        const { sx, sy } = camera.worldToScreen(tileX, tileY);
        const z = camera.zoom;
        const h = blockHeight * z;

        // Tile Dimensions in screen space
        const tileW = TILE_WIDTH * z;
        const tileH = TILE_HEIGHT * z;

        // Convert 0..1 local coords to screen offsets relative to tile center (sx, sy)
        // 0.5 is center. 
        // x goes Down-Right (visual).
        // y goes Down-Left (visual).
        // Wait, worldToScreen logic:
        // sx = (worldX - worldY) * TILE_WIDTH / 2
        // sy = (worldX + worldY) * TILE_HEIGHT / 2
        // So offset X (world space) -> +sx, +sy
        // Offset Y (world space) -> -sx, +sy

        // We need 4 corners of the base rhombus based on minX...maxY
        // Local tile space: x from 0 to 1, y from 0 to 1.
        // Center is 0.5, 0.5.

        const localToScreen = (lx: number, ly: number) => {
            // lx, ly are 0..1 within the tile
            // shift to -0.5..0.5 relative to center
            const dx = lx - 0.5;
            const dy = ly - 0.5;

            // Apply projection
            const screenX = (dx - dy) * tileW / 2; // (dx * W/2) - (dy * W/2)
            const screenY = (dx + dy) * tileH / 2; // (dx * H/2) + (dy * H/2)

            return { x: sx + screenX, y: sy + screenY };
        };


        // Cart setup:
        // x axis (minX->maxX): Top-Left to Bottom-Right
        // y axis (minY->maxY): Top-Right to Bottom-Left
        // Wait.
        // (0,0) is Top corner of diamond.
        // (1,1) is Bottom corner.
        // (1,0) is Right corner.
        // (0,1) is Left corner.
        // Let's verify standard projection:
        // x=0, y=0 -> 0,0 (Top)
        // x=1, y=0 -> W/2, H/2 (Right)
        // x=0, y=1 -> -W/2, H/2 (Left)
        // x=1, y=1 -> 0, H (Bottom)

        // So:
        // Top Vertex: minX, minY
        // Right Vertex: maxX, minY
        // Bottom Vertex: maxX, maxY
        // Left Vertex: minX, maxY

        const vTop = localToScreen(minX, minY);
        const vRight = localToScreen(maxX, minY);
        const vBottom = localToScreen(maxX, maxY);
        const vLeft = localToScreen(minX, maxY);

        // Cull check (lax)
        if (vTop.x < -100 || vTop.x > this.width + 100 || vTop.y + h < -100 || vTop.y - h > this.height + 100) return;

        // Left Face (Left edge to Bottom edge?)
        // Render order: Left Face, Right Face, Top Face.
        // Left face: vLeft -> vBottom -> vBottom-h -> vLeft-h
        this.ctx.beginPath();
        this.ctx.moveTo(vLeft.x, vLeft.y);
        this.ctx.lineTo(vBottom.x, vBottom.y);
        this.ctx.lineTo(vBottom.x, vBottom.y - h);
        this.ctx.lineTo(vLeft.x, vLeft.y - h);
        this.ctx.closePath();
        this.ctx.fillStyle = leftColor;
        this.ctx.fill();

        // Right Face (Bottom edge to Right edge?)
        // Actually, in standard:
        // Left Face is the SW side?
        // Right Face is the SE side?
        // Let's re-read standard drawIsoBlock:
        // Left Face: sx-hw to sx (Left point to Bottom Point)
        // Right Face: sx+hw to sx (Right point to Bottom Point)

        // My vLeft is (minX, maxY) -> (0, 1) -> Left point.
        // My vBottom is (maxX, maxY) -> (1, 1) -> Bottom point.
        // So Left Face is vLeft -> vBottom. Correct.

        // My vRight is (maxX, minY) -> (1, 0) -> Right point.
        // Right Face is vBottom -> vRight.
        this.ctx.beginPath();
        this.ctx.moveTo(vBottom.x, vBottom.y);
        this.ctx.lineTo(vRight.x, vRight.y);
        this.ctx.lineTo(vRight.x, vRight.y - h);
        this.ctx.lineTo(vBottom.x, vBottom.y - h);
        this.ctx.closePath();
        this.ctx.fillStyle = rightColor;
        this.ctx.fill();

        // Top Face
        this.ctx.beginPath();
        this.ctx.moveTo(vTop.x, vTop.y - h);
        this.ctx.lineTo(vRight.x, vRight.y - h);
        this.ctx.lineTo(vBottom.x, vBottom.y - h);
        this.ctx.lineTo(vLeft.x, vLeft.y - h);
        this.ctx.closePath();
        this.ctx.fillStyle = topColor;
        this.ctx.fill();

    }

    /**
     * Draw a pixel-art sprite (simple colored rect) at iso world position.
     */
    public drawIsoSprite(
        camera: Camera,
        worldX: number,
        worldY: number,
        spriteWidth: number,
        spriteHeight: number,
        color: string,
        outlineColor?: string
    ) {
        const { sx, sy } = camera.worldToScreen(worldX, worldY);
        const w = spriteWidth * camera.zoom;
        const h = spriteHeight * camera.zoom;

        this.ctx.fillStyle = color;
        this.ctx.fillRect(sx - w / 2, sy - h, w, h);

        if (outlineColor) {
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(sx - w / 2, sy - h, w, h);
        }
    }

    /**
     * Draw text at a screen position
     */
    public drawText(
        text: string,
        x: number,
        y: number,
        color: string = 'white',
        fontSize: number = 12,
        align: CanvasTextAlign = 'left'
    ) {
        this.ctx.fillStyle = color;
        this.ctx.font = `${fontSize}px "Press Start 2P", monospace`;
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
    }

    /**
     * Draw a circle of light at a screen position (for lighting system)
     */
    public drawLight(x: number, y: number, radius: number, color: string, alpha: number) {
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        this.ctx.globalAlpha = 1;
    }
}
