/**
 * Tank Attack — Top-down tank shooter in a maze.
 * Player controls a tank, shoots enemies approaching in waves.
 * 3 lives. Score per kill. Enemies get faster over time.
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';

interface Enemy {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
}

interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
}

interface Wall {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class TankAttackGame {
    private fieldW = 500;
    private fieldH = 400;

    // Player tank
    private tankX = 250;
    private tankY = 350;
    private tankDir: 'up' | 'down' | 'left' | 'right' = 'up';
    private tankSpeed = 120;
    private tankSize = 14;

    // Bullets
    private bullets: Bullet[] = [];
    private bulletSpeed = 300;
    private shootCooldown = 0;

    // Enemies
    private enemies: Enemy[] = [];
    private enemySpeed = 40;
    private spawnTimer = 0;
    private spawnInterval = 2.0;
    private waveCount = 0;

    // Walls (maze obstacles)
    private walls: Wall[] = [];

    // State
    public lives = 3;
    public score = 0;
    public phase: 'playing' | 'game_over' = 'playing';
    private invincibleTimer = 0;
    private gameOverPhrase: string = '';

    // Explosions
    private explosions: { x: number; y: number; timer: number }[] = [];

    constructor() {
        this.generateMaze();
    }

    private generateMaze() {
        this.walls = [];
        // Simple obstacle layout
        const w = 40, h = 12;
        // Horizontal walls
        this.walls.push({ x: 80, y: 100, w, h });
        this.walls.push({ x: 200, y: 80, w, h });
        this.walls.push({ x: 350, y: 120, w, h });
        this.walls.push({ x: 100, y: 200, w, h });
        this.walls.push({ x: 280, y: 200, w, h });
        this.walls.push({ x: 180, y: 280, w, h });
        this.walls.push({ x: 380, y: 280, w, h });
        this.walls.push({ x: 50, y: 300, w, h });
        // Vertical walls
        this.walls.push({ x: 150, y: 50, w: h, h: w });
        this.walls.push({ x: 300, y: 150, w: h, h: w });
        this.walls.push({ x: 420, y: 50, w: h, h: w });
        this.walls.push({ x: 60, y: 150, w: h, h: w });
        this.walls.push({ x: 350, y: 220, w: h, h: w });
    }

    private spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x = 0, y = 0, vx = 0, vy = 0;
        const speed = this.enemySpeed + this.waveCount * 3;

        switch (side) {
            case 0: // top
                x = 20 + Math.random() * (this.fieldW - 40);
                y = -10;
                vx = (Math.random() - 0.5) * speed * 0.3;
                vy = speed;
                break;
            case 1: // bottom
                x = 20 + Math.random() * (this.fieldW - 40);
                y = this.fieldH + 10;
                vx = (Math.random() - 0.5) * speed * 0.3;
                vy = -speed;
                break;
            case 2: // left
                x = -10;
                y = 20 + Math.random() * (this.fieldH - 40);
                vx = speed;
                vy = (Math.random() - 0.5) * speed * 0.3;
                break;
            case 3: // right
                x = this.fieldW + 10;
                y = 20 + Math.random() * (this.fieldH - 40);
                vx = -speed;
                vy = (Math.random() - 0.5) * speed * 0.3;
                break;
        }

        // Track towards player loosely
        const dx = this.tankX - x;
        const dy = this.tankY - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        vx = (dx / dist) * speed * (0.6 + Math.random() * 0.4);
        vy = (dy / dist) * speed * (0.6 + Math.random() * 0.4);

        this.enemies.push({ x, y, vx, vy, alive: true });
        this.waveCount++;
    }

    private collidesWall(x: number, y: number, r: number): boolean {
        for (const wall of this.walls) {
            if (x + r > wall.x && x - r < wall.x + wall.w &&
                y + r > wall.y && y - r < wall.y + wall.h) {
                return true;
            }
        }
        return false;
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();

        // Movement
        let moved = false;
        let newX = this.tankX;
        let newY = this.tankY;

        if (input.isDown('ArrowUp')) { newY -= this.tankSpeed * dt; this.tankDir = 'up'; moved = true; }
        if (input.isDown('ArrowDown')) { newY += this.tankSpeed * dt; this.tankDir = 'down'; moved = true; }
        if (input.isDown('ArrowLeft')) { newX -= this.tankSpeed * dt; this.tankDir = 'left'; moved = true; }
        if (input.isDown('ArrowRight')) { newX += this.tankSpeed * dt; this.tankDir = 'right'; moved = true; }

        // Clamp to field
        newX = Math.max(this.tankSize, Math.min(this.fieldW - this.tankSize, newX));
        newY = Math.max(this.tankSize, Math.min(this.fieldH - this.tankSize, newY));

        // Wall collision
        if (!this.collidesWall(newX, newY, this.tankSize * 0.6)) {
            this.tankX = newX;
            this.tankY = newY;
        }

        // Shoot
        this.shootCooldown -= dt;
        if (input.isDown('Space') && this.shootCooldown <= 0) {
            let bvx = 0, bvy = 0;
            switch (this.tankDir) {
                case 'up': bvy = -this.bulletSpeed; break;
                case 'down': bvy = this.bulletSpeed; break;
                case 'left': bvx = -this.bulletSpeed; break;
                case 'right': bvx = this.bulletSpeed; break;
            }
            this.bullets.push({ x: this.tankX, y: this.tankY, vx: bvx, vy: bvy, alive: true });
            this.shootCooldown = 0.2;
        }

        // Spawn enemies
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            const count = 1 + Math.floor(this.waveCount / 8);
            for (let i = 0; i < count; i++) this.spawnEnemy();
            this.spawnInterval = Math.max(0.5, this.spawnInterval - 0.05);
            this.spawnTimer = this.spawnInterval;
        }

        // Update bullets
        for (const b of this.bullets) {
            if (!b.alive) continue;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.x < -10 || b.x > this.fieldW + 10 || b.y < -10 || b.y > this.fieldH + 10) {
                b.alive = false;
            }
            // Wall collision
            if (this.collidesWall(b.x, b.y, 2)) {
                b.alive = false;
            }
        }

        // Update enemies
        for (const e of this.enemies) {
            if (!e.alive) continue;
            e.x += e.vx * dt;
            e.y += e.vy * dt;

            // Simple re-tracking towards player
            const dx = this.tankX - e.x;
            const dy = this.tankY - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
            e.vx += (dx / dist) * 15 * dt;
            e.vy += (dy / dist) * 15 * dt;
            // Normalize
            const newSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy) || 1;
            e.vx = (e.vx / newSpeed) * speed;
            e.vy = (e.vy / newSpeed) * speed;

            // Bullet-enemy collision
            for (const b of this.bullets) {
                if (!b.alive) continue;
                const bdx = b.x - e.x;
                const bdy = b.y - e.y;
                if (bdx * bdx + bdy * bdy < 15 * 15) {
                    e.alive = false;
                    b.alive = false;
                    this.score += 50;
                    this.explosions.push({ x: e.x, y: e.y, timer: 0.4 });
                }
            }

            // Enemy-player collision
            if (this.invincibleTimer <= 0) {
                const pdx = this.tankX - e.x;
                const pdy = this.tankY - e.y;
                if (pdx * pdx + pdy * pdy < (this.tankSize + 8) * (this.tankSize + 8)) {
                    e.alive = false;
                    this.lives--;
                    this.explosions.push({ x: this.tankX, y: this.tankY, timer: 0.5 });
                    this.invincibleTimer = 1.5;
                    if (this.lives <= 0) {
                        this.phase = 'game_over';
                        this.gameOverPhrase = getMotivationalPhrase();
                    }
                }
            }
        }

        this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

        // Clean up
        this.bullets = this.bullets.filter(b => b.alive);
        this.enemies = this.enemies.filter(e => e.alive);
        this.explosions = this.explosions.filter(ex => { ex.timer -= dt; return ex.timer > 0; });
    }

    public reset() {
        this.tankX = 250;
        this.tankY = 350;
        this.tankDir = 'up';
        this.bullets = [];
        this.enemies = [];
        this.explosions = [];
        this.lives = 3;
        this.score = 0;
        this.phase = 'playing';
        this.waveCount = 0;
        this.spawnTimer = 1.5;
        this.spawnInterval = 2.0;
        this.shootCooldown = 0;
        this.invincibleTimer = 1.0;
        this.gameOverPhrase = '';
        this.enemySpeed = 40;
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, screenW, screenH);

        const scaleX = (screenW * 0.85) / this.fieldW;
        const scaleY = (screenH * 0.72) / this.fieldH;
        const scale = Math.min(scaleX, scaleY);
        const ox = (screenW - this.fieldW * scale) / 2;
        const oy = (screenH - this.fieldH * scale) / 2 + s(20);

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Field
        ctx.fillStyle = '#0a0a0a';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.fillRect(0, 0, this.fieldW, this.fieldH);
        ctx.strokeRect(0, 0, this.fieldW, this.fieldH);

        // Grid
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= this.fieldW; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.fieldH); ctx.stroke();
        }
        for (let y = 0; y <= this.fieldH; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.fieldW, y); ctx.stroke();
        }

        // Walls
        for (const wall of this.walls) {
            ctx.fillStyle = '#3a3a2a';
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
        }

        // Explosions
        for (const ex of this.explosions) {
            const radius = (0.5 - ex.timer) * 40;
            ctx.fillStyle = `rgba(255, 150, 0, ${ex.timer * 2})`;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 100, ${ex.timer})`;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Bullets
        for (const b of this.bullets) {
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#ffff00';
            ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
            ctx.shadowBlur = 0;
        }

        // Enemies (red triangles pointing at player)
        for (const e of this.enemies) {
            const angle = Math.atan2(this.tankY - e.y, this.tankX - e.x);
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(angle);
            ctx.fillStyle = '#ff3333';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ff3333';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-6, -6);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Player tank
        const blink = this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 8) % 2 === 0;
        if (!blink) {
            ctx.save();
            ctx.translate(this.tankX, this.tankY);
            let angle = 0;
            if (this.tankDir === 'up') angle = -Math.PI / 2;
            else if (this.tankDir === 'down') angle = Math.PI / 2;
            else if (this.tankDir === 'left') angle = Math.PI;
            else angle = 0;
            ctx.rotate(angle);

            // Body
            ctx.fillStyle = '#44aa44';
            ctx.fillRect(-this.tankSize * 0.7, -this.tankSize * 0.5, this.tankSize * 1.4, this.tankSize);

            // Turret
            ctx.fillStyle = '#338833';
            ctx.fillRect(0, -3, this.tankSize, 6);

            // Treads
            ctx.fillStyle = '#225522';
            ctx.fillRect(-this.tankSize * 0.7, -this.tankSize * 0.6, this.tankSize * 1.4, 3);
            ctx.fillRect(-this.tankSize * 0.7, this.tankSize * 0.5 - 3, this.tankSize * 1.4, 3);

            ctx.restore();
        }

        ctx.restore();

        // HUD
        ctx.textAlign = 'center';
        ctx.fillStyle = '#44ff44';
        ctx.font = `bold ${r(24)}px monospace`;
        ctx.fillText('TANK ATTACK', screenW / 2, oy - s(30));

        // Lives
        ctx.fillStyle = '#ff4444';
        ctx.font = `${r(16)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`VIDAS: ${'♥'.repeat(this.lives)}`, ox + s(10), oy - s(10));

        // Score
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'right';
        ctx.fillText(`PONTOS: ${this.score}`, ox + this.fieldW * scale - s(10), oy - s(10));

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Controls
        if (this.phase === 'playing') {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#555';
            ctx.font = `${r(11)}px monospace`;
            ctx.fillText('[↑↓←→] Mover  |  [ESPAÇO] Atirar  |  [ESC] Sair', screenW / 2, screenH - s(15));
        }
    }
}
