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
    private joystickX: number = 0;
    private joystickY: number = 0;
    private contextStack: InputContext[] = ['exploration'];

    private constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);

        const onDown = (e: MouseEvent | TouchEvent) => {
            this.mouseDown = true;
            this.setKeyState('MouseLeft', true);
            if (e instanceof MouseEvent) {
                this.onMouseMove(e);
            } else if (e.touches.length > 0) {
                this.updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        const onUp = () => {
            this.mouseDown = false;
            this.setKeyState('MouseLeft', false);
        };

        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchend', onUp);
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
    }

    private updateMousePos(clientX: number, clientY: number) {
        const dpr = window.devicePixelRatio || 1;
        this.mouseX = clientX * dpr;
        this.mouseY = clientY * dpr;
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

    /** Set joystick vector (normalized -1 to 1) */
    public setJoystickVector(x: number, y: number) {
        this.joystickX = x;
        this.joystickY = y;

        const threshold = 0.3;

        // Use setKeyState to ensure justPressed/justReleased are triggered correctly
        this.setKeyState('ArrowUp', y < -threshold);
        this.setKeyState('ArrowDown', y > threshold);
        this.setKeyState('ArrowLeft', x < -threshold);
        this.setKeyState('ArrowRight', x > threshold);
    }

    public getJoystickVector(): { x: number; y: number } {
        return { x: this.joystickX, y: this.joystickY };
    }

    private onMouseMove = (e: MouseEvent) => {
        this.updateMousePos(e.clientX, e.clientY);
    };

    /** Call at the END of each frame to reset transient state */
    public endFrame() {
        this.justPressed.clear();
        this.justReleased.clear();
    }

    public anyKeyPressed(): boolean {
        return this.justPressed.size > 0 || this.mouseDown;
    }

    private getAliases(code: string): string[] {
        const aliases: Record<string, string[]> = {
            'ArrowUp': ['KeyW'],
            'ArrowDown': ['KeyS'],
            'ArrowLeft': ['KeyA'],
            'ArrowRight': ['KeyD'],
            'KeyW': ['ArrowUp'],
            'KeyS': ['ArrowDown'],
            'KeyA': ['ArrowLeft'],
            'KeyD': ['ArrowRight']
        };
        return aliases[code] || [];
    }

    public isDown(code: string): boolean {
        // Direct key check
        if (this.keys.get(code)) return true;

        // Alias check
        for (const alias of this.getAliases(code)) {
            if (this.keys.get(alias)) return true;
        }

        return false;
    }

    public wasPressed(code: string): boolean {
        if (this.justPressed.get(code)) return true;
        for (const alias of this.getAliases(code)) {
            if (this.justPressed.get(alias)) return true;
        }
        return false;
    }

    public wasReleased(code: string): boolean {
        if (this.justReleased.get(code)) return true;
        for (const alias of this.getAliases(code)) {
            if (this.justReleased.get(alias)) return true;
        }
        return false;
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
