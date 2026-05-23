import { InputManager } from './InputManager';

interface GamepadInfo {
    neutralAxes: number[];
}

/**
 * GamepadManager — Lê controles físicos via Gamepad API do browser.
 * Sem dependências externas. Funciona com qualquer controle USB/Bluetooth
 * que siga o Standard Gamepad Layout (Xbox, PlayStation, HORI, etc.)
 *
 * ═══════════════════════════════════════════════════════════════════
 *  MAPEAMENTO FINAL DE BOTÕES (baseado nos controles mobile como referência)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  MOVIMENTO (analógico e DPad):
 *    Analógico Esq / DPad → Movimento do personagem (via setJoystickVector)
 *
 *  FACE BUTTONS (layout PlayStation/HORI):
 *    0 = Cruz  / A  → Space + KeyE   (Confirmar, Interagir, Atirar no Tank, Hit no Blackjack)
 *    1 = Círculo/ B  → KeyS           (Stand no Blackjack; na exploração não tem ação — seguro)
 *    2 = Quadrado/X → Escape          (Sair de qualquer tela/minigame)  ← dispara KeyboardEvent real
 *    3 = Triângulo/Y→ KeyY            (Aceitar banco na batida policial; zoom in no mapa)
 *
 *  SHOULDER BUTTONS:
 *    4 = L1 / LB    → ShiftLeft       (Correr + Dominó: passar peça + Valórium: especial)
 *    5 = R1 / RB    → ShiftLeft       (alias de correr, como o botão RUN do mobile)
 *    6 = L2 / ZL    → Equal           (Zoom In — câmera)
 *    7 = R2 / ZR    → Minus           (Zoom Out — câmera)
 *
 *  MENU BUTTONS:
 *  MENU BUTTONS:
 *    8 = Select     → KeyN            (Negar: não pagar contribuição na batida policial)
 *    9 = Start      → Pause           (Pause exclusivo — dispara KeyboardEvent real para GameCanvas)
 *
 *  NOTAS:
 *  - Start (9) dispara KeyboardEvent de 'Pause' para não conflitar com a saída (Escape).
 *  - O botão Cruz/A dispara AMBOS Space e KeyE simultaneamente (igual ao mobile OK+E).
 *  - L1 e R1 são ambos mapeados para ShiftLeft para ergonomia (fightpad/arcade stick).
 *  - Botão B/Círculo → KeyS: no Blackjack é "Stand". Em exploração, KeyS é "andar pra baixo"
 *    mas como o analógico cuida do movimento, KeyS standalone é seguro.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  REFERÊNCIA: o que cada tecla faz no jogo
 * ═══════════════════════════════════════════════════════════════════
 *  Space/Enter/KeyE  → Confirmar, Interagir NPC, Apostar, Atirar (Tank isDown), Hit (Blackjack)
 *  Escape            → Sair de qualquer contexto (minigame, cassino, policia, arcade)
 *  KeyS              → Stand (Blackjack); movimento (alias de ArrowDown, secundário)
 *  KeyY              → Aceitar banco (batida policial)
 *  KeyN              → Negar contribuição (batida policial) / Select
 *  ShiftLeft         → Correr (Player.ts), passar peça (Dominó), especial (Valórium)
 *  Equal             → Zoom In (ExplorationScene)
 *  Minus             → Zoom Out (ExplorationScene)
 */

// Botões que precisam disparar um KeyboardEvent real no window
// para sistemas que ouvem window.addEventListener('keydown') diretamente (ex: pause do GameCanvas)
const NEEDS_SYNTHETIC_EVENT = new Set(['Pause', 'Space', 'Enter']);

export class GamepadManager {
    private static instance: GamepadManager;

    // Mapeamento: índice do botão → tecla única
    // O botão 0 (Cruz/A) é tratado separadamente em BUTTON_MULTI_MAP
    private readonly BUTTON_MAP: Record<number, string> = {
        1: 'Gamepad_B',  // Círculo / B    → Sair de minigames (sem KeyboardEvent sintético para não pausar)
        2: 'Gamepad_X',    // Quadrado / X   → Stand (Blackjack) / Defesa (Valorium)
        3: 'Gamepad_Y',    // Triângulo / Y  → Aceitar banco (batida policial) / Especial (Valorium)
        4: 'ShiftLeft',  // L1 / LB        → Correr / Dominó: passar / Valórium: especial
        5: 'ShiftLeft',  // R1 / RB        → Alias de correr (ergonomia)
        6: 'Equal',      // L2 / ZL        → Zoom In
        7: 'Minus',      // R2 / ZR        → Zoom Out
        8: 'Gamepad_Select', // Select         → Mapa/Zoom na exploração, Sair em minigames
        9: 'Pause',      // Start / Options → Pause exclusivo (dispara KeyboardEvent sintético)
    };

    // Botão 0 (Cruz/A) aciona múltiplas teclas simultaneamente:
    // Space = confirmar/apostas/atirar no Tank; KeyE = interagir com NPCs
    private readonly CROSS_BUTTON_CODES = ['Space', 'KeyE'];

    private prevButtonState: Map<number, boolean> = new Map();
    private prevSyntheticState: Map<string, boolean> = new Map();
    private gamepadInfos: Map<number, GamepadInfo> = new Map();
    private activeGamepadIndex: number | null = null;

    private constructor() {
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`[GamepadManager] Controle conectado: "${e.gamepad.id}" (index ${e.gamepad.index})`);
            this.initializeGamepad(e.gamepad);
        });
        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`[GamepadManager] Controle desconectado: "${e.gamepad.id}"`);
            this.gamepadInfos.delete(e.gamepad.index);
            if (this.activeGamepadIndex === e.gamepad.index) {
                this.activeGamepadIndex = null;
                this.clearAllInputs();
            }
        });
    }

    public static getInstance(): GamepadManager {
        if (!GamepadManager.instance) {
            GamepadManager.instance = new GamepadManager();
        }
        return GamepadManager.instance;
    }

    public getActiveGamepadIndex(): number | null {
        return this.activeGamepadIndex;
    }

    private initializeGamepad(gp: Gamepad) {
        const neutral = Array.from(gp.axes);
        this.gamepadInfos.set(gp.index, { neutralAxes: neutral });
        console.log(`[GamepadManager] Eixos neutros calibrados (index ${gp.index}):`, neutral.map(v => v.toFixed(3)));
    }

    private clearAllInputs() {
        const input = InputManager.getInstance();
        input.setJoystickVector(0, 0);
        const allCodes = new Set<string>([...Object.values(this.BUTTON_MAP), ...this.CROSS_BUTTON_CODES]);
        for (const code of allCodes) {
            input.setKeyState(code, false);
        }
    }

    /**
     * Dispara um KeyboardEvent real no window — necessário para sistemas que
     * ouvem window.addEventListener('keydown') diretamente (ex: menus HTML como o Pause)
     */
    private dispatchSyntheticEvent(code: string, isPressed: boolean) {
        const wasPressed = this.prevSyntheticState.get(code) ?? false;
        if (isPressed !== wasPressed) {
            window.dispatchEvent(new KeyboardEvent(isPressed ? 'keydown' : 'keyup', { code, bubbles: true }));
            this.prevSyntheticState.set(code, isPressed);
        }
    }

    public update(): void {
        const gamepads = navigator.getGamepads();

        // Inicializa gamepads detectados que ainda não conhecemos
        for (const gp of gamepads) {
            if (gp && !this.gamepadInfos.has(gp.index)) {
                this.initializeGamepad(gp);
            }
        }

        // Remove entradas de gamepads desconectados (edge case sem evento)
        for (const index of Array.from(this.gamepadInfos.keys())) {
            if (!gamepads[index]) {
                this.gamepadInfos.delete(index);
                if (this.activeGamepadIndex === index) {
                    this.activeGamepadIndex = null;
                    this.clearAllInputs();
                }
            }
        }

        // ── Detecção de qual controle está sendo usado ativamente ────────────
        for (const gp of gamepads) {
            if (!gp) continue;
            const info = this.gamepadInfos.get(gp.index);
            if (!info) continue;

            let activity = false;

            // Verifica qualquer botão mapeado (incluindo Cruz/0 e DPad 12-15)
            const allButtonIndices = [0, ...Object.keys(this.BUTTON_MAP).map(Number), 12, 13, 14, 15];
            for (const idx of allButtonIndices) {
                if (gp.buttons[idx]?.pressed) { activity = true; break; }
            }

            // Verifica eixo analógico com deadzone relativa ao neutro calibrado
            if (!activity) {
                for (let i = 0; i < Math.min(gp.axes.length, 2); i++) {
                    if (Math.abs((gp.axes[i] ?? 0) - (info.neutralAxes[i] ?? 0)) > 0.25) {
                        activity = true;
                        break;
                    }
                }
            }

            if (activity && this.activeGamepadIndex !== gp.index) {
                if (this.activeGamepadIndex !== null) this.clearAllInputs();
                console.log(`[GamepadManager] Controle ativo: index ${gp.index} ("${gp.id}")`);
                this.activeGamepadIndex = gp.index;
            }
        }

        // Auto-seleciona se só há um controle conectado e o analógico está em repouso
        if (this.activeGamepadIndex === null) {
            const entries = Array.from(this.gamepadInfos.entries());
            if (entries.length === 1) {
                const [index, info] = entries[0];
                const gp = gamepads[index];
                if (gp) {
                    const quiet = gp.axes.slice(0, 2).every(
                        (v, i) => Math.abs(v - (info.neutralAxes[i] ?? 0)) < 0.15
                    );
                    if (quiet) {
                        this.activeGamepadIndex = index;
                        console.log(`[GamepadManager] Auto-ativado controle index ${index}`);
                    }
                }
            }
        }

        if (this.activeGamepadIndex === null) return;

        const gp = gamepads[this.activeGamepadIndex];
        const info = this.gamepadInfos.get(this.activeGamepadIndex);
        if (!gp || !info) return;

        const input = InputManager.getInstance();

        // ── 1. Movimento: DPad tem prioridade sobre analógico ─────────────────
        const dU = gp.buttons[12]?.pressed ?? false;
        const dD = gp.buttons[13]?.pressed ?? false;
        const dL = gp.buttons[14]?.pressed ?? false;
        const dR = gp.buttons[15]?.pressed ?? false;

        let finalDx = 0;
        let finalDy = 0;

        if (dU || dD || dL || dR) {
            // DPad: gera vetor limpo cardinal
            finalDx = (dR ? 1 : 0) - (dL ? 1 : 0);
            finalDy = (dD ? 1 : 0) - (dU ? 1 : 0);
            input.setJoystickVector(finalDx, finalDy);
        } else {
            // Analógico esquerdo com calibração de neutro e DEADZONE para evitar drift
            let rawDx = (gp.axes[0] ?? 0) - (info.neutralAxes[0] ?? 0);
            let rawDy = (gp.axes[1] ?? 0) - (info.neutralAxes[1] ?? 0);
            
            // Deadzone de 0.2
            if (Math.abs(rawDx) < 0.2) rawDx = 0;
            if (Math.abs(rawDy) < 0.2) rawDy = 0;

            finalDx = Math.max(-1, Math.min(1, rawDx));
            finalDy = Math.max(-1, Math.min(1, rawDy));
            input.setJoystickVector(finalDx, finalDy);
        }

        // Sintéticos para navegação de menus UI (GameCanvas pause, etc)
        this.dispatchSyntheticEvent('ArrowUp', dU || finalDy < -0.5);
        this.dispatchSyntheticEvent('ArrowDown', dD || finalDy > 0.5);
        this.dispatchSyntheticEvent('ArrowLeft', dL || finalDx < -0.5);
        this.dispatchSyntheticEvent('ArrowRight', dR || finalDx > 0.5);

        // ── 2. Botão 0 (Cruz/A) → Space + KeyE simultaneamente ───────────────
        {
            const isPressed = gp.buttons[0]?.pressed ?? false;
            const wasPressed = this.prevButtonState.get(0) ?? false;
            if (isPressed !== wasPressed) {
                for (const code of this.CROSS_BUTTON_CODES) {
                    input.setKeyState(code, isPressed);
                }
            }
            this.prevButtonState.set(0, isPressed);
            // Sempre despacha o sintético do Space se for o botão de confirmação
            this.dispatchSyntheticEvent('Space', isPressed);
        }

        // ── 3. Botões simples (1 tecla por botão) ────────────────────────────
        for (const [btnIdxStr, keyCode] of Object.entries(this.BUTTON_MAP)) {
            const btnIdx = Number(btnIdxStr);

            // L1 (4) e R1 (5) ambos mapeiam para ShiftLeft — tratamos juntos para evitar
            // que o release de um cancele o hold do outro
            if (btnIdx === 5) {
                // R1: só atualiza se L1 não estiver pressionado (evita conflito de release)
                const l1Pressed = gp.buttons[4]?.pressed ?? false;
                const r1Pressed = gp.buttons[5]?.pressed ?? false;
                const combined = l1Pressed || r1Pressed;
                const wasCombined = (this.prevButtonState.get(4) ?? false) || (this.prevButtonState.get(5) ?? false);
                if (combined !== wasCombined) {
                    input.setKeyState('ShiftLeft', combined);
                }
                this.prevButtonState.set(5, r1Pressed);
                continue;
            }
            if (btnIdx === 4) {
                // L1: lógica já tratada junto com R1 no bloco acima (via iteração em ordem)
                // Mas para garantir que prevButtonState seja atualizado:
                const l1Pressed = gp.buttons[4]?.pressed ?? false;
                const r1Pressed = gp.buttons[5]?.pressed ?? false;
                const combined = l1Pressed || r1Pressed;
                const prevL1 = this.prevButtonState.get(4) ?? false;
                const prevR1 = this.prevButtonState.get(5) ?? false;
                const wasCombined = prevL1 || prevR1;
                if (combined !== wasCombined) {
                    input.setKeyState('ShiftLeft', combined);
                }
                this.prevButtonState.set(4, l1Pressed);
                continue;
            }

            const isPressed = gp.buttons[btnIdx]?.pressed ?? false;
            const wasPressed = this.prevButtonState.get(btnIdx) ?? false;

            if (isPressed !== wasPressed) {
                input.setKeyState(keyCode, isPressed);

                // Dispara KeyboardEvent real no window para botões de UI
                if (NEEDS_SYNTHETIC_EVENT.has(keyCode)) {
                    this.dispatchSyntheticEvent(keyCode, isPressed);
                }
            }

            this.prevButtonState.set(btnIdx, isPressed);
        }
    }
}
