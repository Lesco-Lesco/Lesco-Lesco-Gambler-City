/**
 * MinigameBackground — Shared fullscreen background renderer for all minigames.
 * Draws a themed gradient + animated particles + border + title + footer hints.
 * Every minigame should call this instead of rolling its own background.
 */

import { UIScale } from './UIScale';
import { isMobile } from './MobileDetect';
import type { MinigameTheme } from './MinigameThemes';

/** Lightweight particle for ambient background animation */
interface BGParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    phase: number;
}

// Particle pool (shared across all instances to avoid GC churn)
let particles: BGParticle[] = [];
let particlesInitialized = false;
const MAX_PARTICLES = 30;

function ensureParticles() {
    if (particlesInitialized) return;
    particlesInitialized = true;
    for (let i = 0; i < MAX_PARTICLES; i++) {
        particles.push({
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.015,
            vy: (Math.random() - 0.5) * 0.01 - 0.005,
            size: 1 + Math.random() * 2,
            alpha: 0.1 + Math.random() * 0.3,
            phase: Math.random() * Math.PI * 2,
        });
    }
}

/**
 * Draw a fullscreen themed background.
 * Call this as the FIRST draw call in any minigame render.
 */
export function drawMinigameBackground(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    theme: MinigameTheme,
    time: number = Date.now() / 1000
) {
    const s = UIScale.s.bind(UIScale);

    // ── 1. Full-screen gradient ──
    const grad = ctx.createRadialGradient(
        screenW / 2, screenH * 0.4, screenW * 0.1,
        screenW / 2, screenH * 0.5, Math.max(screenW, screenH)
    );
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, screenW, screenH);

    // ── 2. Subtle animated particles ──
    ensureParticles();
    const particleColor = theme.particle || theme.accent;
    for (const p of particles) {
        // Update
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        const twinkle = Math.sin(time * 1.5 + p.phase) * 0.15 + 0.85;
        const alpha = p.alpha * twinkle;

        ctx.fillStyle = particleColor;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x * screenW, p.y * screenH, s(p.size), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── 3. Themed border glow ──
    const borderColor = theme.border || theme.accent;
    const borderPulse = Math.sin(time * 1.2) * 0.2 + 0.6;
    const borderW = s(2);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderW;
    ctx.globalAlpha = borderPulse;
    ctx.strokeRect(
        s(6), s(6),
        screenW - s(12), screenH - s(12)
    );
    ctx.globalAlpha = 1;

    // ── 4. Corner decorations (subtle L-shapes) ──
    const cornerLen = s(20);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = s(2.5);
    ctx.globalAlpha = borderPulse * 0.8;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(s(6), s(6) + cornerLen);
    ctx.lineTo(s(6), s(6));
    ctx.lineTo(s(6) + cornerLen, s(6));
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(screenW - s(6) - cornerLen, s(6));
    ctx.lineTo(screenW - s(6), s(6));
    ctx.lineTo(screenW - s(6), s(6) + cornerLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(s(6), screenH - s(6) - cornerLen);
    ctx.lineTo(s(6), screenH - s(6));
    ctx.lineTo(s(6) + cornerLen, screenH - s(6));
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(screenW - s(6) - cornerLen, screenH - s(6));
    ctx.lineTo(screenW - s(6), screenH - s(6));
    ctx.lineTo(screenW - s(6), screenH - s(6) - cornerLen);
    ctx.stroke();

    ctx.globalAlpha = 1;
}

/**
 * Draw a themed title at the top of the screen.
 */
export function drawMinigameTitle(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    theme: MinigameTheme,
    title?: string
) {
    const s = UIScale.s.bind(UIScale);
    const mobile = isMobile();
    const cx = screenW / 2;
    const titleText = title || theme.name;

    ctx.save();
    ctx.shadowBlur = s(16);
    ctx.shadowColor = theme.accent;
    ctx.fillStyle = theme.accent;
    ctx.font = `bold ${UIScale.r(mobile ? 18 : 24)}px ${theme.titleFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(titleText, cx, screenH * (mobile ? 0.08 : 0.07));
    ctx.shadowBlur = 0;
    ctx.restore();
}

/**
 * Draw themed control hints at the bottom of the screen.
 */
export function drawMinigameFooter(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    theme: MinigameTheme,
    hint: string
) {
    const mobile = isMobile();

    ctx.fillStyle = theme.textMuted;
    ctx.font = `${UIScale.r(mobile ? 8 : 10)}px ${theme.titleFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(hint, screenW / 2, screenH - UIScale.s(16));
}
