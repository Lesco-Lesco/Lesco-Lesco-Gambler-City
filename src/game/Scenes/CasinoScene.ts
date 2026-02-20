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
import { HUD } from '../UI/HUD';

/** Slot machine visual object in the casino */
interface CasinoMachine {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    glowColor: string;
    glowPhase: number;
    theme: SlotTheme;
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

        // Create slot machine positions (Sonic 2 style, centered)
        const themes: SlotTheme[] = ['fruits', 'animals', 'shapes', 'food', 'ocean', 'space'];
        const cols = 3;
        const rows = 2;
        const machineW = 160;
        const machineH = 200;
        const spacingX = 220;
        const spacingY = 240;

        const totalW = (cols - 1) * spacingX + machineW;
        const totalH = (rows - 1) * spacingY + machineH;
        const startX = (this.screenW - totalW) / 2;
        const startY = (this.screenH - totalH) / 2 + 50;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                this.machines.push({
                    x: startX + c * spacingX,
                    y: startY + r * spacingY,
                    width: machineW,
                    height: machineH,
                    color: `hsl(${(idx * 60) % 360}, 60%, 20%)`,
                    glowColor: idx % 2 === 0 ? '#ff00ff' : '#ffff00', // Pink & Yellow neon
                    glowPhase: Math.random() * Math.PI * 2,
                    theme: themes[idx]
                });
            }
        }

        // Sonic 2 style neon flasher lights
        const colors = ['#ff00ff', '#ffff00', '#00ffff', '#ffffff'];
        for (let i = 0; i < 50; i++) {
            const hex = colors[Math.floor(Math.random() * colors.length)];
            // Parse hex to RGB
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);

            this.flashLights.push({
                x: Math.random() * screenW,
                y: Math.random() * 200, // Spread more
                r, g, b,
                speed: 2 + Math.random() * 6,
            });
        }
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
        this.currentInGameTime += dt; // Local increment to keep results ticking

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
        // Navigate machines with arrows
        if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            this.selectedMachine = Math.min(this.selectedMachine + 1, this.machines.length);
        }
        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            this.selectedMachine = Math.max(this.selectedMachine - 1, 0);
        }
        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            this.selectedMachine = Math.min(this.selectedMachine + 5, this.machines.length);
        }
        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            this.selectedMachine = Math.max(this.selectedMachine - 5, 0);
        }

        // E or Enter to interact
        if (this.input.wasPressed('KeyE') || this.input.wasPressed('Enter')) {
            if (this.selectedMachine < this.machines.length) {
                this.state = 'slot';
                this.slotResult = null;
                this.slotSpinning = false;
            } else {
                // Last option = Jogo do Bicho
                this.state = 'bicho';
                this.bichoMessage = '';
            }
        }
    }

    private updateSlot(dt: number) {
        const machine = this.machines[this.selectedMachine];
        const theme = machine.theme;
        const symbols = SlotMachine.THEMES[theme].symbols;

        if (this.slotSpinning) {
            this.slotSpinTimer -= dt;
            // Animate reels using theme's symbols
            this.slotReels = this.slotReels.map((_, i) =>
                Math.floor(this.time * (15 + i * 5)) % symbols.length
            );
            if (this.slotSpinTimer <= 0) {
                this.slotSpinning = false;
                const bmanager = BichoManager.getInstance();
                this.slotResult = this.slotMachine.spin(this.slotBet, theme);
                this.slotReels = this.slotResult.reels;
                bmanager.playerMoney += this.slotResult.payout - this.slotBet;
            }
        } else {
            // Bet adjustment
            const bmanager = BichoManager.getInstance();
            const limits = bmanager.getBetLimits();

            if (this.input.wasPressed('ArrowUp')) {
                // Determine step size based on limits (e.g. 10, 100, 1000)
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
            // Spin
            if ((this.input.wasPressed('Space') || this.input.wasPressed('Enter')) && bmanager.playerMoney >= this.slotBet) {
                this.slotSpinning = true;
                this.slotSpinTimer = 1.5;
                this.slotResult = null;
            }
        }
    }

    private updateBicho() {
        // Navigate animals (5x5 grid)
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

        // Bet amount
        const bmanager = BichoManager.getInstance();
        const limits = bmanager.getBetLimits();

        if (this.input.wasPressed('Equal') || this.input.wasPressed('NumpadAdd')) {
            let step = 10;
            if (limits.max > 1000) step = 100;
            if (limits.max > 10000) step = 500;
            this.bichoBet = Math.min(this.bichoBet + step, bmanager.playerMoney, limits.max);
        }
        if (this.input.wasPressed('Minus') || this.input.wasPressed('NumpadSubtract')) {
            let step = 10;
            if (limits.max > 1000) step = 100;
            if (limits.max > 10000) step = 500;
            this.bichoBet = Math.max(this.bichoBet - step, limits.min);
        }

        // Place bet
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
            if (bmanager.playerMoney >= this.bichoBet) {
                bmanager.placeBet(this.bichoSelectedAnimal, this.bichoBet);
                const animalName = JogoDoBicho.ANIMALS[this.bichoSelectedAnimal].name;
                this.bichoMessage = `Apostou R$${this.bichoBet} no ${animalName}!`;
                // Add to local display pending bets (just for visual hint in this scene)
                this.bichoPendingBets.push({ animal: this.bichoSelectedAnimal, amount: this.bichoBet });
            } else {
                this.bichoMessage = 'Dinheiro insuficiente!';
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D) {
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
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`R$ ${bmanager.playerMoney}`, 20, 30);

        // Global Notifications
        this.hud.renderNotifications(ctx, this.screenW, bmanager.getNotifications());

        // Exit hint
        ctx.fillStyle = '#666';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'right';
        if (this.state === 'floor') {
            ctx.fillText('[ESC] Sair do cassino', this.screenW - 20, 30);
        } else {
            ctx.fillText('[ESC] Voltar', this.screenW - 20, 30);
        }
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
        const patternSize = 60;
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
        for (const light of this.flashLights) {
            const intensity = Math.sin(this.time * light.speed) * 0.5 + 0.5;
            const alpha = 0.15 + intensity * 0.3;
            const radius = 30 + intensity * 20;

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
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = Math.sin(this.time * 2) * 0.2 + 0.3;
        const grad = ctx.createRadialGradient(this.screenW / 2, this.screenH / 2, 0, this.screenW / 2, this.screenH / 2, 400);
        grad.addColorStop(0, `rgba(255, 0, 255, ${pulse * 0.2})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);
        ctx.restore();

        this.machines.forEach((m, idx) => {
            const isSelected = idx === this.selectedMachine && this.state === 'floor';
            ctx.shadowBlur = isSelected ? 50 : 10;
            ctx.shadowColor = m.glowColor;
            ctx.fillStyle = '#1a0a2a';
            ctx.fillRect(m.x, m.y, m.width, m.height);
            ctx.shadowBlur = 0;

            ctx.strokeStyle = m.glowColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(m.x, m.y, m.width, m.height);

            if (isSelected) {
                const whitePulse = (Math.sin(this.time * 10) * 0.5 + 0.5);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + whitePulse * 0.5})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(m.x - 4, m.y - 4, m.width + 8, m.height + 8);

                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                const bounce = Math.sin(this.time * 8) * 5;
                ctx.fillText('▼', m.x + m.width / 2, m.y - 30 + bounce);
            }

            ctx.strokeStyle = idx % 2 === 0 ? '#00ffff' : '#ff00ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(m.x + 6, m.y + 6, m.width - 12, m.height - 12);

            const screenAlpha = isSelected ? 0.4 : 0.2;
            ctx.fillStyle = isSelected ? `rgba(255,255,255,${screenAlpha})` : 'rgba(0,0,0,0.5)';
            ctx.fillRect(m.x + 12, m.y + 25, m.width - 24, m.height * 0.4);

            for (let side = 0; side < 2; side++) {
                const lx = side === 0 ? m.x : m.x + m.width;
                for (let b = 0; b < 5; b++) {
                    const ly = m.y + 20 + b * 35;
                    const bPhase = Math.sin(this.time * 8 + b + side * 5) * 0.5 + 0.5;
                    ctx.fillStyle = bPhase > 0.5 ? m.glowColor : '#333';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.fillStyle = isSelected ? '#fff' : m.glowColor;
            ctx.font = '12px "Press Start 2P"';
            ctx.textAlign = 'center';
            if (isSelected) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
            }
            ctx.fillText(m.theme.toUpperCase(), m.x + m.width / 2, m.y + m.height - 30);
            ctx.shadowBlur = 0;
        });

        const bx = this.screenW - 250;
        const by = (this.screenH - 350) / 2 + 50;
        const bSelected = this.selectedMachine === this.machines.length;

        ctx.fillStyle = '#0a2a0a';
        ctx.fillRect(bx, by, 200, 300);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 6;
        if (bSelected) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff00';
        }
        ctx.strokeRect(bx, by, 200, 300);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '18px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('BICHO', bx + 100, by + 45);

        ctx.font = '80px Arial';
        ctx.fillText('🐴', bx + 100, by + 160);

        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 10, by + 10, 180, 280);
    }

    private renderSlotUI(ctx: CanvasRenderingContext2D) {
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;
        const machine = this.machines[this.selectedMachine];
        const theme = machine.theme;
        const symbols = SlotMachine.THEMES[theme].symbols;

        // Dim Background with Blur effect (simulated)
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        const frameW = this.screenW * 0.85;
        const frameH = this.screenH * 0.85;

        // Machine Cabinet Body - "Physical" look
        const grad = ctx.createLinearGradient(cx - frameW / 2, cy - frameH / 2, cx + frameW / 2, cy + frameH / 2);
        grad.addColorStop(0, '#2b1b3a');
        grad.addColorStop(1, '#0a0510');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(cx - frameW / 2, cy - frameH / 2, frameW, frameH, 30);
        ctx.fill();

        // Neon Border Glow
        ctx.shadowBlur = 40;
        ctx.shadowColor = machine.glowColor;
        ctx.strokeStyle = machine.glowColor;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner Bezel (Chrome/Metallic)
        ctx.strokeStyle = '#445566';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(cx - frameW / 2 + 15, cy - frameH / 2 + 15, frameW - 30, frameH - 30, 20);
        ctx.stroke();

        // Title Header
        ctx.fillStyle = '#ff88aa';
        ctx.font = 'bold 36px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff00ff';
        ctx.fillText(`${theme.toUpperCase()} SLOTS`, cx, cy - frameH / 2 + 70);
        ctx.shadowBlur = 0;

        // Reels Container (Screen)
        const reelAreaW = frameW * 0.8;
        const reelAreaH = frameH * 0.4;

        ctx.fillStyle = '#000'; // Screen black
        ctx.fillRect(cx - reelAreaW / 2, cy - reelAreaH / 2 - 10, reelAreaW, reelAreaH);

        // Screen Glare
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(cx - reelAreaW / 2, cy - reelAreaH / 2 - 10);
        ctx.lineTo(cx + reelAreaW / 2, cy - reelAreaH / 2 - 10);
        ctx.lineTo(cx - reelAreaW / 2, cy + 50);
        ctx.fill();

        for (let i = 0; i < 3; i++) {
            const colW = reelAreaW / 3;
            const reelX = cx - (reelAreaW / 3) + i * colW;
            const sym = symbols[this.slotReels[i]];

            // Reel Background Stripes
            ctx.fillStyle = i % 2 === 0 ? '#111' : '#161616';
            ctx.fillRect(reelX - colW / 2 + 2, cy - reelAreaH / 2 - 10, colW - 4, reelAreaH);

            // Symbol
            ctx.fillStyle = '#fff';
            ctx.font = '100px "Segoe UI Emoji", Arial'; // Use proper emoji font
            ctx.textAlign = 'center';
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(255,255,255,0.5)';

            // Blur effect removed for compatibility
            // if (this.slotSpinning) { ... }

            ctx.fillText(sym, reelX, cy + 20);
            ctx.shadowBlur = 0;

            // Vertical dividers
            if (i < 2) {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(reelX + colW / 2, cy - reelAreaH / 2 - 10);
                ctx.lineTo(reelX + colW / 2, cy + reelAreaH / 2 - 10);
                ctx.stroke();
            }
        }

        // Info Display
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 28px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`APOSTA ATUAL`, cx, cy + frameH / 2 - 140);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px "Segoe UI", sans-serif';
        ctx.fillText(`R$ ${this.slotBet}`, cx, cy + frameH / 2 - 90);

        const btnW = 280;
        const btnH = 70;
        const btnY = cy + frameH / 2 - 60;

        // Spin Button
        if (!this.slotSpinning) {
            // Button Body
            const btnGrad = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
            btnGrad.addColorStop(0, '#ff4466');
            btnGrad.addColorStop(1, '#aa2244');
            ctx.fillStyle = btnGrad;

            ctx.beginPath();
            ctx.roundRect(cx - btnW / 2, btnY, btnW, btnH, 35);
            ctx.fill();

            // Button Shadow/Bevel
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4466';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px "Segoe UI", sans-serif';
            ctx.fillText('GIRAR!', cx, btnY + 45);
        } else {
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.roundRect(cx - btnW / 2, btnY, btnW, btnH, 35);
            ctx.fill();

            ctx.fillStyle = '#888';
            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.fillText('RODANDO...', cx, btnY + 45);
        }

        // Result Overlay
        if (this.slotResult) {
            const resultColor = this.slotResult.payout > 0 ? '#44ff44' : '#ff4444';

            // Result Box
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.beginPath();
            ctx.roundRect(cx - 300, cy - 100, 600, 200, 20);
            ctx.fill();

            ctx.strokeStyle = resultColor;
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.fillStyle = resultColor;
            ctx.font = 'bold 36px "Segoe UI", sans-serif';
            ctx.shadowBlur = 20;
            ctx.shadowColor = resultColor;

            if (this.slotResult.payout > 0) {
                ctx.fillText(`PARABÉNS!`, cx, cy - 20);
                ctx.font = 'bold 54px "Segoe UI", sans-serif';
                ctx.fillText(`GANHOU R$ ${this.slotResult.payout}`, cx, cy + 50);
            } else {
                ctx.fillText('NÃO FOI DESSA VEZ...', cx, cy + 20);
            }
            ctx.shadowBlur = 0;
        }
    }

    private renderBichoUI(ctx: CanvasRenderingContext2D) {
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;

        // Deep Green "Felt" Background
        ctx.fillStyle = 'rgba(5, 20, 10, 0.95)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        const frameW = this.screenW * 0.95;
        const frameH = this.screenH * 0.9;

        // Header
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 36px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffdd44';
        ctx.fillText('JOGO DO BICHO - FEDERAL', cx, cy - frameH / 2 + 40);
        ctx.shadowBlur = 0;

        // Grid parameters
        const cellW = (frameW - 100) / 5;
        const cellH = (frameH - 280) / 5; // Reduced space to avoid overlap with footer
        const gridStartX = cx - (cellW * 2.5);
        const gridStartY = cy - (cellH * 2.5) - 20; // Moved up slightly



        for (let row = 0; row < 5; row++) {
            const gy = gridStartY + row * cellH;


            for (let col = 0; col < 5; col++) {
                const i = row * 5 + col;
                const animal = JogoDoBicho.ANIMALS[i];
                const isSelected = i === this.bichoSelectedAnimal;
                const ax = gridStartX + col * cellW;
                const ay = gy;

                // Card Body
                ctx.beginPath();
                ctx.roundRect(ax + 4, ay + 4, cellW - 8, cellH - 8, 8);

                if (isSelected) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#ffcc00';
                } else {
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.shadowBlur = 0;
                }
                ctx.fill();

                // Border
                ctx.strokeStyle = isSelected ? '#ffcc00' : 'rgba(255,255,255,0.1)';
                ctx.lineWidth = isSelected ? 3 : 1;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Animal Emoji
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.floor(cellH * 0.5)}px "Segoe UI Emoji", Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(animal.emoji, ax + cellW / 2, ay + cellH * 0.55);

                // Animal Name
                ctx.fillStyle = isSelected ? '#ffcc00' : '#aaa';
                ctx.font = `bold ${Math.floor(cellH * 0.15)}px "Segoe UI", sans-serif`;
                ctx.fillText(animal.name.toUpperCase(), ax + cellW / 2, ay + cellH * 0.85);

                // Number
                ctx.fillStyle = '#666';
                ctx.font = '12px "Segoe UI"';
                ctx.textAlign = 'left';
                ctx.fillText(`${i + 1}`, ax + 10, ay + 20);
            }
        }

        // Betting Footer
        const footerY = this.screenH - 100;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, footerY - 50, this.screenW, 150);

        // APOSTA Label
        ctx.fillStyle = '#aaa';
        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText("APOSTA:", cx - 180, footerY + 5);

        // Bet Amount (Large Yellow)
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 54px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 204, 0, 0.4)';
        ctx.fillText(`R$ ${this.bichoBet}`, cx - 160, footerY + 20);
        ctx.shadowBlur = 0;

        // Action Hints (Right Side)
        ctx.fillStyle = '#fff';
        ctx.font = '600 14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("[+/-] Ajustar Valor", cx + 180, footerY - 15);
        ctx.fillText("[SETAS] Escolher Bicho", cx + 180, footerY + 10);
        ctx.fillText("[ESPAÇO] CONFIRMAR", cx + 180, footerY + 35);

        // Feedback Message
        if (this.bichoMessage) {
            ctx.save();
            ctx.translate(cx, footerY + 60);
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.roundRect(-300, -25, 600, 50, 25);
            ctx.fill();

            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.bichoMessage, 0, 8);
            ctx.restore();
        }
    }
}
