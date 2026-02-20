/**
 * Global Polyfills for the game.
 * Ensures the Canvas API works on older browsers and handles edge cases safely.
 */

if (typeof window !== 'undefined') {
    const context = CanvasRenderingContext2D.prototype as any;
    const nativeRoundRect = context.roundRect;

    context.roundRect = function (x: number, y: number, w: number, h: number, r: number | number[]) {
        // Validation & Safety
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) return;

        // Handle negative dimensions (Native roundRect throws RangeError on these)
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }

        if (w === 0 || h === 0) return;

        // Simplify radius for polyfill
        let radius = 0;
        if (Array.isArray(r)) {
            radius = r[0] || 0;
        } else {
            radius = r || 0;
        }

        // Clamp radius
        radius = Math.min(radius, w / 2, h / 2);
        if (radius < 0) radius = 0;

        // Use native if available and dimensions are safe
        if (nativeRoundRect) {
            try {
                nativeRoundRect.call(this, x, y, w, h, radius);
                return;
            } catch (e) {
                // Fallback on error
            }
        }

        // Manual Path Fallback
        this.moveTo(x + radius, y);
        this.arcTo(x + w, y, x + w, y + h, radius);
        this.arcTo(x + w, y + h, x, y + h, radius);
        this.arcTo(x, y + h, x, y, radius);
        this.arcTo(x, y, x + w, y, radius);
        this.closePath();
    };
}
