/**
 * Shared mobile detection utility.
 * Uses CSS viewport dimensions (not canvas resolution) for accurate detection.
 */
export function isMobile(): boolean {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    return hasTouch && (viewH < 500 || Math.min(viewW, viewH) <= 1024);
}
