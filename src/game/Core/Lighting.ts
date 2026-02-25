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
    flickerSpeed?: number;
    flickerOffset?: number;
    type?: CityLightType;
}

/** Light profile per category */
const LIGHT_PROFILES: Record<CityLightType, { radius: number; color: string; intensity: number; flicker: boolean; radiusVariance: number }> = {
    street: { radius: 280, color: '#ffbb44', intensity: 0.92, flicker: true, radiusVariance: 0 },
    streetglow: { radius: 260, color: '#ffaa33', intensity: 0.82, flicker: false, radiusVariance: 0 },
    residential: { radius: 90, color: '#ffcc66', intensity: 0.65, flicker: true, radiusVariance: 20 },
    plaza: { radius: 360, color: '#fff0d0', intensity: 0.98, flicker: false, radiusVariance: 0 },
    shopping: { radius: 380, color: '#ddeeff', intensity: 0.99, flicker: false, radiusVariance: 0 },
    alley: { radius: 110, color: '#ff9933', intensity: 0.60, flicker: true, radiusVariance: 15 },
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
    private ambientDarkness: number = 0.50; // Deeper night atmosphere
    private ambientColor: string = 'rgba(0, 0, 0, 1)';

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

            this.addLight({
                worldX: cl.x,
                worldY: cl.y,
                radius: profile.radius + variance,
                color: profile.color,
                intensity: profile.intensity,
                flicker: profile.flicker,
                type: cl.type
            });
        }
    }

    /** Add a dynamic light (e.g., player lantern) */
    public addLight(light: LightSource) {
        if (light.flicker && light.flickerSpeed === undefined) {
            light.flickerSpeed = 0.5 + Math.random() * 2;
            light.flickerOffset = Math.random() * Math.PI * 2;
        }
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
        // Create lightmap with ambient tint
        ctx.fillStyle = this.ambientColor;
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0, 0, 0, ${this.ambientDarkness})`;
        ctx.fillRect(0, 0, screenW, screenH);
        ctx.globalAlpha = 1;

        // Punch holes for each light using "destination-out"
        ctx.globalCompositeOperation = 'destination-out';

        for (const light of this.lights) {
            const { sx, sy } = camera.worldToScreen(light.worldX, light.worldY);
            const z = camera.zoom;

            // Stable radius for realism (no erratic moving shadows)
            const radius = light.radius * z;
            const intensity = light.intensity;

            // Per-light unique intensity flicker (adds life without annoying movement)
            let flicker = 1.0;
            if (light.flicker) {
                flicker = 0.95 + Math.sin(Date.now() / 150 * (light.flickerSpeed || 1) + (light.flickerOffset || 0)) * 0.05;
            }

            const effectiveIntensity = intensity * flicker;

            // Skip lights way off-screen for performance
            if (sx < -radius || sx > screenW + radius || sy < -radius || sy > screenH + radius) continue;

            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${effectiveIntensity})`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${effectiveIntensity * 0.4})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = grad;
            ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

            // Volumetric cone for street/plaza and alley lamps
            if (light.type === 'street' || light.type === 'plaza' || light.type === 'alley') {
                this.renderLightCone(ctx, sx, sy, radius, light.color, effectiveIntensity * (light.type === 'plaza' ? 0.35 : 0.2));
            }
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
    private renderLightCone(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.save();
        ctx.translate(x, y - radius * 0.1);

        const coneWidth = radius * 0.6;
        const coneHeight = radius * 1.5;

        const grad = ctx.createLinearGradient(0, 0, 0, coneHeight);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(0.3, `${color}22`); // Subtle color tint
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-coneWidth * 0.1, 0);
        ctx.lineTo(coneWidth * 0.1, 0);
        ctx.lineTo(coneWidth, coneHeight);
        ctx.lineTo(-coneWidth, coneHeight);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    public renderGroundGlow(mainCtx: CanvasRenderingContext2D, camera: Camera) {
        for (const light of this.lights) {
            const { sx, sy } = camera.worldToScreen(light.worldX, light.worldY);
            const z = camera.zoom;

            let flicker = 1.0;
            if (light.flicker) {
                flicker = 0.98 + Math.sin(Date.now() / 150 * (light.flickerSpeed || 1) + (light.flickerOffset || 0)) * 0.02;
            }

            let radius = (light.radius * 0.6) * z * flicker;

            // Warm ground glow with layered intensity
            const gradient = mainCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            const color = light.color || '#ffaa46';
            gradient.addColorStop(0, `${color}55`);
            gradient.addColorStop(0.3, `${color}22`);
            gradient.addColorStop(0.7, `${color}08`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

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
