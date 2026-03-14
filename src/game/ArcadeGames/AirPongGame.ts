/**
 * Air Pong — Pong meets Air Hockey.
 * Two paddles, one disc, first to 5 goals wins the round.
 * Player only loses credit when they take 5 goals.
 * Score accumulates across rounds until player loses.
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { SoundManager } from '../Core/SoundManager';

export class AirPongGame {
    // Field
    private fieldW = 600;
    private fieldH = 400;

    // Paddles
    private playerY = 200;
    private aiY = 200;
    private paddleH = 60;
    private paddleW = 12;
    private paddleSpeed = 350;
    private aiSpeed = 120;
    private readonly aiBaseSpeed = 120;
    private readonly aiMaxSpeed = 320;
    private aiReactionDelay = 0.15; // seconds of lag before AI reacts
    private aiReactionTimer = 0;
    private aiTargetY = 200; // where AI thinks disc will be

    // Disc
    private discX = 300;
    private discY = 200;
    private discR = 8;
    private discVX = 0;
    private discVY = 0;
    private discSpeed = 280;
    private readonly baseSpeed = 280;
    private readonly maxSpeed = 650;
    private bounceCount = 0;

    // Score
    public playerGoals = 0;
    public aiGoals = 0;
    public score = 0;
    public phase: 'playing' | 'goal' | 'game_over' = 'playing';
    private goalTimer = 0;
    private lastScorer: 'player' | 'ai' = 'player';
    private gameOverPhrase: string = '';

    // Trail
    private trail: { x: number; y: number; alpha: number }[] = [];

    constructor() {
        this.resetDisc();
    }

    private resetDisc() {
        this.discX = this.fieldW / 2;
        this.discY = this.fieldH / 2;
        // After each goal, keep a gentle speed ramp based on total bounces
        // so the game slowly gets harder over time, but resets most of the speed gain
        this.discSpeed = this.baseSpeed + Math.min(this.bounceCount * 1.5, 120);
        this.bounceCount = 0;
        const angle = (Math.random() - 0.5) * Math.PI * 0.6;
        const dir = this.lastScorer === 'ai' ? 1 : -1;
        this.discVX = Math.cos(angle) * this.discSpeed * dir;
        this.discVY = Math.sin(angle) * this.discSpeed;
    }

    public update(dt: number) {
        if (this.phase === 'goal') {
            this.goalTimer -= dt;
            if (this.goalTimer <= 0) {
                if (this.aiGoals >= 5) {
                    this.phase = 'game_over';
                    this.gameOverPhrase = getMotivationalPhrase();
                    SoundManager.getInstance().play('lose');
                } else {
                    this.phase = 'playing';
                    this.resetDisc();
                }
            }
            return;
        }
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();

        // Player paddle (left side)
        const jv = input.getJoystickVector();
        if (jv.y !== 0) {
            this.playerY += jv.y * this.paddleSpeed * dt;
        } else {
            if (input.isDown('ArrowUp')) this.playerY -= this.paddleSpeed * dt;
            if (input.isDown('ArrowDown')) this.playerY += this.paddleSpeed * dt;
        }
        this.playerY = Math.max(this.paddleH / 2, Math.min(this.fieldH - this.paddleH / 2, this.playerY));

        // AI paddle (right side) — dynamic difficulty
        // AI has a reaction delay: it updates its target periodically, not every frame
        this.aiReactionTimer -= dt;
        if (this.aiReactionTimer <= 0) {
            this.aiReactionTimer = this.aiReactionDelay;
            // AI tracks disc position with some noise (less noise as difficulty rises)
            const noise = (1 - this.playerGoals * 0.08) * 40; // starts ±40px, shrinks with goals
            this.aiTargetY = this.discY + (Math.random() - 0.5) * Math.max(noise, 4);
        }
        const aiDiff = this.aiTargetY - this.aiY;
        const aiMove = Math.min(Math.abs(aiDiff), this.aiSpeed * dt) * Math.sign(aiDiff);
        this.aiY += aiMove;
        this.aiY = Math.max(this.paddleH / 2, Math.min(this.fieldH - this.paddleH / 2, this.aiY));

        // Move disc
        this.discX += this.discVX * dt;
        this.discY += this.discVY * dt;

        // Trail
        this.trail.push({ x: this.discX, y: this.discY, alpha: 1.0 });
        if (this.trail.length > 20) this.trail.shift();
        for (const t of this.trail) t.alpha -= dt * 3;

        // Wall bounce (top/bottom) — gentle speed bump
        if (this.discY - this.discR < 0) {
            this.discY = this.discR;
            this.discVY = Math.abs(this.discVY);
            this.applyBounceSpeedup(0.005); // very subtle on walls
            SoundManager.getInstance().play('arcade_bounce');
        }
        if (this.discY + this.discR > this.fieldH) {
            this.discY = this.fieldH - this.discR;
            this.discVY = -Math.abs(this.discVY);
            this.applyBounceSpeedup(0.005);
            SoundManager.getInstance().play('arcade_bounce');
        }

        // Paddle collision (left - player)
        const pLeft = 30;
        if (this.discX - this.discR < pLeft + this.paddleW &&
            this.discX > pLeft &&
            this.discY > this.playerY - this.paddleH / 2 &&
            this.discY < this.playerY + this.paddleH / 2) {
            this.discX = pLeft + this.paddleW + this.discR;
            const offset = (this.discY - this.playerY) / (this.paddleH / 2);
            const angle = offset * Math.PI * 0.35;
            this.applyBounceSpeedup(0.02); // noticeable on paddle hits
            this.discVX = Math.cos(angle) * this.discSpeed;
            this.discVY = Math.sin(angle) * this.discSpeed;
            SoundManager.getInstance().play('arcade_hit');
        }

        // Paddle collision (right - AI)
        const aiLeft = this.fieldW - 30 - this.paddleW;
        if (this.discX + this.discR > aiLeft &&
            this.discX < aiLeft + this.paddleW &&
            this.discY > this.aiY - this.paddleH / 2 &&
            this.discY < this.aiY + this.paddleH / 2) {
            this.discX = aiLeft - this.discR;
            const offset = (this.discY - this.aiY) / (this.paddleH / 2);
            const angle = Math.PI + offset * Math.PI * 0.35;
            this.applyBounceSpeedup(0.02);
            this.discVX = Math.cos(angle) * this.discSpeed;
            this.discVY = Math.sin(angle) * this.discSpeed;
            SoundManager.getInstance().play('arcade_hit');
        }

        // Goals
        if (this.discX < 0) {
            this.aiGoals++;
            this.lastScorer = 'ai';
            this.phase = 'goal';
            this.goalTimer = 1.5;
            SoundManager.getInstance().play('arcade_hit');
        }
        if (this.discX > this.fieldW) {
            this.playerGoals++;
            this.score += 30;
            this.lastScorer = 'player';
            this.phase = 'goal';
            this.goalTimer = 1.5;
            SoundManager.getInstance().play('win_small');
            // AI gets harder with each player goal
            this.aiSpeed = Math.min(this.aiBaseSpeed + this.playerGoals * 30, this.aiMaxSpeed);
            this.aiReactionDelay = Math.max(0.15 - this.playerGoals * 0.015, 0.03);
        }
    }

    private applyBounceSpeedup(factor: number) {
        this.bounceCount++;
        this.discSpeed = Math.min(this.discSpeed * (1 + factor), this.maxSpeed);
    }

    public reset() {
        this.playerGoals = 0;
        this.aiGoals = 0;
        this.score = 0;
        this.phase = 'playing';
        this.playerY = this.fieldH / 2;
        this.aiY = this.fieldH / 2;
        this.trail = [];
        this.discSpeed = this.baseSpeed;
        this.bounceCount = 0;
        this.aiSpeed = this.aiBaseSpeed;
        this.aiReactionDelay = 0.15;
        this.aiReactionTimer = 0;
        this.aiTargetY = this.fieldH / 2;
        this.lastScorer = 'player';
        this.resetDisc();
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, screenW, screenH);

        const mobile = isMobile();
        const scaleX = (screenW * (mobile ? 0.95 : 0.8)) / this.fieldW;
        const scaleY = (screenH * (mobile ? 0.8 : 0.7)) / this.fieldH;
        const scale = Math.min(scaleX, scaleY);
        const ox = (screenW - this.fieldW * scale) / 2;
        const oy = (screenH - this.fieldH * scale) / 2 + (mobile ? s(10) : s(20));

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Air Hockey Table
        ctx.fillStyle = '#0a1a2a';
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 3;
        ctx.fillRect(0, 0, this.fieldW, this.fieldH);
        ctx.strokeRect(0, 0, this.fieldW, this.fieldH);

        // Center line
        ctx.setLineDash([10, 8]);
        ctx.strokeStyle = '#004488';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.fieldW / 2, 0);
        ctx.lineTo(this.fieldW / 2, this.fieldH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center circle
        ctx.strokeStyle = '#004488';
        ctx.beginPath();
        ctx.arc(this.fieldW / 2, this.fieldH / 2, 50, 0, Math.PI * 2);
        ctx.stroke();

        // Goals (glowing slots)
        ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
        ctx.fillRect(-5, this.fieldH * 0.3, 5, this.fieldH * 0.4);
        ctx.fillStyle = 'rgba(50, 50, 255, 0.3)';
        ctx.fillRect(this.fieldW, this.fieldH * 0.3, 5, this.fieldH * 0.4);

        // Trail
        for (const t of this.trail) {
            if (t.alpha <= 0) continue;
            ctx.fillStyle = `rgba(0, 200, 255, ${t.alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.discR * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player paddle (left)
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff4444';
        ctx.fillRect(30, this.playerY - this.paddleH / 2, this.paddleW, this.paddleH);
        ctx.shadowBlur = 0;

        // AI paddle (right)
        ctx.fillStyle = '#4444ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#4444ff';
        ctx.fillRect(this.fieldW - 30 - this.paddleW, this.aiY - this.paddleH / 2, this.paddleW, this.paddleH);
        ctx.shadowBlur = 0;

        // Disc
        ctx.fillStyle = '#00ccff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ccff';
        ctx.beginPath();
        ctx.arc(this.discX, this.discY, this.discR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner disc highlight
        ctx.fillStyle = '#88eeff';
        ctx.beginPath();
        ctx.arc(this.discX - 2, this.discY - 2, this.discR * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // HUD
        const hudY = mobile ? Math.max(s(25), oy - s(12)) : oy - s(5);
        const titleY = mobile ? hudY - s(25) : oy - s(30);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ccff';
        ctx.font = `bold ${r(mobile ? 18 : 24)}px monospace`;
        ctx.fillText('AIR PONG', screenW / 2, titleY);

        ctx.font = `bold ${r(mobile ? 28 : 40)}px monospace`;
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`${this.playerGoals}`, screenW / 2 - s(mobile ? 40 : 60), hudY);
        ctx.fillStyle = '#666';
        ctx.fillText('x', screenW / 2, hudY);
        ctx.fillStyle = '#4444ff';
        ctx.fillText(`${this.aiGoals}`, screenW / 2 + s(mobile ? 40 : 60), hudY);

        // Score
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${r(14)}px monospace`;
        ctx.fillText(`PONTOS: ${this.score}`, screenW / 2, oy + this.fieldH * scale + s(25));

        // Goal overlay
        if (this.phase === 'goal') {
            ctx.fillStyle = this.lastScorer === 'player' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)';
            ctx.fillRect(0, 0, screenW, screenH);
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(36)}px monospace`;
            ctx.fillText(this.lastScorer === 'player' ? 'GOL!' : 'TOMOU GOL!', screenW / 2, screenH / 2);
        }

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Controls hint
        if (this.phase === 'playing' && !isMobile()) {
            ctx.fillStyle = '#555';
            ctx.font = `${r(11)}px monospace`;
            ctx.fillText('[↑↓] Mover  |  [ESC] Sair', screenW / 2, screenH - s(15));
        }
    }
}
