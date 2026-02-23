/**
 * CasinoScene — underground clandestine casino beneath Santa Cruz Shopping.
 * Colorful flashing lights, slot machines, Jogo do Bicho booth.
 * Contrasts with the dark exterior.
 */

import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { SlotMachine } from '../MiniGames/SlotMachine';
import type { SlotResult, SlotTheme } from '../MiniGames/SlotMachine';
import { JogoDoBicho } from '../MiniGames/JogoDoBicho';
import { BichoManager } from '../BichoManager';
import { isMobile } from '../Core/MobileDetect';
import { HUD } from '../UI/HUD';
import { UIScale } from '../Core/UIScale';

/** Machine visual object in the casino floor (Slot or Bicho) */
interface CasinoMachine {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    glowColor: string;
    glowPhase: number;
    type: 'slot' | 'bicho';
    theme?: SlotTheme; // Only for slots
}

/** State of the casino scene */
type CasinoState = 'floor' | 'slot' | 'bicho';

export class CasinoScene implements Scene {
    public name = 'casino';

    private screenW: number;
    private screenH: number;
    private input: InputManager;

    // Casino floor
    private machines: CasinoMachine[] = [];
    private selectedMachine: number = 0;
    private state: CasinoState = 'floor';

    // Mini-games
    private slotMachine: SlotMachine;

    // Player data (shared with ExplorationScene via BichoManager)
    public gameHour: number = 20;
    public currentInGameTime: number = 0;

    // Visual effects
    private time: number = 0;
    private flashLights: { x: number; y: number; r: number; g: number; b: number; speed: number }[] = [];

    // Slot UI state
    private slotBet: number = 10;
    private slotSpinning: boolean = false;
    private slotResult: SlotResult | null = null;
    private slotReels: number[] = [0, 0, 0];
    private slotSpinTimer: number = 0;

    // Bicho UI state
    private bichoSelectedAnimal: number = 0;
    private bichoBet: number = 10;
    private bichoMessage: string = '';
    private bichoPendingBets: { animal: number; amount: number }[] = [];

    // Scene transition callback
    public onSceneExitRequest?: () => void;
    public onGameOver?: () => void;
    private hud: HUD = new HUD();

    constructor(screenW: number, screenH: number) {
        this.screenW = screenW;
        this.screenH = screenH;
        this.input = InputManager.getInstance();
        this.slotMachine = new SlotMachine();

        this.rebuildLayout();
    }

    /** Rebuild machine positions and flash lights based on screen size */
    private rebuildLayout() {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        this.machines = [];
        this.flashLights = [];

        const themes: SlotTheme[] = ['fruits', 'animals', 'shapes', 'food', 'ocean', 'space'];
        const cols = mobile ? 4 : 3;
        const machineW = s(mobile ? 130 : 160);
        const machineH = s(mobile ? 170 : 200);
        const spacingX = s(mobile ? 160 : 220);
        const spacingY = s(mobile ? 190 : 240);

        // All items: 6 slots + 1 bicho booth = 7 items
        const totalItems = themes.length + 1;
        const rows = Math.ceil(totalItems / cols);

        const totalGridH = (rows - 1) * spacingY + machineH;
        const startY = (this.screenH - totalGridH) / 2 + s(35);

        for (let r = 0; r < rows; r++) {
            const itemsInThisRow = Math.min(cols, totalItems - r * cols);
            const rowW = (itemsInThisRow - 1) * spacingX + machineW;
            const startX = (this.screenW - rowW) / 2;

            for (let c = 0; c < itemsInThisRow; c++) {
                const idx = r * cols + c;
                const mX = startX + c * spacingX;
                const mY = startY + r * spacingY;

                if (idx < themes.length) {
                    // Slot Machine
                    this.machines.push({
                        x: mX, y: mY,
                        width: machineW, height: machineH,
                        color: `hsl(${(idx * 60) % 360}, 60%, 20%)`,
                        glowColor: idx % 2 === 0 ? '#ff00ff' : '#ffff00',
                        glowPhase: Math.random() * Math.PI * 2,
                        type: 'slot',
                        theme: themes[idx]
                    });
                } else {
                    // Jogo do Bicho Booth (Slightly larger to prevent overlap and stand out)
                    const extraW = mobile ? s(30) : s(40);
                    const extraH = mobile ? s(60) : s(60);
                    this.machines.push({
                        x: mX - extraW / 2, // Center wider booth
                        y: mY - extraH / 2, // Center taller booth
                        width: machineW + extraW,
                        height: machineH + extraH,
                        color: '#0a2a0a',
                        glowColor: '#00ff00',
                        glowPhase: 0,
                        type: 'bicho'
                    });
                }
            }
        }

        // Sonic 2 style neon flasher lights
        const colors = ['#ff00ff', '#ffff00', '#00ffff', '#ffffff'];
        for (let i = 0; i < 50; i++) {
            const hex = colors[Math.floor(Math.random() * colors.length)];
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);

            this.flashLights.push({
                x: Math.random() * this.screenW,
                y: Math.random() * s(200),
                r, g, b,
                speed: 2 + Math.random() * 6,
            });
        }
    }

    public resize(w: number, h: number) {
        this.screenW = w;
        this.screenH = h;
        this.rebuildLayout();
    }

    public onEnter() {
        this.state = 'floor';
        this.input.pushContext('casino');
        this.slotResult = null;
        this.bichoMessage = '';
    }

    public onExit() {
        this.input.popContext();
    }

    public update(dt: number) {
        this.time += dt;
        this.currentInGameTime += dt;

        // Update global manager
        const bmanager = BichoManager.getInstance();
        bmanager.update(dt);

        // Game Over Check
        if (bmanager.playerMoney <= 0 && !bmanager.hasPendingBets() && !this.slotSpinning) {
            if (this.onGameOver) this.onGameOver();
            return;
        }

        if (this.state === 'floor') {
            this.updateFloor();
        } else if (this.state === 'slot') {
            this.updateSlot(dt);
        } else if (this.state === 'bicho') {
            this.updateBicho();
        }

        // ESC to exit casino (go back to exploration)
        if (this.input.wasPressed('Escape') && this.state === 'floor') {
            if (this.onSceneExitRequest) this.onSceneExitRequest();
        }

        // ESC from mini-game back to floor
        if (this.input.wasPressed('Escape') && this.state !== 'floor') {
            this.state = 'floor';
        }
    }

    private updateFloor() {
        const mobile = isMobile();
        const cols = mobile ? 4 : 3;

        if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            this.selectedMachine = Math.min(this.selectedMachine + 1, this.machines.length - 1);
        }
        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            this.selectedMachine = Math.max(this.selectedMachine - 1, 0);
        }
        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            this.selectedMachine = Math.min(this.selectedMachine + cols, this.machines.length - 1);
        }
        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            this.selectedMachine = Math.max(this.selectedMachine - cols, 0);
        }

        if (this.input.wasPressed('KeyE') || this.input.wasPressed('Enter')) {
            const m = this.machines[this.selectedMachine];
            if (m.type === 'bicho') {
                this.state = 'bicho';
                this.bichoMessage = '';
            } else {
                this.state = 'slot';
                this.slotResult = null;
                this.slotSpinning = false;
            }
        }
    }

    private updateSlot(dt: number) {
        const machine = this.machines[this.selectedMachine];
        const theme = machine.theme;
        if (!theme) return;
        const symbols = SlotMachine.THEMES[theme].symbols;

        if (this.slotSpinning) {
            this.slotSpinTimer -= dt;
            this.slotReels = this.slotReels.map((_, i) =>
                Math.floor(this.time * (15 + i * 5)) % symbols.length
            );
            if (this.slotSpinTimer <= 0) {
                this.slotSpinning = false;
                const bmanager = BichoManager.getInstance();
                if (theme) {
                    this.slotResult = this.slotMachine.spin(this.slotBet, theme);
                    this.slotReels = this.slotResult.reels;
                    if (this.slotResult) {
                        bmanager.playerMoney += this.slotResult.payout - this.slotBet;
                    }
                }
            }
        } else {
            const bmanager = BichoManager.getInstance();
            const limits = bmanager.getBetLimits();

            if (this.input.wasPressed('ArrowUp')) {
                let step = 10;
                if (limits.max > 1000) step = 100;
                if (limits.max > 10000) step = 500;
                this.slotBet = Math.min(this.slotBet + step, bmanager.playerMoney, limits.max);
            }
            if (this.input.wasPressed('ArrowDown')) {
                let step = 10;
                if (limits.max > 1000) step = 100;
                if (limits.max > 10000) step = 500;
                this.slotBet = Math.max(this.slotBet - step, limits.min);
            }
            // OK button (Enter or Space)
            const okPressed = this.input.wasPressed('Enter') || this.input.wasPressed('Space');
            if (okPressed && bmanager.playerMoney >= this.slotBet) {
                this.slotSpinning = true;
                this.slotSpinTimer = 1.5;
                this.slotResult = null;
            }
        }
    }

    private updateBicho() {
        if (this.input.wasPressed('ArrowRight')) {
            this.bichoSelectedAnimal = Math.min(this.bichoSelectedAnimal + 1, 24);
        }
        if (this.input.wasPressed('ArrowLeft')) {
            this.bichoSelectedAnimal = Math.max(this.bichoSelectedAnimal - 1, 0);
        }
        if (this.input.wasPressed('ArrowDown')) {
            this.bichoSelectedAnimal = Math.min(this.bichoSelectedAnimal + 5, 24);
        }
        if (this.input.wasPressed('ArrowUp')) {
            this.bichoSelectedAnimal = Math.max(this.bichoSelectedAnimal - 5, 0);
        }

        const bmanager = BichoManager.getInstance();
        const limits = bmanager.getBetLimits();

        // Bet adjustment (Shift + Up/Down for mobile 🏃 compatibility, plus +/- for PC)
        const isShift = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        const adjustUp = this.input.wasPressed('Equal') || this.input.wasPressed('NumpadAdd') || (isShift && this.input.wasPressed('ArrowUp'));
        const adjustDown = this.input.wasPressed('Minus') || this.input.wasPressed('NumpadSubtract') || (isShift && this.input.wasPressed('ArrowDown'));

        if (adjustUp) {
            let step = 10;
            if (limits.max > 1000) step = 100;
            if (limits.max > 10000) step = 500;
            this.bichoBet = Math.min(this.bichoBet + step, bmanager.playerMoney, limits.max);
        }
        if (adjustDown) {
            let step = 10;
            if (limits.max > 1000) step = 100;
            if (limits.max > 10000) step = 500;
            this.bichoBet = Math.max(this.bichoBet - step, limits.min);
        }

        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
            if (bmanager.playerMoney >= this.bichoBet) {
                bmanager.placeBet(this.bichoSelectedAnimal, this.bichoBet);
                const animalName = JogoDoBicho.ANIMALS[this.bichoSelectedAnimal].name;
                this.bichoMessage = `Apostou R$${this.bichoBet} no ${animalName}!`;
                this.bichoPendingBets.push({ animal: this.bichoSelectedAnimal, amount: this.bichoBet });
            } else {
                this.bichoMessage = 'Dinheiro insuficiente!';
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);

        // Starfield & Neon Grid (Sonic 2 style)
        this.drawStarfield(ctx);
        this.drawNeonGrid(ctx);

        // Flashing ceiling lights
        this.drawCeilingLights(ctx);

        if (this.state === 'floor') {
            this.renderFloor(ctx);
        } else if (this.state === 'slot') {
            this.renderSlotUI(ctx);
        } else if (this.state === 'bicho') {
            this.renderBichoUI(ctx);
        }

        // Money display
        const bmanager = BichoManager.getInstance();
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${UIScale.r(14)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`R$ ${bmanager.playerMoney}`, s(20), s(30));

        // Global Notifications
        this.hud.renderNotifications(ctx, this.screenW, bmanager.getNotifications());

        // Exit hint
        const mobile = isMobile();
        ctx.fillStyle = '#666';
        ctx.font = `${UIScale.r(mobile ? 12 : 10)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'right';
        const exitHint = mobile ? '[ ✕ ] SAIR' : (this.state === 'floor' ? '[ESC] Sair do cassino' : '[ESC] Voltar');
        ctx.fillText(exitHint, this.screenW - s(20), s(30));
    }

    private drawStarfield(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#050208';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        for (let i = 0; i < 100; i++) {
            const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * this.screenW;
            const y = (Math.cos(i * 678.90 + this.time * 0.1) * 0.5 + 0.5) * this.screenH;
            const size = (Math.sin(this.time * 2 + i) * 0.5 + 0.5) * 2;
            ctx.fillStyle = i % 10 === 0 ? '#ff00ff' : i % 10 === 1 ? '#00ffff' : '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawNeonGrid(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const patternSize = s(60);
        ctx.strokeStyle = '#2a1a4a';
        ctx.lineWidth = 1;

        for (let y = 0; y < this.screenH; y += patternSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.screenW, y);
            ctx.stroke();
        }
        for (let x = 0; x < this.screenW; x += patternSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.screenH);
            ctx.stroke();
        }

        const pulse = Math.sin(this.time * 2) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 0, 255, ${pulse * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let y = 0; y < this.screenH; y += patternSize * 2) {
            ctx.moveTo(0, y); ctx.lineTo(this.screenW, y);
        }
        for (let x = 0; x < this.screenW; x += patternSize * 2) {
            ctx.moveTo(x, 0); ctx.lineTo(x, this.screenH);
        }
        ctx.stroke();
    }

    private drawCeilingLights(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        for (const light of this.flashLights) {
            const intensity = Math.sin(this.time * light.speed) * 0.5 + 0.5;
            const alpha = 0.15 + intensity * 0.3;
            const radius = s(30) + intensity * s(20);

            const gradient = ctx.createRadialGradient(
                light.x, light.y, 0,
                light.x, light.y, radius
            );
            gradient.addColorStop(0, `rgba(${light.r}, ${light.g}, ${light.b}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${light.r}, ${light.g}, ${light.b}, 0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
        }
    }

    private renderFloor(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = Math.sin(this.time * 2) * 0.2 + 0.3;
        const grad = ctx.createRadialGradient(this.screenW / 2, this.screenH / 2, 0, this.screenW / 2, this.screenH / 2, s(400));
        grad.addColorStop(0, `rgba(255, 0, 255, ${pulse * 0.2})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);
        ctx.restore();

        this.machines.forEach((m, idx) => {
            const isSelected = idx === this.selectedMachine && this.state === 'floor';

            // Base shadow and glow for all types
            ctx.shadowBlur = isSelected ? s(50) : s(10);
            ctx.shadowColor = m.glowColor;
            ctx.fillStyle = m.color;
            ctx.fillRect(m.x, m.y, m.width, m.height);
            ctx.shadowBlur = 0;

            ctx.strokeStyle = m.glowColor;
            ctx.lineWidth = s(isSelected ? 6 : 4);
            ctx.strokeRect(m.x, m.y, m.width, m.height);

            // Selection indicator (Sonic 2 style)
            if (isSelected) {
                const whitePulse = (Math.sin(this.time * 10) * 0.5 + 0.5);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + whitePulse * 0.5})`;
                ctx.lineWidth = s(2);
                ctx.strokeRect(m.x - s(4), m.y - s(4), m.width + s(8), m.height + s(8));

                ctx.fillStyle = '#ffffff';
                ctx.font = `${UIScale.r(24)}px Arial`;
                ctx.textAlign = 'center';
                const bounce = Math.sin(this.time * 8) * s(5);
                ctx.fillText('▼', m.x + m.width / 2, m.y - s(30) + bounce);
            }

            // Decorative inner border
            ctx.strokeStyle = (m.type === 'bicho') ? '#ffcc00' : (idx % 2 === 0 ? '#00ffff' : '#ff00ff');
            ctx.lineWidth = s(2);
            ctx.strokeRect(m.x + s(6), m.y + s(6), m.width - s(12), m.height - s(12));

            if (m.type === 'slot') {
                // Slot Machine Screen
                const screenAlpha = isSelected ? 0.4 : 0.2;
                ctx.fillStyle = isSelected ? `rgba(255,255,255,${screenAlpha})` : 'rgba(0,0,0,0.5)';
                ctx.fillRect(m.x + s(12), m.y + s(25), m.width - s(24), m.height * 0.4);

                // Side lights
                for (let side = 0; side < 2; side++) {
                    const lx = side === 0 ? m.x : m.x + m.width;
                    for (let b = 0; b < 5; b++) {
                        const ly = m.y + s(20) + b * s(35);
                        const bPhase = Math.sin(this.time * 8 + b + side * 5) * 0.5 + 0.5;
                        ctx.fillStyle = bPhase > 0.5 ? m.glowColor : '#333';
                        ctx.beginPath();
                        ctx.arc(lx, ly, s(4), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                ctx.fillStyle = isSelected ? '#fff' : m.glowColor;
                ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P"`;
                ctx.textAlign = 'center';
                if (isSelected) {
                    ctx.shadowBlur = s(15);
                    ctx.shadowColor = '#fff';
                }
                ctx.fillText(m.theme?.toUpperCase() || '', m.x + m.width / 2, m.y + m.height - s(30));
                ctx.shadowBlur = 0;
            } else {
                // Jogo do Bicho Booth
                ctx.fillStyle = '#fff';
                ctx.font = `${UIScale.r(mobile ? 14 : 20)}px "Press Start 2P"`;
                ctx.textAlign = 'center';
                // Move text to the top of the booth
                ctx.fillText('BICHO', m.x + m.width / 2, m.y + s(mobile ? 30 : 50));

                // Move Horse emoji to the bottom area of the booth
                ctx.font = `${UIScale.r(mobile ? 55 : 100)}px Arial`;
                ctx.fillText('🐴', m.x + m.width / 2, m.y + m.height - s(mobile ? 25 : 50));
            }
        });
    }

    private renderSlotUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;
        const machine = this.machines[this.selectedMachine];
        const theme = machine.theme;
        if (!theme) return;
        const symbols = SlotMachine.THEMES[theme].symbols;

        // Dim Background (Solid black for full screen feel)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Machine Cabinet Body (Full Screen Gradient)
        const grad = ctx.createLinearGradient(0, 0, this.screenW, this.screenH);
        grad.addColorStop(0, '#1b0b2a');
        grad.addColorStop(1, '#050208');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Neon Border Glow (around the monitor area)
        const monitorPadding = s(15);
        ctx.strokeStyle = machine.glowColor;
        ctx.lineWidth = s(6);
        ctx.shadowBlur = s(25);
        ctx.shadowColor = machine.glowColor;
        ctx.strokeRect(monitorPadding, monitorPadding, this.screenW - monitorPadding * 2, this.screenH - monitorPadding * 2);
        ctx.shadowBlur = 0;

        // Title Header
        ctx.fillStyle = '#ff88aa';
        ctx.font = `bold ${UIScale.r(mobile ? 32 : 44 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(15);
        ctx.shadowColor = '#ff44aa';
        if (theme) {
            ctx.fillText(`${theme.toUpperCase()} SLOTS`, cx, s(mobile ? 50 : 80));
        }
        ctx.shadowBlur = 0;

        // Reels Container (Screen)
        const reelAreaW = this.screenW * (mobile ? 0.95 : 0.8);
        const reelAreaH = this.screenH * (mobile ? 0.5 : 0.4);

        ctx.fillStyle = '#111';
        ctx.fillRect(cx - reelAreaW / 2, cy - reelAreaH / 2 - s(20), reelAreaW, reelAreaH);

        for (let i = 0; i < 3; i++) {
            const colW = reelAreaW / 3;
            const reelX = cx - (reelAreaW / 3) + i * colW;
            const sym = symbols[this.slotReels[i]];

            ctx.fillStyle = i % 2 === 0 ? '#181818' : '#222';
            ctx.fillRect(reelX - colW / 2 + s(2), cy - reelAreaH / 2 - s(20), colW - s(4), reelAreaH);

            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(mobile ? 100 : 100)}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.shadowBlur = s(20);
            ctx.shadowColor = 'rgba(255,255,255,0.5)';
            ctx.fillText(sym, reelX, cy - s(10));
            ctx.shadowBlur = 0;

            if (i < 2) {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = s(2);
                ctx.beginPath();
                ctx.moveTo(reelX + colW / 2, cy - reelAreaH / 2 - s(20));
                ctx.lineTo(reelX + colW / 2, cy + reelAreaH / 2 - s(20));
                ctx.stroke();
            }
        }

        // Info Display
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(mobile ? 24 : 28 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`APOSTA ATUAL`, cx, this.screenH - s(mobile ? 145 : 170));

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 40 : 48 * fScale)}px "Segoe UI", sans-serif`;
        ctx.fillText(`R$ ${this.slotBet}`, cx, this.screenH - s(mobile ? 90 : 115));

        const btnW = s(mobile ? 220 : 280);
        const btnH = s(mobile ? 55 : 70);
        const btnY = this.screenH - s(mobile ? 65 : 85); // Slightly higher to ensure clearance
        const btnTextY = btnY + btnH / 2; // Vertical centering logic

        // Hints - Adjusted for better spacing
        ctx.fillStyle = '#666';
        ctx.font = `bold ${UIScale.r(mobile ? 12 : 14)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(mobile ? "[D-PAD ↑/↓] Ajustar" : "[SETAS ↑/↓] Ajustar", s(20), this.screenH - s(20));
        ctx.textAlign = 'right';
        ctx.fillText(mobile ? "[ OK ] GIRAR" : "[ENTER/ESPAÇO] GIRAR", this.screenW - s(20), this.screenH - s(20));

        // Spin Button
        if (!this.slotSpinning) {
            const btnGrad = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
            btnGrad.addColorStop(0, '#ff4466');
            btnGrad.addColorStop(1, '#aa2244');
            ctx.fillStyle = btnGrad;

            ctx.beginPath();
            ctx.roundRect(cx - btnW / 2, btnY, btnW, btnH, s(35));
            ctx.fill();

            ctx.shadowBlur = s(20);
            ctx.shadowColor = '#ff4466';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = s(2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#fff';
            ctx.font = `bold ${UIScale.r(mobile ? 24 : 28 * fScale)}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Subtracting s(2) to nudge text slightly up for better visual centering 
            ctx.fillText('GIRAR!', cx, btnTextY - s(2));
            ctx.textBaseline = 'alphabetic';
        } else {
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.roundRect(cx - btnW / 2, btnY, btnW, btnH, s(35));
            ctx.fill();

            ctx.fillStyle = '#888';
            ctx.font = `bold ${UIScale.r(mobile ? 20 : 24 * fScale)}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RODANDO...', cx, btnTextY - s(2));
            ctx.textBaseline = 'alphabetic';
        }

        // Result Overlay
        if (this.slotResult) {
            const resultColor = this.slotResult.payout > 0 ? '#44ff44' : '#ff4444';
            const boxW = s(mobile ? 340 : 600);
            const boxH = s(mobile ? 180 : 220);

            ctx.fillStyle = 'rgba(0,0,0,0.95)';
            ctx.beginPath();
            ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, s(20));
            ctx.fill();

            ctx.strokeStyle = resultColor;
            ctx.lineWidth = s(4);
            ctx.stroke();

            ctx.fillStyle = resultColor;
            ctx.textAlign = 'center';
            ctx.shadowBlur = s(20);
            ctx.shadowColor = resultColor;

            if (this.slotResult.payout > 0) {
                ctx.font = `bold ${UIScale.r(mobile ? 32 : 36)}px "Segoe UI", sans-serif`;
                ctx.fillText(`PARABÉNS!`, cx, cy - s(mobile ? 25 : 30));
                ctx.font = `bold ${UIScale.r(mobile ? 42 : 54)}px "Segoe UI", sans-serif`;
                ctx.fillText(`GANHOU R$ ${this.slotResult.payout}`, cx, cy + s(mobile ? 35 : 50));
            } else {
                ctx.font = `bold ${UIScale.r(mobile ? 28 : 36)}px "Segoe UI", sans-serif`;
                ctx.fillText('NÃO FOI DESSA VEZ...', cx, cy + s(mobile ? 10 : 15));
            }
            ctx.shadowBlur = 0;
        }
    }

    private renderBichoUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const fScale = mobile ? 1.2 : 1.0;
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;

        // Deep Green "Felt" Background (Full Screen)
        ctx.fillStyle = '#05140a';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Grid parameters
        ctx.fillStyle = '#ffdd44';
        ctx.font = `bold ${UIScale.r(mobile ? 32 : 44 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = s(25);
        ctx.shadowColor = '#ffbb00';
        ctx.fillText('JOGO DO BICHO - FEDERAL', cx, s(mobile ? 50 : 80));
        ctx.shadowBlur = 0;

        // Grid sizing - Bigger on mobile, centered but shifted on PC
        const gridW = mobile ? this.screenW - s(40) : this.screenW - s(140);
        const gridH = mobile ? this.screenH - s(180) : this.screenH - s(300);
        const cellW = gridW / 5;
        const cellH = gridH / 5;
        const gridStartX = cx - (cellW * 2.5);
        // Shift grid up (PC/Mobile) to clear the footer shadow and center better
        // Lifting slightly less (80 -> 60) to avoid title overlap on PC
        const gridStartY = cy - (cellH * 2.5) - (mobile ? s(25) : s(60));

        // Group colors (5 animals per group)
        const groupColors = [
            'rgba(255, 100, 100, 0.2)', // Group 1
            'rgba(100, 255, 100, 0.2)', // Group 2
            'rgba(100, 100, 255, 0.2)', // Group 3
            'rgba(255, 255, 100, 0.2)', // Group 4
            'rgba(255, 100, 255, 0.2)'  // Group 5
        ];

        for (let row = 0; row < 5; row++) {
            const gy = gridStartY + row * cellH;

            for (let col = 0; col < 5; col++) {
                const i = row * 5 + col;
                const animal = JogoDoBicho.ANIMALS[i];
                const isSelected = i === this.bichoSelectedAnimal;
                const ax = gridStartX + col * cellW;
                const ay = gy;

                ctx.beginPath();
                // Reduce cell padding on mobile (s(20) -> s(10)) to enlarge quadrants
                const cellPadding = s(mobile ? 10 : 10);
                ctx.roundRect(ax + cellPadding / 2, ay + cellPadding / 2, cellW - cellPadding, cellH - cellPadding, s(8));

                if (isSelected) {
                    ctx.fillStyle = mobile ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
                    ctx.shadowBlur = s(20);
                    ctx.shadowColor = '#ffcc00';
                } else {
                    const groupIdx = Math.floor(i / 5);
                    ctx.fillStyle = groupColors[groupIdx] || 'rgba(0,0,0,0.4)';
                    ctx.shadowBlur = 0;
                }
                ctx.fill();

                ctx.strokeStyle = isSelected ? '#ffcc00' : 'rgba(255,255,255,0.1)';
                ctx.lineWidth = isSelected ? s(3) : s(1);
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#fff';
                ctx.font = `${Math.floor(cellH * (mobile ? 0.6 : 0.5))}px "Segoe UI Emoji", Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(animal.emoji, ax + cellW / 2, ay + cellH * 0.48); // Lifted emoji even more

                ctx.fillStyle = isSelected ? '#ffcc00' : '#aaa';
                ctx.font = `bold ${Math.floor(cellH * (mobile ? 0.18 : 0.15))}px "Segoe UI", sans-serif`;
                ctx.fillText(animal.name.toUpperCase(), ax + cellW / 2, ay + cellH * 0.78); // Lifted name even more

                ctx.fillStyle = '#666';
                ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Segoe UI"`;
                ctx.textAlign = 'left';
                ctx.fillText(`${i + 1}`, ax + s(mobile ? 6 : 10), ay + s(mobile ? 14 : 20));
            }
        }

        // Betting Footer
        const footerY = this.screenH - s(mobile ? 65 : 100);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, footerY - s(mobile ? 35 : 50), this.screenW, s(mobile ? 110 : 150));

        ctx.fillStyle = '#aaa';
        ctx.font = `bold ${UIScale.r(mobile ? 16 : 20 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText("APOSTA:", cx - s(mobile ? 100 : 180), footerY + s(5));

        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(mobile ? 40 : 54 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'left';
        ctx.shadowBlur = s(15);
        ctx.shadowColor = 'rgba(255, 204, 0, 0.4)';
        ctx.fillText(`R$ ${this.bichoBet}`, cx - s(mobile ? 80 : 160), footerY + s(mobile ? 12 : 20));
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(mobile ? 12 : 14 * fScale)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        const helpX = mobile ? cx + s(115) : cx + s(180);
        const adjustHint = mobile ? "[🏃+ DPAD] Ajustar" : "[+/-] Ajustar Valor";
        const chooseHint = mobile ? "[ DPAD ] Escolher" : "[SETAS] Escolher Bicho";
        const confirmHint = mobile ? "[ OK ] CONFIRMAR" : "[ESPAÇO] CONFIRMAR";

        ctx.fillText(adjustHint, helpX, footerY - s(12));
        ctx.fillText(chooseHint, helpX, footerY + s(8));
        ctx.fillText(confirmHint, helpX, footerY + s(30));

        if (this.bichoMessage) {
            ctx.save();
            ctx.translate(cx, footerY + s(mobile ? 45 : 60));
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.roundRect(-s(mobile ? 200 : 300), -s(25), s(mobile ? 400 : 600), s(50), s(25));
            ctx.fill();

            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = s(2);
            ctx.stroke();

            ctx.fillStyle = '#44ff44';
            ctx.font = `bold ${UIScale.r(mobile ? 16 : 20 * fScale)}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(this.bichoMessage, 0, s(mobile ? 6 : 8));
            ctx.restore();
        }
    }
}
