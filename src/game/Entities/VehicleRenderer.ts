
import { Camera } from '../Core/Camera';
import { Vehicle } from './Vehicle';
import type { VehicleAppearance } from './Vehicle';

export function drawVehicle(ctx: CanvasRenderingContext2D, camera: Camera, vehicle: Vehicle) {
    const { sx, sy } = camera.worldToScreen(vehicle.x, vehicle.y);
    const z = camera.zoom;
    const { model, color, isEmergency } = vehicle.appearance;
    const direction = vehicle.direction;
    const state = vehicle.state;

    const w = vehicle.width * z * 20;
    const h = vehicle.height * z * 20;

    ctx.save();
    ctx.translate(sx, sy);

    // 1. Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, h / 2 - 2, w / 1.8, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Body
    const bodyColor = state === 'abandoned' ? '#5d4037' : color;
    ctx.fillStyle = bodyColor;

    // Draw vehicle base
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4 * z);
    ctx.fill();

    // 3. Details
    ctx.fillStyle = 'rgba(20, 30, 40, 0.9)';
    if (direction === 'up') {
        ctx.fillRect(-w / 2 + 2 * z, -h / 2 + 4 * z, w - 4 * z, h / 4);
    } else if (direction === 'down') {
        ctx.fillRect(-w / 2 + 2 * z, h / 2 - h / 4 - 4 * z, w - 4 * z, h / 4);
    } else if (direction === 'left') {
        ctx.fillRect(-w / 2 + 4 * z, -h / 2 + 2 * z, w / 4, h - 4 * z);
    } else if (direction === 'right') {
        ctx.fillRect(w / 2 - w / 4 - 4 * z, -h / 2 + 2 * z, w / 4, h - 4 * z);
    }

    // 4. Emergency Lights
    if (isEmergency && state === 'moving') {
        const time = Date.now() / 1000;
        const flash = Math.sin(time * 10) > 0;
        ctx.fillStyle = flash ? '#ff0000' : '#0000ff';
        const lightSize = 4 * z;
        ctx.beginPath();
        ctx.arc(0, 0, lightSize, 0, Math.PI * 2);
        ctx.fill();

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, lightSize * 4);
        grad.addColorStop(0, flash ? 'rgba(255,0,0,0.4)' : 'rgba(0,0,0,0.4)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, lightSize * 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // 5. Headlights
    if (state === 'moving' || (state === 'parked' && Math.random() > 0.99)) {
        if (direction === 'up') {
            drawLightBeam(ctx, -w / 2 + 2 * z, -h / 2, 'up', z);
            drawLightBeam(ctx, w / 2 - 2 * z, -h / 2, 'up', z);
        } else if (direction === 'down') {
            drawLightBeam(ctx, -w / 2 + 2 * z, h / 2, 'down', z);
            drawLightBeam(ctx, w / 2 - 2 * z, h / 2, 'down', z);
        } else if (direction === 'left') {
            drawLightBeam(ctx, -w / 2, -h / 2 + 2 * z, 'left', z);
            drawLightBeam(ctx, -w / 2, h / 2 - 2 * z, 'left', z);
        } else if (direction === 'right') {
            drawLightBeam(ctx, w / 2, -h / 2 + 2 * z, 'right', z);
            drawLightBeam(ctx, w / 2, h / 2 - 2 * z, 'right', z);
        }
    }

    // 6. Markings
    if (model === 'ambulance') {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1 * z;
        ctx.strokeRect(-w / 2 + 1, -h / 4, w - 2, 2 * z);
    } else if (model === 'police') {
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(5 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('POLICIA', 0, 4 * z);
    }

    ctx.restore();
}

function drawLightBeam(ctx: CanvasRenderingContext2D, x: number, y: number, dir: string, z: number) {
    const beamLen = 40 * z;
    const beamWid = 20 * z;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, beamLen);
    grad.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (dir === 'up') {
        ctx.lineTo(x - beamWid / 2, y - beamLen);
        ctx.lineTo(x + beamWid / 2, y - beamLen);
    } else if (dir === 'down') {
        ctx.lineTo(x - beamWid / 2, y + beamLen);
        ctx.lineTo(x + beamWid / 2, y + beamLen);
    } else if (dir === 'left') {
        ctx.lineTo(x - beamLen, y - beamWid / 2);
        ctx.lineTo(x - beamLen, y + beamWid / 2);
    } else if (dir === 'right') {
        ctx.lineTo(x + beamLen, y - beamWid / 2);
        ctx.lineTo(x + beamLen, y + beamWid / 2);
    }
    ctx.fill();
}
