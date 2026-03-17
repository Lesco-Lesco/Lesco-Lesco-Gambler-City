/**
 * AchievementUI — Queue-based toast notification for unlocked achievements.
 * Renders a golden neon popup with tier-colored border, slides in/out with particles.
 */

import { GameEventEmitter } from '../Core/EventEmitter';
import { TIER_INFO } from '../Core/AchievementManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';

interface AchievementToast {
    name: string;
    description: string;
    reward: number;
    tier: number;
    phase: 'slide_in' | 'display' | 'slide_out' | 'done';
    timer: number;
    slideProgress: number; // 0 = off-screen, 1 = on-screen
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

const SLIDE_DURATION = 0.4;
const DISPLAY_DURATION = 4.0;

export class AchievementUI {
    private static instance: AchievementUI;
    private queue: AchievementToast[] = [];
    private current: AchievementToast | null = null;
    private particles: Particle[] = [];
    private sparkleTimer: number = 0;

    private constructor() {
        // Listen for achievement unlock events
        GameEventEmitter.getInstance().on('ACHIEVEMENT_UNLOCKED', (data) => {
            this.enqueue(data.name, data.description, data.reward, data.tier);
        });
    }

    public static getInstance(): AchievementUI {
        if (!AchievementUI.instance) {
            AchievementUI.instance = new AchievementUI();
        }
        return AchievementUI.instance;
    }

    private enqueue(name: string, description: string, reward: number, tier: number): void {
        this.queue.push({
            name,
            description,
            reward,
            tier,
            phase: 'slide_in',
            timer: 0,
            slideProgress: 0,
        });
    }

    public update(dt: number): void {
        // Process particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 60 * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // No current toast? Dequeue next
        if (!this.current && this.queue.length > 0) {
            this.current = this.queue.shift()!;
        }

        if (!this.current) return;

        const toast = this.current;
        toast.timer += dt;

        if (toast.phase === 'slide_in') {
            toast.slideProgress = Math.min(1, toast.timer / SLIDE_DURATION);
            if (toast.slideProgress >= 1) {
                toast.phase = 'display';
                toast.timer = 0;
                this.spawnParticles();
            }
        } else if (toast.phase === 'display') {
            // Sparkle particles during display
            this.sparkleTimer -= dt;
            if (this.sparkleTimer <= 0) {
                this.sparkleTimer = 0.3;
                this.spawnSparkle();
            }
            if (toast.timer >= DISPLAY_DURATION) {
                toast.phase = 'slide_out';
                toast.timer = 0;
            }
        } else if (toast.phase === 'slide_out') {
            toast.slideProgress = Math.max(0, 1 - toast.timer / SLIDE_DURATION);
            if (toast.slideProgress <= 0) {
                toast.phase = 'done';
                this.current = null;
            }
        }
    }

    private spawnParticles(): void {
        const colors = ['#ffdd00', '#ffaa00', '#ffffff', '#ff88cc', '#88ffcc'];
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 150;
            this.particles.push({
                x: 0, // Will be offset in render
                y: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 80,
                life: 0.8 + Math.random() * 0.6,
                maxLife: 1.4,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 2 + Math.random() * 3,
            });
        }
    }

    private spawnSparkle(): void {
        const colors = ['#ffdd00', '#ffffff'];
        for (let i = 0; i < 3; i++) {
            this.particles.push({
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 40,
                vy: -20 - Math.random() * 40,
                life: 0.5 + Math.random() * 0.4,
                maxLife: 0.9,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 1.5 + Math.random() * 2,
            });
        }
    }

    private drawTextWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        let linesCount = 0;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line.trim(), x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
                linesCount++;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), x, currentY);
        return currentY;
    }

    public render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
        if (!this.current && this.particles.length === 0) return;

        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const cx = screenW / 2;

        // Toast box
        if (this.current && this.current.phase !== 'done') {
            const toast = this.current;
            const tierInfo = TIER_INFO[toast.tier] || TIER_INFO[1];

            // Easing: smooth slide from top
            const ease = this.easeOutBack(toast.slideProgress);
            const boxW = s(mobile ? 380 : 420);
            const boxH = s(mobile ? 90 : 100);
            const boxX = cx - boxW / 2;
            const targetY = s(mobile ? 100 : 90);
            const offscreenY = -boxH - s(20);
            const boxY = offscreenY + (targetY - offscreenY) * ease;

            ctx.save();

            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.roundRect(boxX + s(3), boxY + s(3), boxW, boxH, s(10));
            ctx.fill();

            // Background
            const bgGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
            bgGrad.addColorStop(0, 'rgba(20, 15, 5, 0.95)');
            bgGrad.addColorStop(1, 'rgba(10, 8, 2, 0.95)');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, s(10));
            ctx.fill();

            // Animated tier-colored border
            const time = Date.now();
            const glowPulse = Math.sin(time / 300) * 0.3 + 0.7;
            ctx.strokeStyle = tierInfo.color;
            ctx.lineWidth = s(3);
            ctx.shadowBlur = s(12) * glowPulse;
            ctx.shadowColor = tierInfo.color;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, s(10));
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Inner glow line
            ctx.strokeStyle = `${tierInfo.color}44`;
            ctx.lineWidth = s(1);
            ctx.beginPath();
            ctx.roundRect(boxX + s(3), boxY + s(3), boxW - s(6), boxH - s(6), s(8));
            ctx.stroke();

            // Trophy icon
            const trophyX = boxX + s(30);
            const trophyY = boxY + boxH / 2;
            ctx.font = `${r(mobile ? 28 : 32)}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🏆', trophyX, trophyY);
            ctx.textBaseline = 'alphabetic';

            // Achievement name
            ctx.fillStyle = '#ffdd44';
            ctx.font = `bold ${r(mobile ? 12 : 14)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'left';
            ctx.shadowBlur = s(8);
            ctx.shadowColor = '#ffaa00';
            
            // Limit name width to avoid overlap with icon
            const maxTitleW = boxW - s(110);
            this.drawTextWrapped(ctx, toast.name, boxX + s(55), boxY + s(mobile ? 28 : 30), maxTitleW, s(mobile ? 14 : 16));
            ctx.shadowBlur = 0;

            // Description
            ctx.fillStyle = '#cccccc';
            ctx.font = `${r(mobile ? 10 : 11)}px monospace`;
            const maxDescW = boxW - s(110);
            this.drawTextWrapped(ctx, toast.description, boxX + s(55), boxY + s(mobile ? 48 : 52), maxDescW, s(mobile ? 12 : 14));

            // Reward
            ctx.fillStyle = '#44ff88';
            ctx.font = `bold ${r(mobile ? 12 : 14)}px monospace`;
            ctx.shadowBlur = s(6);
            ctx.shadowColor = '#44ff88';
            ctx.fillText(`+R$${toast.reward}`, boxX + s(55), boxY + s(mobile ? 78 : 82));
            ctx.shadowBlur = 0;

            // Tier info container (Right side)
            ctx.textAlign = 'right';
            
            // Tier label
            ctx.fillStyle = tierInfo.color;
            ctx.font = `bold ${r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
            ctx.fillText(tierInfo.label, boxX + boxW - s(15), boxY + s(mobile ? 78 : 82));

            // Tier icon
            ctx.font = `${r(16)}px "Segoe UI Emoji", Arial`;
            ctx.fillText(tierInfo.icon, boxX + boxW - s(15), boxY + s(mobile ? 28 : 30));

            ctx.restore();

            // Particles centered on toast box
            const particleCX = cx;
            const particleCY = boxY + boxH / 2;

            for (const p of this.particles) {
                const alpha = Math.max(0, p.life / p.maxLife);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(particleCX + p.x, particleCY + p.y, s(p.size), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else {
            // Draw remaining particles even after toast gone
            for (const p of this.particles) {
                const alpha = Math.max(0, p.life / p.maxLife);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(screenW / 2 + p.x, screenH * 0.15 + p.y, s(p.size), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    /** Ease-out back for a satisfying overshoot effect */
    private easeOutBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
}
