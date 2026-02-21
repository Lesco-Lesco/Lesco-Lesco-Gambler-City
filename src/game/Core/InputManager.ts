/**
 * Centralized input manager with context stacking.
 * Contexts allow mini-games to capture input without affecting exploration.
 */

export type InputContext = 'exploration' | 'minigame' | 'dialogue' | 'menu' | 'casino';

export class InputManager {
    private static instance: InputManager;

    private keys: Map<string, boolean> = new Map();
    private justPressed: Map<string, boolean> = new Map();
    private justReleased: Map<string, boolean> = new Map();
    private mouseX: number = 0;
    private mouseY: number = 0;
    private mouseDown: boolean = false;
    private contextStack: InputContext[] = ['exploration'];

    private constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', () => (this.mouseDown = true));
        window.addEventListener('mouseup', () => (this.mouseDown = false));
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.keys.get(e.code)) {
            this.justPressed.set(e.code, true);
        }
        this.keys.set(e.code, true);
        // e.preventDefault(); // Removed to allow browser shortcuts (Zoom, F12, F5)
    };

    private onKeyUp = (e: KeyboardEvent) => {
        this.keys.set(e.code, false);
        this.justReleased.set(e.code, true);
    };

    /** Allows external systems (like mobile UI) to trigger key states */
    public setKeyState(code: string, isPressed: boolean) {
        if (isPressed) {
            if (!this.keys.get(code)) {
                this.justPressed.set(code, true);
            }
            this.keys.set(code, true);
        } else {
            if (this.keys.get(code)) {
                this.justReleased.set(code, true);
            }
            this.keys.set(code, false);
        }
    }

    private onMouseMove = (e: MouseEvent) => {
        const dpr = window.devicePixelRatio || 1;
        this.mouseX = e.clientX * dpr;
        this.mouseY = e.clientY * dpr;
    };

    /** Call at the END of each frame to reset transient state */
    public endFrame() {
        this.justPressed.clear();
        this.justReleased.clear();
    }

    public isDown(code: string): boolean {
        return this.keys.get(code) === true;
    }

    public wasPressed(code: string): boolean {
        return this.justPressed.get(code) === true;
    }

    public wasReleased(code: string): boolean {
        return this.justReleased.get(code) === true;
    }

    public getMousePos(): { x: number; y: number } {
        return { x: this.mouseX, y: this.mouseY };
    }

    public isMouseDown(): boolean {
        return this.mouseDown;
    }

    // --- Context Management ---
    public pushContext(ctx: InputContext) {
        this.contextStack.push(ctx);
    }

    public popContext(): InputContext | undefined {
        if (this.contextStack.length > 1) {
            return this.contextStack.pop();
        }
        return undefined;
    }

    public getContext(): InputContext {
        return this.contextStack[this.contextStack.length - 1];
    }

    public destroy() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousemove', this.onMouseMove);
    }
}
