/**
 * HUD — in-game heads-up display.
 * Shows money, time, zone, stamina, and interaction prompts.
 */


import { isMobile } from '../Core/MobileDetect';
import { UIScale } from '../Core/UIScale';

export class HUD {
    public render(
        ctx: CanvasRenderingContext2D,
        screenW: number,
        _screenH: number,
        money: number,
        stamina: number,
        maxStamina: number,
        fps: number,
        interactionHint: string | null
    ) {
        const s = UIScale.s.bind(UIScale);

        // --- Top-left: Money ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(s(10), s(10), s(180), s(45));
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(s(10), s(10), s(180), s(45));

        ctx.fillStyle = '#44dd66';
        ctx.font = `bold ${UIScale.r(18)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`R$ ${money}`, s(20), s(35));

        // Subtitle
        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(10)}px monospace`;
        ctx.fillText('GRANA', s(20), s(50));

        // --- Clock Removed --- (Endless Night Mode)

        // --- Stamina bar (bottom-left) ---
        const staminaW = s(100);
        const staminaY = s(62);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(s(10), staminaY, staminaW + s(10), s(14));

        ctx.fillStyle = '#333';
        ctx.fillRect(s(15), staminaY + s(3), staminaW, s(8));

        const staminaRatio = stamina / maxStamina;
        const staminaColor = staminaRatio > 0.5 ? '#44aaff' : staminaRatio > 0.2 ? '#ffaa44' : '#ff4444';
        ctx.fillStyle = staminaColor;
        ctx.fillRect(s(15), staminaY + s(3), staminaW * staminaRatio, s(8));

        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(8)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText('STAMINA', s(15), staminaY + s(24));

        // --- FPS (top-right, subtle) ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = `${UIScale.r(10)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`${fps} FPS`, screenW - s(15), s(22));

        // --- Interaction hint (bottom-center) ---
        if (interactionHint) {
            const hintW = ctx.measureText(interactionHint).width + s(40);
            const hintX = screenW / 2 - hintW / 2;
            const hintY = _screenH - s(80);

            const pulse = Math.sin(Date.now() / 300) * 0.15 + 0.85;
            ctx.globalAlpha = pulse;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hintX, hintY, hintW, s(35));
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1;
            ctx.strokeRect(hintX, hintY, hintW, s(35));

            ctx.fillStyle = '#ffcc00';
            ctx.font = `bold ${UIScale.r(14)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(interactionHint, screenW / 2, hintY + s(23));

            ctx.globalAlpha = 1;
        }
    }

    public renderNotifications(ctx: CanvasRenderingContext2D, screenW: number, notifications: { message: string, timer: number }[]) {
        if (notifications.length === 0) return;

        const s = UIScale.s.bind(UIScale);

        // Detect mobile using shared helper
        const mobile = isMobile();

        // On mobile: below stamina bar (left side). On desktop: top-right (original).
        const startY = mobile ? s(95) : s(70);

        notifications.forEach((note, i) => {
            const y = startY + i * s(40);
            const alpha = Math.min(note.timer, 1.0);

            ctx.save();
            ctx.globalAlpha = alpha;

            ctx.font = `bold ${UIScale.r(12)}px monospace`;
            const textWidth = ctx.measureText(note.message).width;
            const boxW = textWidth + s(40);

            // Mobile: left-aligned below stamina. Desktop: right-aligned.
            const boxX = mobile ? s(10) : screenW - boxW - s(20);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(boxX, y, boxW, s(30));
            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, y, boxW, s(30));

            ctx.fillStyle = '#fff';
            ctx.textAlign = mobile ? 'left' : 'right';
            const textX = mobile ? boxX + s(20) : screenW - s(40);
            ctx.fillText(note.message, textX, y + s(20));

            ctx.restore();
        });
    }
}
