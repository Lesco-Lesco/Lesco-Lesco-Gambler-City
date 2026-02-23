/**
 * UIScale — Centralized responsive UI scaling utility.
 * Computes a scale factor based on the canvas resolution relative to
 * a reference resolution (1280×720). All UI elements should multiply
 * their font sizes, positions, and dimensions by UIScale.s() to
 * remain proportionally correct across all screen sizes.
 */

const REF_WIDTH = 1280;
const REF_HEIGHT = 720;

export class UIScale {
    private static _scale: number = 1;

    /** Update scale factor — call on every resize */
    public static update(canvasW: number, canvasH: number) {
        this._scale = Math.min(canvasW / REF_WIDTH, canvasH / REF_HEIGHT);
    }

    /** Current scale factor */
    public static get scale(): number {
        return this._scale;
    }

    /** Scale a numeric value */
    public static s(value: number): number {
        return value * this._scale;
    }

    /** Scale and round (for font sizes and integer positions) */
    public static r(value: number): number {
        return Math.round(value * this._scale);
    }
}
