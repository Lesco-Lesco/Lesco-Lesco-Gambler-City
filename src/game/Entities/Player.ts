/**
 * Player entity — pixel art animated sprite with walk/run, collision, and wallet.
 */

import { Camera } from '../Core/Camera';
import { InputManager } from '../Core/InputManager';
import { findSafeSpawn } from '../World/MapData';
import { TileMap } from '../World/TileMap';

/** Sprite animation frames (procedural pixel art) */
interface SpriteFrame {
    body: string;
    legs: string;
    accent: string;
}

const SPRITE_PALETTE: SpriteFrame = {
    body: '#cc4466',   // Deep rose shirt
    legs: '#2a2a44',   // Dark pants
    accent: '#eebb66', // Skin / highlights
};

export type PlayerDirection = 'down' | 'up' | 'left' | 'right';

export class Player {
    // Initial position set in constructor
    public x: number = 0;
    public y: number = 0;
    public width: number = 0.4;
    public height: number = 0.4;
    public speed: number = 3.5;      // Tiles per second (walk)
    public runSpeed: number = 6.0;   // Tiles per second (run)
    public money: number = 50;       // Starting money
    public direction: PlayerDirection = 'down';
    public isMoving: boolean = false;
    public isRunning: boolean = false;

    // Animation
    private animTimer: number = 0;
    private animFrame: number = 0;
    private walkFrames: number = 4;
    private walkSpeed: number = 0.15; // seconds per frame

    // Stamina
    public stamina: number = 300;
    public maxStamina: number = 300;
    private staminaDrain: number = 20;
    private staminaRegen: number = 40;

    // Interaction
    public nearbyInteraction: string | null = null;

    private input: InputManager;

    constructor() {
        this.input = InputManager.getInstance();
        const spawn = findSafeSpawn();
        this.x = spawn.x;
        this.y = spawn.y;
    }

    public update(dt: number, tileMap: TileMap) {
        if (this.input.getContext() !== 'exploration') {
            this.isMoving = false;
            return;
        }

        let dx = 0;
        let dy = 0;

        if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) { dy -= 1; this.direction = 'up'; }
        if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) { dy += 1; this.direction = 'down'; }
        if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) { dx -= 1; this.direction = 'left'; }
        if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) { dx += 1; this.direction = 'right'; }

        this.isMoving = dx !== 0 || dy !== 0;

        // Normalize
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        // Running
        this.isRunning = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        if (this.isRunning && this.stamina <= 0) this.isRunning = false;

        const currentSpeed = this.isRunning ? this.runSpeed : this.speed;

        // Stamina
        if (this.isRunning && this.isMoving) {
            this.stamina -= this.staminaDrain * dt;
            if (this.stamina < 0) this.stamina = 0;
        } else {
            this.stamina += this.staminaRegen * dt;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }

        // Apply movement with AABB collision
        const nextX = this.x + dx * currentSpeed * dt;
        const nextY = this.y + dy * currentSpeed * dt;
        const halfW = 0.2;
        const halfH = 0.15;

        // Check each axis
        if (tileMap.isAreaWalkable(nextX, this.y, halfW, halfH)) {
            this.x = nextX;
        }
        if (tileMap.isAreaWalkable(this.x, nextY, halfW, halfH)) {
            this.y = nextY;
        }

        // Animation
        if (this.isMoving) {
            this.animTimer += dt;
            const frameSpeed = this.isRunning ? this.walkSpeed * 0.6 : this.walkSpeed;
            if (this.animTimer >= frameSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % this.walkFrames;
            }
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        const { sx, sy } = camera.worldToScreen(this.x, this.y);
        const z = camera.zoom;

        const legOffset = this.isMoving ? Math.sin(this.animFrame * Math.PI / 2) * 2 * z : 0;
        const bodyBob = this.isMoving ? Math.abs(Math.sin(this.animFrame * Math.PI / 2)) * 1 * z : 0;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6 * z, 3 * z, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.fillStyle = SPRITE_PALETTE.legs;
        ctx.fillRect(sx - 3 * z, sy - 8 * z - bodyBob, 2.5 * z, 8 * z + legOffset);
        ctx.fillRect(sx + 0.5 * z, sy - 8 * z - bodyBob, 2.5 * z, 8 * z - legOffset);

        // Body
        ctx.fillStyle = SPRITE_PALETTE.body;
        ctx.fillRect(sx - 4 * z, sy - 18 * z - bodyBob, 8 * z, 10 * z);

        // Head
        ctx.fillStyle = SPRITE_PALETTE.accent;
        ctx.fillRect(sx - 3 * z, sy - 23 * z - bodyBob, 6 * z, 5 * z);

        // Hair
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(sx - 3.5 * z, sy - 24 * z - bodyBob, 7 * z, 2 * z);

        // Eyes
        ctx.fillStyle = '#ffffff';
        const eyeY = sy - 21 * z - bodyBob;
        if (this.direction === 'down' || this.direction === 'left') {
            ctx.fillRect(sx - 2 * z, eyeY, 1.5 * z, 1.5 * z);
        }
        if (this.direction === 'down' || this.direction === 'right') {
            ctx.fillRect(sx + 0.5 * z, eyeY, 1.5 * z, 1.5 * z);
        }

        // Dust
        if (this.isRunning && this.isMoving) {
            ctx.fillStyle = 'rgba(150, 130, 100, 0.4)';
            for (let i = 0; i < 3; i++) {
                const dustX = sx + (Math.random() - 0.5) * 8 * z;
                const dustY = sy + Math.random() * 3 * z;
                ctx.fillRect(dustX, dustY, 2 * z, 2 * z);
            }
        }
    }
}
