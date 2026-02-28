
import { Camera } from '../Core/Camera';
import { InputManager } from '../Core/InputManager';
import { findSafeSpawn } from '../World/MapData';
import { TileMap } from '../World/TileMap';
import { drawCharacter } from './CharacterRenderer';
import type { CharacterAppearance } from './CharacterRenderer';

const PLAYER_APPEARANCE: CharacterAppearance = {
    bodyColor: '#cc4466',   // Deep rose shirt
    legColor: '#2a2a44',    // Dark pants
    skinColor: '#eebb66',   // Skin / highlights
    hairColor: '#1a1a1a',
    hasHat: false,
};

export type PlayerDirection = 'down' | 'up' | 'left' | 'right';

export class Player {
    public x: number = 0;
    public y: number = 0;
    public width: number = 0.8;
    public height: number = 0.8;
    public speed: number = 3.5;
    public runSpeed: number = 6.0;
    public direction: PlayerDirection = 'down';
    public isMoving: boolean = false;
    public isRunning: boolean = false;

    private animTimer: number = 0;
    private animFrame: number = 0;
    private walkFrames: number = 4;
    private walkSpeed: number = 0.15;

    public stamina: number = 300;
    public maxStamina: number = 300;
    private staminaDrain: number = 20;
    private staminaRegen: number = 40;

    public nearbyInteraction: string | null = null;
    private input: InputManager;

    constructor() {
        this.input = InputManager.getInstance();
        this.respawn();
    }

    public respawn() {
        const spawn = findSafeSpawn();
        this.x = spawn.x;
        this.y = spawn.y;
        this.direction = 'down';
        this.isMoving = false;
        this.isRunning = false;
        this.stamina = this.maxStamina;
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

        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
        }

        this.isRunning = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        if (this.isRunning && this.stamina <= 0) this.isRunning = false;

        const currentSpeed = this.isRunning ? this.runSpeed : this.speed;

        if (this.isRunning && this.isMoving) {
            this.stamina -= this.staminaDrain * dt;
            if (this.stamina < 0) this.stamina = 0;
        } else {
            this.stamina += this.staminaRegen * dt;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }

        const nextX = this.x + dx * currentSpeed * dt;
        const nextY = this.y + dy * currentSpeed * dt;

        const padN = 0.05, padW = 0.05, padS = 0.45, padE = 0.45;

        const canWalk = (cx: number, cy: number) => {
            return tileMap.isWalkable(cx - padW, cy - padN) &&
                tileMap.isWalkable(cx + padE, cy - padN) &&
                tileMap.isWalkable(cx - padW, cy + padS) &&
                tileMap.isWalkable(cx + padE, cy + padS);
        };

        if (canWalk(nextX, this.y)) this.x = nextX;
        if (canWalk(this.x, nextY)) this.y = nextY;

        if (this.isMoving) {
            this.animTimer += dt;
            const frameSpeed = this.isRunning ? this.walkSpeed * 0.6 : this.walkSpeed;
            if (this.animTimer >= frameSpeed) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % this.walkFrames;
            }
        } else {
            this.animFrame = 0; this.animTimer = 0;
        }
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        drawCharacter(ctx, camera, this.x, this.y, PLAYER_APPEARANCE, {
            isMoving: this.isMoving,
            isRunning: this.isRunning,
            animFrame: this.animFrame,
            direction: this.direction,
        });
    }
}
