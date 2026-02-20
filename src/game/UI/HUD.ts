/**
 * HUD — in-game heads-up display.
 * Shows money, time, zone, stamina, and interaction prompts.
 */



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
        // --- Top-left: Money ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, 10, 180, 45);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, 180, 45);

        ctx.fillStyle = '#44dd66';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`R$ ${money}`, 20, 35);

        // Subtitle
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText('GRANA', 20, 50);

        // --- Clock Removed --- (Endless Night Mode)

        // --- Stamina bar (bottom-left) ---
        const staminaW = 100;
        const staminaY = 62;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, staminaY, staminaW + 10, 14);

        ctx.fillStyle = '#333';
        ctx.fillRect(15, staminaY + 3, staminaW, 8);

        const staminaRatio = stamina / maxStamina;
        const staminaColor = staminaRatio > 0.5 ? '#44aaff' : staminaRatio > 0.2 ? '#ffaa44' : '#ff4444';
        ctx.fillStyle = staminaColor;
        ctx.fillRect(15, staminaY + 3, staminaW * staminaRatio, 8);

        ctx.fillStyle = '#888';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STAMINA', 15, staminaY + 24);

        // --- FPS (top-right, subtle) ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${fps} FPS`, screenW - 15, 22);

        // --- Interaction hint (bottom-center) ---
        if (interactionHint) {
            const hintW = ctx.measureText(interactionHint).width + 40;
            const hintX = screenW / 2 - hintW / 2;
            const hintY = _screenH - 80;

            const pulse = Math.sin(Date.now() / 300) * 0.15 + 0.85;
            ctx.globalAlpha = pulse;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hintX, hintY, hintW, 35);
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1;
            ctx.strokeRect(hintX, hintY, hintW, 35);

            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(interactionHint, screenW / 2, hintY + 23);

            ctx.globalAlpha = 1;
        }
    }

    public renderNotifications(ctx: CanvasRenderingContext2D, screenW: number, notifications: { message: string, timer: number }[]) {
        if (notifications.length === 0) return;

        const startY = 70;
        notifications.forEach((note, i) => {
            const y = startY + i * 40;
            const alpha = Math.min(note.timer, 1.0);

            ctx.save();
            ctx.globalAlpha = alpha;

            // Notification Box
            const textWidth = ctx.measureText(note.message).width;
            const boxW = textWidth + 40;
            const boxX = screenW - boxW - 20;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(boxX, y, boxW, 30);
            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, y, boxW, 30);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(note.message, screenW - 40, y + 20);

            ctx.restore();
        });
    }
}
