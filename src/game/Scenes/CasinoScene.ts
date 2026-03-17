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
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import { AchievementManager } from '../Core/AchievementManager';

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

    private currentCols: number = 3;
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
            this.blackjack = { game: bjGame, ui: new BlackjackUI(bjGame, (p) => this.handleMinigameExit(p)) };
            const pkGame = new PokerGame();
            this.poker = { game: pkGame, ui: new PokerUI(pkGame, (p) => this.handleMinigameExit(p)) };
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

        const mobile = isMobile();
        const isStation = this.type === 'station';
        const totalItems = items.length;

        // Determinar colunas de forma equilibrada (preenche melhor que o automático anterior)
        let cols = 3;
        if (totalItems <= 3) cols = totalItems;
        else if (totalItems === 4) cols = 2; // 2x2 preenche mais o centro
        else if (totalItems <= 6) cols = 3; // 3x2
        else if (totalItems === 7 || totalItems === 8) cols = 4; // 4x2
        else cols = mobile ? 2 : (this.screenW > s(1100) ? 5 : 4);

        this.currentCols = cols;
        const rows = Math.ceil(totalItems / cols);

        // Margens e áreas seguras
        const marginX = s(mobile ? 20 : 60);
        const availW = this.screenW - marginX * 2;
        const availH = this.screenH - s(mobile ? 110 : 150); // Espaço para título e rodapé

        // Espaçamento e colunas fixas
        const gapX = s(mobile ? 15 : 30);
        const gapY = s(mobile ? 30 : 50);

        // Tamanho proporcional à largura disponível
        let machineW = (availW - gapX * (cols - 1)) / cols;

        // Limites de tamanho generosos
        const maxW = isStation ? s(mobile ? 180 : 260) : s(mobile ? 140 : 220); // 220-260 fits arcade style well
        machineW = Math.min(machineW, maxW);

        // Aspect ratio fixo para organização
        let machineH = machineW * (isStation ? 1.2 : 1.35);

        let totalGridH = rows * machineH + (rows - 1) * gapY;

        // Ajuste vertical final se necessário
        if (totalGridH > availH) {
            const scale = availH / (totalGridH + s(10));
            machineW *= scale;
            machineH *= scale;
            totalGridH = rows * machineH + (rows - 1) * gapY;
        }

        // Ponto inicial Y centrado na área segura
        const startY = s(mobile ? 85 : 105) + (availH - totalGridH) / 2;

        for (let r = 0; r < rows; r++) {
            const itemsInRow = Math.min(cols, totalItems - r * cols);
            const rowW = itemsInRow * machineW + (itemsInRow - 1) * gapX;
            const startX = (this.screenW - rowW) / 2;

            for (let c = 0; c < itemsInRow; c++) {
                const idx = r * cols + c;
                const mX = startX + c * (machineW + gapX);
                const mY = startY + r * (machineH + gapY);

                if (items[idx] === 'slot') {
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
                        width: machineW, height: machineH,
                        color: '#1a4a1a', glowColor: '#daa520', glowPhase: 0, type: 'blackjack'
                    });
                } else if (items[idx] === 'poker') {
                    this.machines.push({
                        x: mX, y: mY,
                        width: machineW, height: machineH,
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

        // Sound: casino ambient
        const sm = SoundManager.getInstance();
        sm.fadeOutLoop('ambient_night', 500);
        sm.playLoop('ambient_casino');
        sm.play('door_enter');

        // Reset minigames on re-entry to avoid stale state (like mid-game bets from previous lives)
        if (this.blackjack) this.blackjack.game.reset();
        if (this.poker) this.poker.game.reset();
    }

    public onExit() {
        this.input.popContext();
        const sm = SoundManager.getInstance();
        sm.fadeOutLoop('ambient_casino', 500);
        sm.play('door_exit');

        // Achievement: record casino exit
        AchievementManager.getInstance().recordEstablishmentExit('casino_' + this.type);
    }

    public update(dt: number) {
        this.time += dt;
        this.currentInGameTime += dt;

        // Atualiza partículas
        this.updateParticles(dt);

        const bmanager = BichoManager.getInstance();
        bmanager.update(dt);

        // Check if there are active bets or games in progress
        const isPlayingBlackjack = this.state === 'blackjack' && this.blackjack && this.blackjack.game.phase !== 'betting';
        const isPlayingPoker = this.state === 'poker' && this.poker && this.poker.game.phase !== 'betting';
        const hasActiveBicho = bmanager.hasPendingBets();

        if (bmanager.playerMoney <= 0 && !hasActiveBicho && !this.slotSpinning && !isPlayingBlackjack && !isPlayingPoker) {
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

        if (this.input.wasPressed('Escape')) {
            if (this.state === 'floor') {
                if (this.onSceneExitRequest) this.onSceneExitRequest();
            } else if (this.state === 'blackjack' && this.blackjack) {
                // Escape handled in UI, but just in case
            } else if (this.state === 'poker' && this.poker) {
                // Escape handled in UI
            } else {
                // Slot or Bicho
                this.handleMinigameExit(0);
            }
        }
    }

    private handleMinigameExit(payout: number = 0) {
        const bmanager = BichoManager.getInstance();

        // Specific checks for abandoned games in progress
        if (this.state === 'blackjack' && this.blackjack) {
            if (this.blackjack.game.phase === 'playing' || this.blackjack.game.phase === 'dealer_turn') {
                bmanager.addNotification(`Partida abandonada! Perdeu R$${this.blackjack.game.betAmount}.`, 4);
            }
            this.blackjack.game.reset();
        } else if (this.state === 'poker' && this.poker) {
            if (this.poker.game.phase !== 'betting' && this.poker.game.phase !== 'result') {
                const totalBet = this.poker.game.players[0].currentBet;
                bmanager.addNotification(`Partida abandonada! Perdeu R$${totalBet}.`, 4);
            }
            this.poker.game.reset();
        } else if (this.state === 'slot') {
            if (this.slotSpinning) {
                bmanager.addNotification(`Partida abandonada! Perdeu R$${this.slotBet}.`, 4);
            }
            this.slotSpinning = false;
            this.slotResult = null;
        }

        if (payout > 0) {
            bmanager.playerMoney += payout;
        }

        this.state = 'floor';
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
        const cols = this.currentCols;
        if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            this.selectedMachine = Math.min(this.selectedMachine + 1, this.machines.length - 1);
            SoundManager.getInstance().play('menu_select');
        }
        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            this.selectedMachine = Math.max(this.selectedMachine - 1, 0);
            SoundManager.getInstance().play('menu_select');
        }
        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            this.selectedMachine = Math.min(this.selectedMachine + cols, this.machines.length - 1);
            SoundManager.getInstance().play('menu_select');
        }
        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            this.selectedMachine = Math.max(this.selectedMachine - cols, 0);
            SoundManager.getInstance().play('menu_select');
        }
        if (this.input.wasPressed('KeyE') || this.input.wasPressed('Enter')) {
            SoundManager.getInstance().play('menu_confirm');
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
                bmanager.playerMoney += this.slotResult.payout;
                SoundManager.getInstance().play('slot_stop');
                if (this.slotResult.payout > 0) {
                    this.spawnWinParticles(this.screenW / 2, this.screenH / 2);
                    if (this.slotResult.isJackpot) {
                        SoundManager.getInstance().play('slot_jackpot');
                    } else {
                        SoundManager.getInstance().play('win_small');
                    }
                } else {
                    SoundManager.getInstance().play('lose');
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
                bmanager.playerMoney -= this.slotBet;
                this.slotSpinning = true;
                this.slotSpinTimer = 1.5;
                this.slotResult = null;
                SoundManager.getInstance().play('slot_spin');
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
                SoundManager.getInstance().play('bet_place');
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
        ctx.font = `bold ${UIScale.r(mobile ? 18 : 28)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        const title = this.type === 'station' ? 'CASSINO DA ESTAÇÃO' : 'CASSINO CLANDESTINO';
        ctx.fillText(title, cx, s(mobile ? 40 : 65));
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
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 1;
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

            } else if (m.type === 'blackjack' || m.type === 'poker') {
                // ── Mesa de Cartas (Blackjack / Poker) ──
                const isBlackjack = m.type === 'blackjack';
                const cardLabel = isBlackjack ? 'BLACKJACK' : 'TEXAS HOLDEM';
                const cardEmoji = isBlackjack ? '🃏' : '🎴';

                // Painel interno escuro (como slots)
                const scrX = m.x + s(6);
                const scrY = m.y + s(14);
                const scrW = m.width - s(12);
                const scrH = m.height * 0.50;

                ctx.fillStyle = '#0a0a1e';
                ctx.fillRect(scrX, scrY, scrW, scrH);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = s(1);
                ctx.strokeRect(scrX, scrY, scrW, scrH);

                // Emoji temático escalado dinamicamente
                const emojiSize = Math.floor(Math.min(scrH * 0.75, scrW * 0.55));
                ctx.font = `${emojiSize}px "Segoe UI Emoji", Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 1;
                ctx.fillText(cardEmoji, scrX + scrW / 2, scrY + scrH / 2);
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

                // Nome do jogo
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = s(6);
                ctx.shadowColor = m.glowColor;
                ctx.font = `bold ${UIScale.r(mobile ? 7 : 9)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(cardLabel, m.x + m.width / 2, m.y + m.height - s(8));
                ctx.shadowBlur = 0;
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
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 1;
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
            ? '[D-Pad] Navegar  [E] Entrar'
            : '[WASD/Setas] Navegar  [E/Enter] Entrar';
        ctx.fillText(hint, cx, this.screenH - s(12));
    }

    // ─────────────────────────────────────────────────────────────
    // CAÇA-NÍQUEL (SLOT UI)
    // ─────────────────────────────────────────────────────────────

    private renderSlotUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;
        const machine = this.machines[this.selectedMachine];
        const slotThemeName = machine.theme || 'fruits';
        const theme = MINIGAME_THEMES.slot_machine;
        const symbols = SlotMachine.THEMES[slotThemeName].symbols;

        drawMinigameBackground(ctx, this.screenW, this.screenH, theme);
        drawMinigameTitle(ctx, this.screenW, this.screenH, theme, `${slotThemeName.toUpperCase()} SLOTS`);

        // ── Reel Machine Body ──
        const reelW = Math.min(this.screenW * 0.94, s(mobile ? 320 : 540));
        const reelH = this.screenH * (mobile ? 0.45 : 0.4);
        const reelTop = s(mobile ? 70 : 100);

        // Glass Panel
        ctx.fillStyle = 'rgba(15, 5, 30, 0.75)';
        ctx.beginPath();
        ctx.roundRect(cx - reelW / 2, reelTop, reelW, reelH, s(16));
        ctx.fill();

        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = s(3);
        ctx.shadowBlur = s(15);
        ctx.shadowColor = theme.accent;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Reels
        const colW = reelW / 3;
        const reelCenterY = reelTop + reelH / 2;
        const symSize = r(mobile ? 78 : 84);

        for (let i = 0; i < 3; i++) {
            const rx = cx - reelW / 2 + i * colW;

            // Reel Background
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(rx + s(2), reelTop + s(2), colW - s(4), reelH - s(4));

            const sym = symbols[this.slotReels[i]];
            ctx.font = `${symSize}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1;

            if (this.slotSpinning) {
                const blur = Math.sin(this.time * 20 + i) * s(10);
                ctx.globalAlpha = 0.4;
                ctx.fillText(symbols[(this.slotReels[i] + 1) % symbols.length], rx + colW / 2, reelCenterY - symSize + blur);
                ctx.fillText(symbols[(this.slotReels[i] + 2) % symbols.length], rx + colW / 2, reelCenterY + symSize - blur);
                ctx.globalAlpha = 1;
            }

            // Main Symbol
            ctx.shadowBlur = s(10);
            ctx.shadowColor = 'rgba(255,255,255,0.3)';
            ctx.fillText(sym, rx + colW / 2, reelCenterY);
            ctx.shadowBlur = 0;
            ctx.textBaseline = 'alphabetic';

            if (i < 2) {
                ctx.strokeStyle = theme.accent + '44';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(rx + colW, reelTop + s(10));
                ctx.lineTo(rx + colW, reelTop + reelH - s(10));
                ctx.stroke();
            }
        }

        // Win Line
        ctx.strokeStyle = theme.accent;
        ctx.setLineDash([s(8), s(8)]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - reelW / 2 + s(10), reelCenterY);
        ctx.lineTo(cx + reelW / 2 - s(10), reelCenterY);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── Controls ──
        const controlY = reelTop + reelH + s(mobile ? 30 : 50);

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(11)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('APOSTA', cx, controlY);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(44)}px ${theme.titleFont}`;
        ctx.fillText(`R$ ${this.slotBet}`, cx, controlY + s(mobile ? 40 : 50));

        const hint = mobile ? '[↑↓] Aposta • [OK] GIRA' : 'SETAS ↑↓ AJUSTAR • ENTER GIRAR • ESC SAIR';
        drawMinigameFooter(ctx, this.screenW, this.screenH, theme, hint);

        // Result Overlay
        if (this.slotResult) {
            this.renderSlotResult(ctx, cx, cy, theme);
        }
    }

    private renderSlotResult(ctx: CanvasRenderingContext2D, cx: number, cy: number, theme: any) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();

        const isWin = (this.slotResult?.payout ?? 0) > 0;
        const color = isWin ? '#4ade80' : '#f87171';

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        ctx.fillStyle = color;
        ctx.font = `800 ${r(mobile ? 42 : 48)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';

        let msg = "TENTE NOVAMENTE";
        if (this.slotResult?.isJackpot) msg = "JACKPOT!!!";
        else if (isWin) msg = "VOCÊ GANHOU!";

        ctx.shadowBlur = s(20);
        ctx.shadowColor = color;
        ctx.fillText(msg, cx, cy - s(20));
        ctx.shadowBlur = 0;

        if (this.slotResult?.payout) {
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${r(24)}px ${theme.bodyFont}`;
            ctx.fillText(`+ R$ ${this.slotResult.payout}`, cx, cy + s(30));
        }

        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(13)}px ${theme.bodyFont}`;
        ctx.fillText(mobile ? '[OK] CONTINUAR' : 'ENTER JOGAR NOVAMENTE • ESC SAIR', cx, cy + s(mobile ? 80 : 100));
    }

    private renderBichoUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.bicho;
        const cx = this.screenW / 2;

        drawMinigameBackground(ctx, this.screenW, this.screenH, theme);
        drawMinigameTitle(ctx, this.screenW, this.screenH, theme, 'JOGO DO BICHO');

        // Grid
        const gridTop = s(mobile ? 60 : 85);
        const gridBottom = this.screenH - s(mobile ? 110 : 150);
        const gridH = gridBottom - gridTop;
        const pad = s(mobile ? 10 : 20);
        const cellW = (this.screenW - pad * 2) / 5;
        const cellH = gridH / 5;

        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const ax = pad + col * cellW;
            const ay = gridTop + row * cellH;
            const isSelected = i === this.bichoSelectedAnimal;
            const animal = JogoDoBicho.ANIMALS[i];

            ctx.save();
            ctx.translate(ax + cellW / 2, ay + cellH / 2);

            // Card
            ctx.fillStyle = isSelected ? 'rgba(68, 255, 136, 0.2)' : 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.roundRect(-cellW / 2 + s(2), -cellH / 2 + s(2), cellW - s(4), cellH - s(4), s(8));
            ctx.fill();

            ctx.strokeStyle = isSelected ? theme.accent : 'rgba(255,255,255,0.05)';
            ctx.lineWidth = isSelected ? s(2.5) : 1;
            if (isSelected) {
                ctx.shadowBlur = s(15);
                ctx.shadowColor = theme.accent;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Content
            ctx.font = `${r(mobile ? 38 : 32)}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1;
            ctx.fillText(animal.emoji, 0, -cellH * 0.1);

            ctx.fillStyle = isSelected ? '#fff' : theme.textMuted;
            ctx.font = `bold ${r(mobile ? 10 : 9)}px ${theme.bodyFont}`;
            ctx.fillText(animal.name.toUpperCase(), 0, cellH * 0.3);

            ctx.fillStyle = theme.accent;
            ctx.font = `800 ${r(mobile ? 11 : 8)}px ${theme.bodyFont}`;
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}`, -cellW / 2 + s(8), -cellH / 2 + s(14));

            ctx.restore();
        }

        // Betting Footer Area
        const footerY = gridBottom + s(20);
        ctx.fillStyle = theme.textMuted;
        ctx.font = `600 ${r(11)}px ${theme.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('APOSTA', cx, footerY);

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(mobile ? 46 : 36)}px ${theme.titleFont}`;
        ctx.fillText(`R$ ${this.bichoBet}`, cx, footerY + s(mobile ? 32 : 45));

        const hint = mobile ? '[DPAD] Mover • [+/-] Aposta • [OK] Apostar' : '[SETAS] ESCOLHER • [+/-] APOSTA • ENTER CONFIRMAR';
        drawMinigameFooter(ctx, this.screenW, this.screenH, theme, hint);

        if (this.bichoMessage) {
            ctx.fillStyle = theme.accent;
            ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
            ctx.fillText(this.bichoMessage, cx, footerY - s(30));
        }
    }
}
