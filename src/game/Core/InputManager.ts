/**
 * Centralized input manager with context stacking.
 * Contexts allow mini-games to capture input without affecting exploration.
 */

export type InputContext = 'exploration' | 'minigame' | 'dialogue' | 'menu' | 'casino' | 'bankruptcy';

export class InputManager {
    private static instance: InputManager;

    private keys: Map<string, boolean> = new Map();
    private justPressed: Map<string, boolean> = new Map();
    private justReleased: Map<string, boolean> = new Map();
    private holdTimers: Map<string, number> = new Map();
    private repeatIntervals: Map<string, number> = new Map();
    private mouseX: number = 0;
    private mouseY: number = 0;
    private mouseDown: boolean = false;
    private joystickX: number = 0;
    private joystickY: number = 0;
    private activeMinigame: string | null = null;
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

        const threshold = 0.4; // Aumentado de 0.3 para 0.4 para evitar toques acidentais perto do centro
        const absX = Math.abs(x);
        const absY = Math.abs(y);

        // Se o movimento não for forte o suficiente, limpa as direções
        if (absX < threshold && absY < threshold) {
            this.setKeyState('ArrowUp', false);
            this.setKeyState('ArrowDown', false);
            this.setKeyState('ArrowLeft', false);
            this.setKeyState('ArrowRight', false);
            return;
        }

        // Para minijogos e menus, o "eixo dominante" parece mais natural
        // Se X for muito maior que Y, ignoramos Y (e vice-versa)
        const isHorizontal = absX > absY * 1.2;
        const isVertical = absY > absX * 1.2;

        this.setKeyState('ArrowUp', isVertical && y < -threshold);
        this.setKeyState('ArrowDown', isVertical && y > threshold);
        this.setKeyState('ArrowLeft', isHorizontal && x < -threshold);
        this.setKeyState('ArrowRight', isHorizontal && x > threshold);
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

    /** Returns true if key was just pressed, OR if held long enough to trigger auto-repeat */
    public wasPressedOrHeld(code: string, dt: number): boolean {
        if (!this.isDown(code)) {
            this.holdTimers.delete(code);
            this.repeatIntervals.delete(code);
            return false;
        }

        if (this.wasPressed(code)) {
            this.holdTimers.set(code, 0);
            this.repeatIntervals.set(code, 0);
            return true;
        }

        let time = (this.holdTimers.get(code) || 0) + dt;
        this.holdTimers.set(code, time);

        const startTime = 0.45; // Start repeating after 450ms
        if (time < startTime) return false;

        // Accelerate repeat rate based on hold time
        let interval = 0.15;
        if (time > 2.5) interval = 0.03;
        else if (time > 1.2) interval = 0.07;

        let lastRepeat = this.repeatIntervals.get(code) || 0;
        if (time - lastRepeat >= interval) {
            this.repeatIntervals.set(code, time);
            return true;
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

    public setActiveMinigame(name: string | null) {
        this.activeMinigame = name;
    }

    public getActiveMinigame(): string | null {
        return this.activeMinigame;
    }

    public destroy() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousemove', this.onMouseMove);
    }
}
