/**
 * Isometric camera with smooth follow, zoom, and screen shake.
 * Isometric projection uses 2:1 ratio (classic pixel art iso).
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export class Camera {
    public x: number = 0;
    public y: number = 0;
    public zoom: number = 2.0;
    public targetZoom: number = 2.0;
    public screenWidth: number = 800;
    public screenHeight: number = 600;

    private followSpeed: number = 4.0;
    private shakeIntensity: number = 0;
    private shakeDuration: number = 0;
    private shakeTimer: number = 0;
    private shakeOffsetX: number = 0;
    private shakeOffsetY: number = 0;

    /** Convert world (tile grid) coords to isometric screen coords */
    public worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
        const isoX = (wx - wy) * (TILE_WIDTH / 2);
        const isoY = (wx + wy) * (TILE_HEIGHT / 2);

        const sx = (isoX - this.x) * this.zoom + this.screenWidth / 2 + this.shakeOffsetX;
        const sy = (isoY - this.y) * this.zoom + this.screenHeight / 2 + this.shakeOffsetY;

        return { sx, sy };
    }

    /** Convert screen pixel coords back to world (tile grid) coords */
    public screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
        const relX = (sx - this.screenWidth / 2 - this.shakeOffsetX) / this.zoom + this.x;
        const relY = (sy - this.screenHeight / 2 - this.shakeOffsetY) / this.zoom + this.y;

        const wx = (relX / (TILE_WIDTH / 2) + relY / (TILE_HEIGHT / 2)) / 2;
        const wy = (relY / (TILE_HEIGHT / 2) - relX / (TILE_WIDTH / 2)) / 2;

        return { wx, wy };
    }

    /** Smoothly follow a target world position */
    public follow(targetWX: number, targetWY: number, dt: number) {
        const targetIsoX = (targetWX - targetWY) * (TILE_WIDTH / 2);
        const targetIsoY = (targetWX + targetWY) * (TILE_HEIGHT / 2);

        const lerp = 1 - Math.exp(-this.followSpeed * dt);
        this.x += (targetIsoX - this.x) * lerp;
        this.y += (targetIsoY - this.y) * lerp;

        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * lerp;
    }

    public shake(intensity: number, duration: number) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    public update(dt: number) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const progress = this.shakeTimer / this.shakeDuration;
            const currentIntensity = this.shakeIntensity * progress;
            this.shakeOffsetX = (Math.random() - 0.5) * 2 * currentIntensity;
            this.shakeOffsetY = (Math.random() - 0.5) * 2 * currentIntensity;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    public resize(w: number, h: number) {
        this.screenWidth = w;
        this.screenHeight = h;
    }
}
