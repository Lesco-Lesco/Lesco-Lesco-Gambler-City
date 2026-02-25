/**
 * Game Loop with Scene management.
 * Supports switching between scenes (exploration, minigame, menu).
 */

import { InputManager } from './InputManager';

export interface Scene {
    name: string;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
    onEnter?(): void;
    onExit?(): void;
}

export class GameLoop {
    private running: boolean = false;
    private lastTime: number = 0;
    private ctx: CanvasRenderingContext2D;
    private scenes: Map<string, Scene> = new Map();
    private activeScene: Scene | null = null;
    private input: InputManager;

    // Performance
    private fps: number = 0;
    private frameCount: number = 0;
    private fpsTimer: number = 0;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.input = InputManager.getInstance();
    }

    public addScene(scene: Scene) {
        this.scenes.set(scene.name, scene);
    }

    public setScene(name: string) {
        if (this.activeScene?.onExit) {
            this.activeScene.onExit();
        }
        const scene = this.scenes.get(name);
        if (!scene) {
            console.error(`Scene "${name}" not found`);
            return;
        }
        this.activeScene = scene;
        if (scene.onEnter) {
            scene.onEnter();
        }
    }

    public getActiveScene(): Scene | null {
        return this.activeScene;
    }

    public getScene(name: string): Scene | undefined {
        return this.scenes.get(name);
    }

    public getFPS(): number {
        return this.fps;
    }

    public start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    public stop() {
        this.running = false;
    }

    private loop = (time: number) => {
        if (!this.running) return;

        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        // Clamp dt to avoid spiral of death
        if (dt > 0.1) dt = 0.1;

        // FPS counter
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1.0) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }

        // Update + Render active scene
        try {
            if (this.activeScene) {
                this.activeScene.update(dt);

                // Limpa o canvas e reseta estado antes de cada render
                // Previne acúmulo de transparency/compositeOperation entre frames e cenas
                this.ctx.globalAlpha = 1;
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

                this.activeScene.render(this.ctx);
            }
        } catch (e: any) {
            console.error("Game Loop Error:", e);
            this.running = false;
            // Blue Screen of Death
            this.ctx.fillStyle = '#000088';
            this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText("CRITICAL ERROR:", 20, 40);
            this.ctx.fillText(e.toString(), 20, 70);
            if (e.stack) {
                const lines = e.stack.split('\n');
                for (let i = 0; i < Math.min(lines.length, 20); i++) {
                    this.ctx.fillText(lines[i].trim(), 20, 100 + i * 20);
                }
            }
        }

        // Clear transient input state at end of frame
        this.input.endFrame();

        if (this.running) requestAnimationFrame(this.loop);
    };
}
