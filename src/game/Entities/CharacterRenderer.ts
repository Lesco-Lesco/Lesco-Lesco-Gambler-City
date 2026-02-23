/**
 * CharacterRenderer — Shared pixel-art character drawing logic.
 * Used by both Player and NPC to render body, legs, head, and accessories.
 */

import type { Camera } from '../Core/Camera';

export interface CharacterAppearance {
    bodyColor: string;
    legColor: string;
    skinColor: string;
    hairColor?: string;
    hatColor?: string;
    hasHat: boolean;
}

export interface CharacterAnimState {
    isMoving: boolean;
    isRunning: boolean;
    animFrame: number;
    direction: 'down' | 'up' | 'left' | 'right';
}

/**
 * Draw a pixel-art character at the given world position.
 * Handles shadow, legs, body, head, hair/hat, eyes, and running dust.
 */
export function drawCharacter(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    worldX: number,
    worldY: number,
    appearance: CharacterAppearance,
    anim: CharacterAnimState
): void {
    const { sx, sy } = camera.worldToScreen(worldX, worldY);
    const z = camera.zoom;

    const legOffset = anim.isMoving ? Math.sin(anim.animFrame * Math.PI / 2) * 2 * z : 0;
    const bodyBob = anim.isMoving ? Math.abs(Math.sin(anim.animFrame * Math.PI / 2)) * 1 * z : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = appearance.legColor;
    ctx.fillRect(sx - 3 * z, sy - 8 * z - bodyBob, 2.5 * z, 8 * z + legOffset);
    ctx.fillRect(sx + 0.5 * z, sy - 8 * z - bodyBob, 2.5 * z, 8 * z - legOffset);

    // Body
    ctx.fillStyle = appearance.bodyColor;
    ctx.fillRect(sx - 4 * z, sy - 18 * z - bodyBob, 8 * z, 10 * z);

    // Head
    ctx.fillStyle = appearance.skinColor;
    ctx.fillRect(sx - 3 * z, sy - 23 * z - bodyBob, 6 * z, 5 * z);

    // Hair or Hat
    if (appearance.hasHat && appearance.hatColor) {
        ctx.fillStyle = appearance.hatColor;
        ctx.fillRect(sx - 3.5 * z, sy - 24 * z - bodyBob, 7 * z, 2.5 * z);
    } else if (appearance.hairColor) {
        ctx.fillStyle = appearance.hairColor;
        ctx.fillRect(sx - 3.5 * z, sy - 24 * z - bodyBob, 7 * z, 2 * z);
    }

    // Eyes (only when player or when facing down/sideways)
    ctx.fillStyle = '#ffffff';
    const eyeY = sy - 21 * z - bodyBob;
    if (anim.direction === 'down' || anim.direction === 'left') {
        ctx.fillRect(sx - 2 * z, eyeY, 1.5 * z, 1.5 * z);
    }
    if (anim.direction === 'down' || anim.direction === 'right') {
        ctx.fillRect(sx + 0.5 * z, eyeY, 1.5 * z, 1.5 * z);
    }

    // Running Dust
    if (anim.isRunning && anim.isMoving) {
        ctx.fillStyle = 'rgba(150, 130, 100, 0.4)';
        for (let i = 0; i < 3; i++) {
            const dustX = sx + (Math.random() - 0.5) * 8 * z;
            const dustY = sy + Math.random() * 3 * z;
            ctx.fillRect(dustX, dustY, 2 * z, 2 * z);
        }
    }
}
