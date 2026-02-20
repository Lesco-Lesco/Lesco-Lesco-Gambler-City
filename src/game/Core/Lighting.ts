/**
 * Dynamic lighting system — much lighter overlay with categorized city lights.
 * Residential: small warm flickers (house windows).
 * Plaza: bright white-ish public lighting.
 * Shopping: bright commercial lights.
 * Street: standard warm lampposts.
 * Alley: dim, sparse.
 * Also renders a sparse fog/mist layer.
 */

import { Camera } from './Camera';
import { CITY_LIGHTS } from '../World/MapData';
import type { CityLightType } from '../World/MapData';

export interface LightSource {
    worldX: number;
    worldY: number;
    radius: number;
    color: string;
    intensity: number;
    flicker?: boolean;
}

/** Light profile per category */
const LIGHT_PROFILES: Record<CityLightType, { radius: number; color: string; intensity: number; flicker: boolean; radiusVariance: number }> = {
    street: { radius: 140, color: '#ff9933', intensity: 0.7, flicker: true, radiusVariance: 0 },
    residential: { radius: 55, color: '#ffcc77', intensity: 0.35, flicker: true, radiusVariance: 20 },
    plaza: { radius: 170, color: '#ffeedd', intensity: 0.85, flicker: false, radiusVariance: 0 },
    shopping: { radius: 180, color: '#ddeeff', intensity: 0.9, flicker: false, radiusVariance: 0 },
    alley: { radius: 50, color: '#ff8844', intensity: 0.25, flicker: true, radiusVariance: 10 },
};

/** Simple seeded random for consistent per-light variance */
function seededRand(seed: number): number {
    const n = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

export class Lighting {
    private lightCanvas: HTMLCanvasElement;
    private lightCtx: CanvasRenderingContext2D;
    private lights: LightSource[] = [];
    private ambientDarkness: number = 0.45;
    private ambientColor: string = 'rgba(8, 8, 22, 1)';

    // Fog system
    private fogParticles: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    private fogInited: boolean = false;

    constructor() {
        this.lightCanvas = document.createElement('canvas');
        const ctx = this.lightCanvas.getContext('2d');
        if (!ctx) throw new Error('Light canvas context failed');
        this.lightCtx = ctx;

        // Build categorized lights from city data
        for (const cl of CITY_LIGHTS) {
            const profile = LIGHT_PROFILES[cl.type];
            const seed = cl.x * 1000 + cl.y;
            const variance = profile.radiusVariance > 0 ? (seededRand(seed) - 0.5) * 2 * profile.radiusVariance : 0;

            this.lights.push({
                worldX: cl.x,
                worldY: cl.y,
                radius: profile.radius + variance,
                color: profile.color,
                intensity: profile.intensity,
                flicker: profile.flicker,
            });
        }
    }

    /** Add a dynamic light (e.g., player lantern) */
    public addLight(light: LightSource) {
        this.lights.push(light);
    }

    public removeLight(light: LightSource) {
        const idx = this.lights.indexOf(light);
        if (idx >= 0) this.lights.splice(idx, 1);
    }

    public setAmbientDarkness(value: number) {
        this.ambientDarkness = Math.max(0, Math.min(1, value));
    }

    public resize(w: number, h: number) {
        this.lightCanvas.width = w;
        this.lightCanvas.height = h;
    }

    /** Initialize fog particles (lazy, once per resize) */
    private initFog(screenW: number, screenH: number) {
        this.fogParticles = [];
        // Sparse cloud-like patches — only ~12 wisps
        const count = 12;
        for (let i = 0; i < count; i++) {
            this.fogParticles.push({
                x: Math.random() * screenW * 2 - screenW * 0.5,
                y: Math.random() * screenH,
                size: 200 + Math.random() * 300,
                speed: 3 + Math.random() * 5,
                opacity: 0.015 + Math.random() * 0.025,
            });
        }
        this.fogInited = true;
    }

    /**
     * Render the lightmap overlay — MUCH lighter than before.
     * Soft blue-ish darkness with prominent light holes.
     */
    public render(mainCtx: CanvasRenderingContext2D, camera: Camera, screenW: number, screenH: number) {
        if (this.lightCanvas.width !== screenW || this.lightCanvas.height !== screenH) {
            this.resize(screenW, screenH);
        }

        const ctx = this.lightCtx;

        // Fill with ambient darkness (much lighter alpha now)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = this.ambientColor;
        ctx.globalAlpha = this.ambientDarkness;
        ctx.fillRect(0, 0, screenW, screenH);
        ctx.globalAlpha = 1;

        // Punch holes for each light using "destination-out"
        ctx.globalCompositeOperation = 'destination-out';

        for (const light of this.lights) {
            const { sx, sy } = camera.worldToScreen(light.worldX, light.worldY);
            let radius = light.radius * camera.zoom;
            let intensity = light.intensity;

            // Skip lights way off-screen for performance
            if (sx < -radius || sx > screenW + radius || sy < -radius || sy > screenH + radius) continue;

            // Flicker effect (subtle for residential, more for alleys)
            if (light.flicker) {
                const flickerAmount = Math.sin(Date.now() / 180 + light.worldX * 13 + light.worldY * 7) * 0.05;
                intensity += flickerAmount;
                radius += Math.sin(Date.now() / 250 + light.worldX * 5) * 2;
            }

            // Radial gradient for soft light falloff
            const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            gradient.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
            gradient.addColorStop(0.3, `rgba(0, 0, 0, ${intensity * 0.7})`);
            gradient.addColorStop(0.6, `rgba(0, 0, 0, ${intensity * 0.3})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        }

        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';

        // Composite the light overlay onto the main canvas
        mainCtx.globalCompositeOperation = 'source-over';
        mainCtx.drawImage(this.lightCanvas, 0, 0);
    }

    /**
     * Warm glow on the ground from lights (drawn BEFORE the lightmap).
     */
    public renderGroundGlow(mainCtx: CanvasRenderingContext2D, camera: Camera) {
        for (const light of this.lights) {
            const { sx, sy } = camera.worldToScreen(light.worldX, light.worldY);
            let radius = (light.radius * 0.35) * camera.zoom;

            if (light.flicker) {
                radius += Math.sin(Date.now() / 250 + light.worldX * 5) * 2;
            }

            // Warm ground glow matching the light color tone
            const gradient = mainCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            gradient.addColorStop(0, `rgba(255, 170, 70, 0.06)`);
            gradient.addColorStop(1, 'rgba(255, 170, 70, 0)');

            mainCtx.fillStyle = gradient;
            mainCtx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
        }
    }

    /**
     * Render sparse fog wisps that drift slowly across the screen.
     * Very subtle — just soft blurred cloud patches.
     */
    public renderFog(ctx: CanvasRenderingContext2D, screenW: number, screenH: number, dt: number) {
        if (!this.fogInited) this.initFog(screenW, screenH);

        ctx.save();
        for (const p of this.fogParticles) {
            // Drift slowly to the right
            p.x += p.speed * dt;
            // Wrap around
            if (p.x > screenW + p.size) {
                p.x = -p.size;
                p.y = Math.random() * screenH;
            }

            // Draw as a soft radial gradient blob
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            gradient.addColorStop(0, `rgba(180, 190, 210, ${p.opacity})`);
            gradient.addColorStop(0.5, `rgba(180, 190, 210, ${p.opacity * 0.4})`);
            gradient.addColorStop(1, 'rgba(180, 190, 210, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        }
        ctx.restore();
    }
}
