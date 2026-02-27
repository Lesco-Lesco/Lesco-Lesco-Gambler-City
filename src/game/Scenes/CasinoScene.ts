/**
 * CasinoScene — cassino clandestino subterrâneo abaixo do Shopping Santa Cruz.
 * Tema: neon, luzes pulsantes, máquinas caça-níquel e Jogo do Bicho.
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
import { BlackjackGame } from '../MiniGames/BlackjackGame';
import { BlackjackUI } from '../MiniGames/BlackjackUI';
import { PokerGame } from '../MiniGames/PokerGame';
import { PokerUI } from '../MiniGames/PokerUI';

/** Objeto visual de uma máquina no cassino (slot ou bicho) */
interface CasinoMachine {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    glowColor: string;
    glowPhase: number;
    type: 'slot' | 'bicho' | 'blackjack' | 'poker';
    theme?: SlotTheme;
}

/** Estado da cena do cassino */
type CasinoState = 'floor' | 'slot' | 'bicho' | 'blackjack' | 'poker';

export class CasinoScene implements Scene {
    public name = 'casino';

    private type: 'shopping' | 'station';
    private screenW: number;
    private screenH: number;
    private input: InputManager;

    // Salão do cassino
    private machines: CasinoMachine[] = [];
    private selectedMachine: number = 0;
    private state: CasinoState = 'floor';

    // Mini-jogos
    private slotMachine: SlotMachine;
    private blackjack: { game: BlackjackGame, ui: BlackjackUI } | null = null;
    private poker: { game: PokerGame, ui: PokerUI } | null = null;

    // Dados compartilhados com ExplorationScene via BichoManager
    public gameHour: number = 20;
    public currentInGameTime: number = 0;

    // Efeitos visuais
    private time: number = 0;
    private flashLights: { x: number; y: number; r: number; g: number; b: number; speed: number; phase: number }[] = [];
    private particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }[] = [];

    // Estado da UI do slot
    private slotBet: number = 10;
    private slotSpinning: boolean = false;
    private slotResult: SlotResult | null = null;
    private slotReels: number[] = [0, 0, 0];
    private slotSpinTimer: number = 0;

    // Estado da UI do bicho
    private bichoSelectedAnimal: number = 0;
    private bichoBet: number = 10;
    private bichoMessage: string = '';
    private bichoPendingBets: { animal: number; amount: number }[] = [];

    // Callbacks de transição
    public onSceneExitRequest?: () => void;
    public onGameOver?: () => void;
    private hud: HUD = new HUD();

    constructor(screenW: number, screenH: number, type: 'shopping' | 'station' = 'shopping') {
        this.screenW = screenW;
        this.screenH = screenH;
        this.type = type;
        this.input = InputManager.getInstance();
        this.slotMachine = new SlotMachine();

        if (this.type === 'station') {
            const bjGame = new BlackjackGame();
            this.blackjack = { game: bjGame, ui: new BlackjackUI(bjGame, () => this.state = 'floor') };
            const pkGame = new PokerGame();
            this.poker = { game: pkGame, ui: new PokerUI(pkGame, () => this.state = 'floor') };
        }

        this.rebuildLayout();
    }

    /** Reconstrói posições das máquinas e luzes com base no tamanho da tela */
    private rebuildLayout() {
        const s = UIScale.s.bind(UIScale);
        this.machines = [];
        this.flashLights = [];
        this.particles = [];

        const themes: SlotTheme[] = ['fruits', 'animals', 'shapes', 'food', 'ocean', 'space'];

        const items: ('slot' | 'bicho' | 'blackjack' | 'poker')[] = [];
        if (this.type === 'shopping') {
            themes.forEach(() => items.push('slot'));
            items.push('bicho');
        } else {
            items.push('blackjack');
            items.push('poker');
        }

        const cols = items.length <= 3 ? items.length : 3;
        const totalItems = items.length;
        const rows = Math.ceil(totalItems / cols);

        // Máquina proporcional à tela
        const machineW = Math.min(s(160), this.screenW / cols * 0.65);
        const machineH = machineW * 1.25;

        const spacingX = this.screenW / cols;
        void (rows * machineH + (rows - 1) * s(20)); // gridH só usado via spacingY
        // Espaço vertical seguro: abaixo do HUD (s(60)) e acima do rodapé (s(30))
        const availH = this.screenH - s(90);
        const spacingY = Math.min(machineH + s(30), availH / rows);

        const gridH = (rows - 1) * spacingY + machineH;
        const startY = s(60) + (availH - gridH) / 2;

        for (let r = 0; r < rows; r++) {
            const itemsInRow = Math.min(cols, totalItems - r * cols);
            const rowW = (itemsInRow - 1) * spacingX + machineW;
            const startX = (this.screenW - rowW) / 2;

            for (let c = 0; c < itemsInRow; c++) {
                const idx = r * cols + c;
                const mX = startX + c * spacingX;
                const mY = startY + r * spacingY;

                if (items[idx] === 'slot') {
                    // Máquina caça-níquel
                    this.machines.push({
                        x: mX, y: mY,
                        width: machineW, height: machineH,
                        color: `hsl(${(idx * 60) % 360}, 70%, 28%)`,
                        glowColor: ['#ff66cc', '#ffdd00', '#00ccff', '#ff6600', '#66ffcc', '#cc66ff'][idx] || '#ff66cc',
                        glowPhase: (idx / totalItems) * Math.PI * 2,
                        type: 'slot',
                        theme: themes[idx]
                    });
                } else if (items[idx] === 'bicho') {
                    const extraW = machineW * 0.15;
                    const extraH = machineH * 0.15;
                    this.machines.push({
                        x: mX - extraW / 2, y: mY - extraH / 2,
                        width: machineW + extraW, height: machineH + extraH,
                        color: '#0d3d18', glowColor: '#44ff88', glowPhase: 0, type: 'bicho'
                    });
                } else if (items[idx] === 'blackjack') {
                    this.machines.push({
                        x: mX, y: mY,
                        width: machineW * 1.8, height: machineH,
                        color: '#1a4a1a', glowColor: '#daa520', glowPhase: 0, type: 'blackjack'
                    });
                } else if (items[idx] === 'poker') {
                    this.machines.push({
                        x: mX, y: mY,
                        width: machineW * 1.8, height: machineH,
                        color: '#0a3a0a', glowColor: '#ffee44', glowPhase: 0, type: 'poker'
                    });
                }
            }
        }

        // Luzes de teto — suaves, menos saturadas, ritmos variados
        const lightColors: [number, number, number][] = [
            [255, 100, 200],
            [255, 220, 50],
            [50, 200, 255],
            [200, 100, 255],
            [80, 255, 180],
        ];
        for (let i = 0; i < 30; i++) {
            const [lr, lg, lb] = lightColors[i % lightColors.length];
            this.flashLights.push({
                x: (i / 30) * this.screenW + Math.sin(i * 2.3) * 50,
                y: Math.random() * s(80),
                r: lr, g: lg, b: lb,
                speed: 0.4 + Math.random() * 0.8, // bem mais lento
                phase: (i / 30) * Math.PI * 2,
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

        // Atualiza partículas
        this.updateParticles(dt);

        const bmanager = BichoManager.getInstance();
        bmanager.update(dt);

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
        } else if (this.state === 'blackjack' && this.blackjack) {
            this.blackjack.ui.update(dt);
        } else if (this.state === 'poker' && this.poker) {
            this.poker.ui.update(dt);
        }

        if (this.input.wasPressed('Escape') && this.state === 'floor') {
            if (this.onSceneExitRequest) this.onSceneExitRequest();
        }
        if (this.input.wasPressed('Escape') && this.state !== 'floor') {
            this.state = 'floor';
            this.slotResult = null;
        }
    }

    private updateParticles(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 40 * dt; // gravidade leve
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    private spawnWinParticles(cx: number, cy: number) {
        const colors = ['#ffdd00', '#ff66cc', '#00ccff', '#44ff88', '#ffffff'];
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 180;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 120,
                life: 1.2 + Math.random() * 0.6,
                maxLife: 1.8,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }
    }

    private updateFloor() {
        const cols = 3;
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
            } else if (m.type === 'blackjack') {
                this.state = 'blackjack';
            } else if (m.type === 'poker') {
                this.state = 'poker';
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
                Math.floor(this.time * (12 + i * 4)) % symbols.length
            );
            if (this.slotSpinTimer <= 0) {
                this.slotSpinning = false;
                const bmanager = BichoManager.getInstance();
                this.slotResult = this.slotMachine.spin(this.slotBet, theme);
                this.slotReels = this.slotResult.reels;
                bmanager.playerMoney += this.slotResult.payout - this.slotBet;
                if (this.slotResult.payout > 0) {
                    this.spawnWinParticles(this.screenW / 2, this.screenH / 2);
                }
            }
        } else {
            const bmanager = BichoManager.getInstance();
            const limits = bmanager.getBetLimits();
            const step = limits.max > 10000 ? 500 : limits.max > 1000 ? 100 : 10;

            if (this.input.wasPressed('ArrowUp')) {
                this.slotBet = Math.min(this.slotBet + step, bmanager.playerMoney, limits.max);
            }
            if (this.input.wasPressed('ArrowDown')) {
                this.slotBet = Math.max(this.slotBet - step, limits.min);
            }
            const okPressed = this.input.wasPressed('Enter') || this.input.wasPressed('Space');
            if (okPressed && bmanager.playerMoney >= this.slotBet) {
                this.slotSpinning = true;
                this.slotSpinTimer = 1.5;
                this.slotResult = null;
            }
        }
    }

    private updateBicho() {
        if (this.input.wasPressed('ArrowRight')) this.bichoSelectedAnimal = Math.min(this.bichoSelectedAnimal + 1, 24);
        if (this.input.wasPressed('ArrowLeft')) this.bichoSelectedAnimal = Math.max(this.bichoSelectedAnimal - 1, 0);
        if (this.input.wasPressed('ArrowDown')) this.bichoSelectedAnimal = Math.min(this.bichoSelectedAnimal + 5, 24);
        if (this.input.wasPressed('ArrowUp')) this.bichoSelectedAnimal = Math.max(this.bichoSelectedAnimal - 5, 0);

        const bmanager = BichoManager.getInstance();
        const limits = bmanager.getBetLimits();
        const step = limits.max > 10000 ? 500 : limits.max > 1000 ? 100 : 10;

        const isShift = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
        const adjustUp = this.input.wasPressed('Equal') || this.input.wasPressed('NumpadAdd') || (isShift && this.input.wasPressed('ArrowUp'));
        const adjustDown = this.input.wasPressed('Minus') || this.input.wasPressed('NumpadSubtract') || (isShift && this.input.wasPressed('ArrowDown'));

        if (adjustUp) this.bichoBet = Math.min(this.bichoBet + step, bmanager.playerMoney, limits.max);
        if (adjustDown) this.bichoBet = Math.max(this.bichoBet - step, limits.min);

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

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────

    public render(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);

        // ── Garantia: reset de estado do canvas a cada frame ──
        // Evita que globalAlpha ou compositeOperation vazem entre frames ou cenas
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;

        // Fundo + efeitos de ambiente
        this.drawBackground(ctx);
        this.drawNeonGrid(ctx);
        this.drawCeilingLights(ctx);

        // Conteúdo da cena
        if (this.state === 'floor') {
            this.renderFloor(ctx);
        } else if (this.state === 'slot') {
            this.renderSlotUI(ctx);
        } else if (this.state === 'bicho') {
            this.renderBichoUI(ctx);
        } else if (this.state === 'blackjack' && this.blackjack) {
            this.blackjack.ui.render(ctx, this.screenW, this.screenH);
        } else if (this.state === 'poker' && this.poker) {
            this.poker.ui.render(ctx, this.screenW, this.screenH);
        }

        // Partículas de vitória
        this.renderParticles(ctx);

        // ── HUD: dinheiro e notificações ──
        // Renderizado por último para estar sempre sobre os mini-jogos
        const bmanager = BichoManager.getInstance();
        this.hud.render(
            ctx, this.screenW, this.screenH,
            bmanager.playerMoney,
            -1, -1, -1, // Hide stamina/fps in casino
            null
        );

        // Notificações globais
        this.hud.renderNotifications(ctx, this.screenW, bmanager.getNotifications());

        // ── HUD: dica de saída (canto superior direito) ──
        const mobile = isMobile();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${UIScale.r(10)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'right';
        const exitHint = mobile
            ? '[✕] SAIR'
            : (this.state === 'floor' ? '[ESC] Sair do cassino' : '[ESC] Voltar');
        ctx.fillText(exitHint, this.screenW - s(16), s(28));
        ctx.shadowBlur = 0;
    }

    private renderParticles(ctx: CanvasRenderingContext2D) {
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, UIScale.s(4), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ─────────────────────────────────────────────────────────────
    // EFEITOS DE FUNDO
    // ─────────────────────────────────────────────────────────────

    private drawBackground(ctx: CanvasRenderingContext2D) {
        // Gradiente escuro — roxo profundo para preto
        const grad = ctx.createLinearGradient(0, 0, 0, this.screenH);
        grad.addColorStop(0, '#0d0414');
        grad.addColorStop(1, '#040108');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Estrelas suaves (estáticas, sem movimento brusco)
        for (let i = 0; i < 80; i++) {
            const px = ((Math.sin(i * 137.5) * 0.5 + 0.5) * this.screenW);
            const py = ((Math.cos(i * 259.1) * 0.5 + 0.5) * this.screenH);
            const twinkle = Math.sin(this.time * (0.5 + (i % 7) * 0.15) + i) * 0.3 + 0.5;
            const radius = UIScale.s(1.0 + (i % 3) * 0.5);
            const hue = [300, 200, 60][i % 3]; // rosa, azul, amarelo
            ctx.fillStyle = `hsla(${hue}, 90%, 90%, ${twinkle * 0.9})`;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawNeonGrid(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const size = s(80);
        const pulse = Math.sin(this.time * 0.8) * 0.06 + 0.18; // visível mas não dominante

        ctx.strokeStyle = `rgba(180, 80, 255, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        for (let y = 0; y < this.screenH; y += size) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.screenW, y); ctx.stroke();
        }
        for (let x = 0; x < this.screenW; x += size) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.screenH); ctx.stroke();
        }
    }

    private drawCeilingLights(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        ctx.globalAlpha = 1;
        for (const light of this.flashLights) {
            const intensity = Math.sin(this.time * light.speed + light.phase) * 0.5 + 0.5;
            const alpha = 0.12 + intensity * 0.28; // mais visível — efeito de luz real
            const radius = s(70) + intensity * s(40);

            const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
            grad.addColorStop(0, `rgba(${light.r}, ${light.g}, ${light.b}, ${alpha})`);
            grad.addColorStop(1, `rgba(${light.r}, ${light.g}, ${light.b}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // SALÃO DO CASSINO (FLOOR)
    // ─────────────────────────────────────────────────────────────

    private renderFloor(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const cx = this.screenW / 2;

        // Título do salão
        ctx.shadowBlur = s(20);
        ctx.shadowColor = '#cc44ff';
        ctx.fillStyle = '#ee99ff';
        ctx.font = `bold ${UIScale.r(mobile ? 14 : 20)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const title = this.type === 'station' ? 'CASSINO DA ESTAÇÃO' : 'CASSINO CLANDESTINO';
        ctx.fillText(title, cx, s(mobile ? 36 : 48));
        ctx.shadowBlur = 0;

        // Máquinas
        this.machines.forEach((m, idx) => {
            const isSelected = idx === this.selectedMachine;
            const glowPulse = Math.sin(this.time * 1.5 + m.glowPhase) * 0.5 + 0.5;

            // ── Corpo sólido ──
            // Gradiente vertical para dar volume à máquina
            const bodyGrad = ctx.createLinearGradient(m.x, m.y, m.x, m.y + m.height);
            bodyGrad.addColorStop(0, m.color);

            let bottomColor = '#000';
            if (m.type === 'bicho') {
                bottomColor = '#061806';
            } else if (m.type === 'slot') {
                const hueMatch = m.color.match(/\d+/);
                const hue = hueMatch ? hueMatch[0] : '0';
                bottomColor = `hsl(${hue}, 50%, 12%)`;
            } else {
                bottomColor = 'rgba(0,0,0,0.5)';
            }
            bodyGrad.addColorStop(1, bottomColor);

            ctx.fillStyle = bodyGrad;
            ctx.shadowBlur = isSelected ? s(24) : s(6) + glowPulse * s(8);
            ctx.shadowColor = m.glowColor;
            ctx.fillRect(m.x, m.y, m.width, m.height);
            ctx.shadowBlur = 0;

            // ── Borda neon espessa ──
            ctx.strokeStyle = m.glowColor;
            ctx.lineWidth = s(isSelected ? 4 : 3);
            ctx.shadowBlur = isSelected ? s(18) : s(6);
            ctx.shadowColor = m.glowColor;
            ctx.strokeRect(m.x, m.y, m.width, m.height);
            ctx.shadowBlur = 0;

            // ── Seleção: destaque extra ──
            if (isSelected) {
                const bounce = Math.sin(this.time * 6) * s(4);
                ctx.shadowBlur = s(14);
                ctx.shadowColor = '#fff';
                ctx.fillStyle = '#ffffff';
                ctx.font = `${UIScale.r(mobile ? 14 : 18)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('▼', m.x + m.width / 2, m.y - s(6) + bounce);
                ctx.shadowBlur = 0;
            }

            if (m.type === 'slot') {
                // ── Painel da tela (visível) ──
                const scrX = m.x + s(6);
                const scrY = m.y + s(14);
                const scrW = m.width - s(12);
                const scrH = m.height * 0.50;

                // Painel azul escuro — legível contra o corpo colorido
                ctx.fillStyle = '#0a0a1e';
                ctx.fillRect(scrX, scrY, scrW, scrH);
                // Borda da tela em branco
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = s(1);
                ctx.strokeRect(scrX, scrY, scrW, scrH);

                // Emoji temático centralizado na tela
                const theme = m.theme;
                const previewSymbol = theme ? SlotMachine.THEMES[theme].symbols[0] : '❓';
                const emojiSize = Math.floor(Math.min(scrH * 0.75, scrW * 0.55));
                ctx.font = `${emojiSize}px "Segoe UI Emoji", Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(previewSymbol, scrX + scrW / 2, scrY + scrH / 2);
                ctx.textBaseline = 'alphabetic';

                // Bolinhas laterais pulsantes
                for (let side = 0; side < 2; side++) {
                    const lx = side === 0 ? m.x + s(3) : m.x + m.width - s(3);
                    for (let b = 0; b < 5; b++) {
                        const ly = m.y + s(18) + b * (m.height * 0.10);
                        const bPhase = Math.sin(this.time * 4 + b * 1.2 + side * 1.8 + idx * 0.4) * 0.5 + 0.5;
                        ctx.fillStyle = bPhase > 0.5 ? m.glowColor : 'rgba(255,255,255,0.2)';
                        ctx.shadowBlur = bPhase > 0.5 ? s(6) : 0;
                        ctx.shadowColor = m.glowColor;
                        ctx.beginPath();
                        ctx.arc(lx, ly, s(2.5), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }

                // Nome do tema — abaixo da tela, em branco
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = s(6);
                ctx.shadowColor = m.glowColor;
                ctx.font = `bold ${UIScale.r(mobile ? 7 : 9)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(m.theme?.toUpperCase() || '', m.x + m.width / 2, m.y + m.height - s(8));
                ctx.shadowBlur = 0;

            } else if (m.type === 'blackjack') {
                // Mesa de Blackjack
                ctx.fillStyle = '#1a4a1a';
                ctx.fillRect(m.x, m.y, m.width, m.height);
                ctx.strokeStyle = m.glowColor;
                ctx.strokeRect(m.x, m.y, m.width, m.height);

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P"`;
                ctx.fillText('BLACKJACK', m.x + m.width / 2, m.y + s(30));
                ctx.font = `32px Arial`;
                ctx.fillText('🃏', m.x + m.width / 2, m.y + m.height * 0.7);
            } else if (m.type === 'poker') {
                // Mesa de Poker
                ctx.fillStyle = '#0a3a0a';
                ctx.fillRect(m.x, m.y, m.width, m.height);
                ctx.strokeStyle = m.glowColor;
                ctx.strokeRect(m.x, m.y, m.width, m.height);

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${UIScale.r(10)}px "Press Start 2P"`;
                ctx.fillText('TEXAS HOLDEM', m.x + m.width / 2, m.y + s(30));
                ctx.font = `32px Arial`;
                ctx.fillText('🎴', m.x + m.width / 2, m.y + m.height * 0.7);
            } else {
                // ── Banca do Bicho ──
                ctx.shadowBlur = s(10);
                ctx.shadowColor = '#44ff88';
                ctx.fillStyle = '#aaffcc';
                ctx.font = `bold ${UIScale.r(mobile ? 11 : 14)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('JOGO DO', m.x + m.width / 2, m.y + s(mobile ? 20 : 26));
                ctx.fillText('BICHO', m.x + m.width / 2, m.y + s(mobile ? 33 : 43));
                ctx.shadowBlur = 0;

                const emojiSize2 = Math.floor(Math.min(m.height * 0.35, m.width * 0.5));
                ctx.font = `${emojiSize2}px "Segoe UI Emoji", Arial`;
                ctx.textBaseline = 'middle';
                ctx.fillText('🐴', m.x + m.width / 2, m.y + m.height * 0.75);
                ctx.textBaseline = 'alphabetic';
            }
        });

        // Dica de navegação (rodapé)
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#cccccc';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const hint = mobile
            ? '[D-Pad] Navegar  [OK] Entrar'
            : '[WASD/Setas] Navegar  [E/Enter] Entrar';
        ctx.fillText(hint, cx, this.screenH - s(12));
    }

    // ─────────────────────────────────────────────────────────────
    // CAÇA-NÍQUEL (SLOT UI)
    // ─────────────────────────────────────────────────────────────

    private renderSlotUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const cx = this.screenW / 2;
        const machine = this.machines[this.selectedMachine];
        const theme = machine.theme;
        if (!theme) return;
        const symbols = SlotMachine.THEMES[theme].symbols;

        // Fundo sólido (substitui o fundo animado para foco)
        const bgGrad = ctx.createLinearGradient(0, 0, this.screenW, this.screenH);
        bgGrad.addColorStop(0, '#100820');
        bgGrad.addColorStop(1, '#040108');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Borda neon da máquina (ao redor da tela toda)
        const borderPulse = Math.sin(this.time * 1.5) * 0.3 + 0.7;
        ctx.strokeStyle = machine.glowColor;
        ctx.lineWidth = s(5);
        ctx.shadowBlur = s(20);
        ctx.shadowColor = machine.glowColor;
        ctx.globalAlpha = borderPulse * 0.8;
        ctx.strokeRect(s(10), s(10), this.screenW - s(20), this.screenH - s(20));
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // ── Título ──
        ctx.shadowBlur = s(16);
        ctx.shadowColor = machine.glowColor;
        ctx.fillStyle = machine.glowColor;
        ctx.font = `${UIScale.r(mobile ? 16 : 20)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${theme.toUpperCase()} SLOTS`, cx, s(mobile ? 50 : 60));
        ctx.shadowBlur = 0;

        // ── Área dos rolos ──
        const reelAreaW = Math.min(this.screenW * 0.85, s(600));
        const reelAreaH = this.screenH * (mobile ? 0.38 : 0.36);
        const reelTop = s(mobile ? 80 : 90);
        const reelBottom = reelTop + reelAreaH;
        const reelCenterY = reelTop + reelAreaH / 2;

        // Moldura dos rolos — painel escuro com borda visível
        ctx.fillStyle = '#1a1030';
        ctx.beginPath();
        ctx.roundRect(cx - reelAreaW / 2, reelTop, reelAreaW, reelAreaH, s(12));
        ctx.fill();

        ctx.strokeStyle = machine.glowColor;
        ctx.lineWidth = s(3);
        ctx.shadowBlur = s(10);
        ctx.shadowColor = machine.glowColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Linha de pagamento (win line) — sutil
        const lineY = reelCenterY;
        ctx.strokeStyle = `rgba(255, 255, 100, 0.25)`;
        ctx.lineWidth = s(2);
        ctx.setLineDash([s(6), s(4)]);
        ctx.beginPath();
        ctx.moveTo(cx - reelAreaW / 2 + s(8), lineY);
        ctx.lineTo(cx + reelAreaW / 2 - s(8), lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rolos
        const colW = reelAreaW / 3;
        for (let i = 0; i < 3; i++) {
            const reelX = cx - reelAreaW / 2 + i * colW + colW / 2;
            const sym = symbols[this.slotReels[i]];
            const reelLeft = cx - reelAreaW / 2 + i * colW;

            // Fundo de cada rolo — painel escuro com leve cor distinta
            ctx.fillStyle = i % 2 === 0 ? '#0d0d22' : '#12101e';
            ctx.fillRect(reelLeft + s(2), reelTop + s(2), colW - s(4), reelAreaH - s(4));

            // Emoji do símbolo — fillStyle DEVE ser definido antes de emojis
            const symSize = Math.floor(Math.min(UIScale.r(mobile ? 68 : 80), reelAreaH * 0.7, colW * 0.75));
            ctx.font = `${symSize}px "Segoe UI Emoji", "Apple Color Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff'; // obrigatório antes de qualquer fillText de emoji

            if (this.slotSpinning) {
                // Símbolos adjacentes com blur simulado (mais visíveis que antes)
                ctx.globalAlpha = 0.45;
                ctx.fillText(symbols[(this.slotReels[i] + 1) % symbols.length], reelX, reelCenterY - symSize * 0.85);
                ctx.fillText(symbols[(this.slotReels[i] + symbols.length - 1) % symbols.length], reelX, reelCenterY + symSize * 0.85);
                ctx.globalAlpha = 1;
            }

            // Símbolo principal — totalmente opaco, centralizado no painel
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1;
            ctx.fillText(sym, reelX, reelCenterY);
            ctx.textBaseline = 'alphabetic';

            // Divisor entre rolos
            if (i < 2) {
                ctx.strokeStyle = machine.glowColor;
                ctx.globalAlpha = 0.4;
                ctx.lineWidth = s(1.5);
                ctx.beginPath();
                ctx.moveTo(reelLeft + colW, reelTop + s(8));
                ctx.lineTo(reelLeft + colW, reelBottom - s(8));
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // ── Área de aposta ──
        const betAreaY = reelBottom + s(mobile ? 18 : 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = `${UIScale.r(mobile ? 9 : 10)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('APOSTA ATUAL', cx, betAreaY);

        ctx.fillStyle = '#fff';
        ctx.font = `${UIScale.r(mobile ? 28 : 36)}px "Press Start 2P", monospace`;
        ctx.shadowBlur = s(12);
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.fillText(`R$ ${this.slotBet}`, cx, betAreaY + s(mobile ? 32 : 40));
        ctx.shadowBlur = 0;

        // ── Botão GIRAR ──
        const btnW = Math.min(this.screenW * 0.55, s(320));
        const btnH = s(mobile ? 52 : 58);
        const btnX = cx - btnW / 2;
        const btnY = betAreaY + s(mobile ? 52 : 62);

        if (!this.slotSpinning) {
            const btnGrad = ctx.createLinearGradient(0, btnY, 0, btnY + btnH);
            btnGrad.addColorStop(0, '#ff3366');
            btnGrad.addColorStop(1, '#aa1133');
            ctx.fillStyle = btnGrad;
            ctx.shadowBlur = s(16);
            ctx.shadowColor = '#ff3366';
        } else {
            ctx.fillStyle = '#2a2a2a';
            ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, s(28));
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = this.slotSpinning ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = s(1.5);
        ctx.stroke();

        ctx.fillStyle = this.slotSpinning ? '#666' : '#fff';
        ctx.font = `${UIScale.r(mobile ? 13 : 15)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.slotSpinning ? 'RODANDO...' : 'GIRAR!', cx, btnY + btnH / 2);
        ctx.textBaseline = 'alphabetic';

        // ── Dicas de controles ──
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = `${UIScale.r(8)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(mobile ? '[↑/↓] Aposta' : '[Setas ↑↓] Aposta', s(16), this.screenH - s(12));
        ctx.textAlign = 'right';
        ctx.fillText(mobile ? '[OK] Girar' : '[Enter/Espaço] Girar', this.screenW - s(16), this.screenH - s(12));

        // ── Overlay de resultado ──
        if (this.slotResult) {
            const netGain = this.slotResult.payout - this.slotBet;
            const isWin = netGain > 0;
            const isTie = netGain === 0 && this.slotResult.payout > 0; // dois iguais: recuperou a aposta
            const resultColor = isWin ? '#44ff88' : (isTie ? '#ffcc00' : '#ff4455');
            const boxW = Math.min(this.screenW * 0.8, s(520));
            const boxH = s(mobile ? 160 : 190);
            const boxX = cx - boxW / 2;
            const boxY = this.screenH / 2 - boxH / 2;

            ctx.fillStyle = 'rgba(0,0,0,0.92)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, s(16));
            ctx.fill();

            ctx.strokeStyle = resultColor;
            ctx.lineWidth = s(3);
            ctx.shadowBlur = s(20);
            ctx.shadowColor = resultColor;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = resultColor;
            ctx.textAlign = 'center';

            if (this.slotResult.isJackpot) {
                ctx.font = `${UIScale.r(mobile ? 14 : 16)}px "Press Start 2P", monospace`;
                ctx.fillText('🎰 JACKPOT! 🎰', cx, boxY + s(mobile ? 45 : 55));
                ctx.font = `${UIScale.r(mobile ? 16 : 20)}px "Press Start 2P", monospace`;
                ctx.fillText(`+R$ ${netGain}`, cx, boxY + s(mobile ? 100 : 115));
            } else if (isWin) {
                ctx.font = `${UIScale.r(mobile ? 13 : 15)}px "Press Start 2P", monospace`;
                ctx.fillText('PARABÉNS!', cx, boxY + s(mobile ? 48 : 58));
                ctx.font = `${UIScale.r(mobile ? 16 : 20)}px "Press Start 2P", monospace`;
                ctx.fillText(`+R$ ${netGain}`, cx, boxY + s(mobile ? 100 : 115));
            } else if (isTie) {
                ctx.font = `${UIScale.r(mobile ? 12 : 14)}px "Press Start 2P", monospace`;
                ctx.fillText('RECUPEROU!', cx, boxY + s(mobile ? 48 : 58));
                ctx.font = `${UIScale.r(mobile ? 12 : 14)}px "Press Start 2P", monospace`;
                ctx.fillStyle = 'rgba(255,204,0,0.6)';
                ctx.fillText('DOIS IGUAIS — aposta devolvida', cx, boxY + s(mobile ? 100 : 115));
            } else {
                ctx.font = `${UIScale.r(mobile ? 12 : 14)}px "Press Start 2P", monospace`;
                ctx.fillText('NÃO FOI DESSA VEZ...', cx, boxY + s(mobile ? 52 : 62));
                ctx.fillStyle = 'rgba(255,60,80,0.7)';
                ctx.font = `${UIScale.r(mobile ? 14 : 18)}px "Press Start 2P", monospace`;
                ctx.fillText(`-R$ ${this.slotBet}`, cx, boxY + s(mobile ? 105 : 120));
            }

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = `${UIScale.r(8)}px "Press Start 2P", monospace`;
            ctx.fillText(mobile ? '[OK] Novamente  [✕] Sair' : '[Enter] Novamente  [ESC] Sair', cx, boxY + boxH - s(18));
        }
    }

    // ─────────────────────────────────────────────────────────────
    // JOGO DO BICHO (BICHO UI)
    // ─────────────────────────────────────────────────────────────

    private renderBichoUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const cx = this.screenW / 2;

        // Fundo feltro verde escuro
        const bgGrad = ctx.createLinearGradient(0, 0, 0, this.screenH);
        bgGrad.addColorStop(0, '#031a08');
        bgGrad.addColorStop(1, '#010d04');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Borda dourada suave
        const borderPulse = Math.sin(this.time * 1.0) * 0.2 + 0.6;
        ctx.strokeStyle = `rgba(255, 220, 50, ${borderPulse * 0.5})`;
        ctx.lineWidth = s(3);
        ctx.beginPath();
        ctx.roundRect(s(10), s(10), this.screenW - s(20), this.screenH - s(20), s(8));
        ctx.stroke();

        // ── Título ──
        ctx.shadowBlur = s(20);
        ctx.shadowColor = '#ffcc00';
        ctx.fillStyle = '#ffdd44';
        ctx.font = `${UIScale.r(mobile ? 13 : 16)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('JOGO DO BICHO - FEDERAL', cx, s(mobile ? 44 : 52));
        ctx.shadowBlur = 0;

        // ── Grid de animais ──
        const footerH = s(mobile ? 90 : 110);
        const titleH = s(mobile ? 60 : 72);
        const padding = s(mobile ? 12 : 20);

        const gridW = this.screenW - padding * 2;
        const gridH = this.screenH - titleH - footerH - padding;
        const cellW = gridW / 5;
        const cellH = gridH / 5;
        const gridStartX = padding;
        const gridStartY = titleH;

        const groupColors = [
            '#3d0a0a',   // vermelho escuro sólido
            '#0a3d14',   // verde escuro sólido
            '#0a1a3d',   // azul escuro sólido
            '#3d300a',   // amarelo escuro sólido
            '#2a0a3d',   // roxo escuro sólido
        ];
        const groupBorderColors = [
            '#ff6666',   // vermelho brilhante
            '#66ff88',   // verde brilhante
            '#6699ff',   // azul brilhante
            '#ffdd44',   // amarelo brilhante
            '#cc66ff',   // roxo brilhante
        ];

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const i = row * 5 + col;
                const animal = JogoDoBicho.ANIMALS[i];
                const isSelected = i === this.bichoSelectedAnimal;
                const ax = gridStartX + col * cellW;
                const ay = gridStartY + row * cellH;
                const cellPad = s(4);

                ctx.beginPath();
                ctx.roundRect(ax + cellPad, ay + cellPad, cellW - cellPad * 2, cellH - cellPad * 2, s(6));

                const groupIdx = Math.floor(i / 5);

                if (isSelected) {
                    const selPulse = Math.sin(this.time * 4) * 0.15 + 0.85;
                    ctx.fillStyle = `rgba(255, 220, 50, ${selPulse * 0.5})`;
                    ctx.shadowBlur = s(16);
                    ctx.shadowColor = '#ffcc00';
                } else {
                    ctx.fillStyle = groupColors[groupIdx] || '#1a1a1a';
                    ctx.shadowBlur = 0;
                }
                ctx.fill();

                // Borda vistosa por grupo
                const borderColor = isSelected ? '#ffcc00' : (groupBorderColors[groupIdx] || '#ffffff');
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = isSelected ? s(2.5) : s(1.5);
                ctx.shadowBlur = isSelected ? s(10) : s(4);
                ctx.shadowColor = borderColor;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Emoji do animal
                const emojiSize = Math.floor(Math.min(cellH * 0.52, cellW * 0.52));
                ctx.font = `${emojiSize}px "Segoe UI Emoji", Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(animal.emoji, ax + cellW / 2, ay + cellH * 0.42);
                ctx.textBaseline = 'alphabetic';

                // Nome do animal — cor do grupo, brilhante e legível
                const borderColor2 = isSelected ? '#ffee66' : (groupBorderColors[groupIdx] || '#ffffff');
                ctx.fillStyle = borderColor2;
                ctx.shadowBlur = isSelected ? s(6) : s(3);
                ctx.shadowColor = borderColor2;
                const nameSize = Math.max(UIScale.r(mobile ? 7 : 8), Math.floor(cellH * 0.13));
                ctx.font = `bold ${nameSize}px "Press Start 2P", monospace`;
                ctx.fillText(animal.name.toUpperCase(), ax + cellW / 2, ay + cellH * 0.82);
                ctx.shadowBlur = 0;

                // Número do bicho — cor do grupo
                ctx.fillStyle = groupBorderColors[groupIdx] || '#aaaaaa';
                ctx.shadowBlur = 0;
                ctx.font = `bold ${UIScale.r(mobile ? 7 : 8)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'left';
                ctx.fillText(`${i + 1}`, ax + s(mobile ? 5 : 6), ay + s(mobile ? 13 : 15));
            }
        }

        // ── Rodapé de apostas ──
        const footerY = this.screenH - footerH;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, footerY, this.screenW, footerH);

        ctx.strokeStyle = 'rgba(255,220,50,0.2)';
        ctx.lineWidth = s(1);
        ctx.beginPath();
        ctx.moveTo(0, footerY); ctx.lineTo(this.screenW, footerY);
        ctx.stroke();

        // Aposta
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `${UIScale.r(mobile ? 8 : 9)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('APOSTA', cx, footerY + s(mobile ? 18 : 22));

        ctx.fillStyle = '#ffdd44';
        ctx.font = `${UIScale.r(mobile ? 22 : 28)}px "Press Start 2P", monospace`;
        ctx.shadowBlur = s(12);
        ctx.shadowColor = 'rgba(255, 220, 50, 0.4)';
        ctx.fillText(`R$ ${this.bichoBet}`, cx, footerY + s(mobile ? 42 : 52));
        ctx.shadowBlur = 0;

        // Dicas de controle
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${UIScale.r(7)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(mobile ? '[+/-] Aposta  [Dpad] Animal  [OK] Apostar' : '[+/-] Ajustar Aposta  [Setas] Animal  [Espaço] Apostar',
            s(14), footerY + s(mobile ? 64 : 76));

        // Mensagem de feedback
        if (this.bichoMessage) {
            const msgW = Math.min(this.screenW * 0.7, s(420));
            const msgH = s(38);
            const msgX = cx - msgW / 2;
            const msgY = footerY - msgH - s(6);

            ctx.fillStyle = 'rgba(0,0,0,0.88)';
            ctx.beginPath();
            ctx.roundRect(msgX, msgY, msgW, msgH, s(19));
            ctx.fill();

            ctx.strokeStyle = '#44ff88';
            ctx.lineWidth = s(1.5);
            ctx.stroke();

            ctx.fillStyle = '#44ff88';
            ctx.font = `${UIScale.r(mobile ? 9 : 10)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.bichoMessage, cx, msgY + msgH / 2);
            ctx.textBaseline = 'alphabetic';
        }
    }
}
