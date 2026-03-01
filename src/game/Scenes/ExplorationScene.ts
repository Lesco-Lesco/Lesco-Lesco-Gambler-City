/**
 * ExplorationScene — the main gameplay scene.
 * Combines map rendering, player, NPCs, lighting, HUD, minimap, mini-game transitions.
 * Features a Sandbox experience with street gambling and day/night cycle.
 */

import type { Scene } from '../Core/Loop';
import { Camera } from '../Core/Camera';
import { Renderer } from '../Core/Renderer';
import { InputManager } from '../Core/InputManager';
import { isMobile } from '../Core/MobileDetect';
import { Lighting } from '../Core/Lighting';
import { TileMap } from '../World/TileMap';
import { TileRenderer } from '../World/TileRenderer';
import { Minimap } from '../World/Minimap';
import { TILE_TYPES, BARS } from '../World/MapData';
import { Player } from '../Entities/Player';
import { NPCManager } from '../Entities/NPCManager';
import { HouseDialogueManager } from '../Entities/HouseDialogueManager';
import { BoothDialogueManager } from '../Entities/BoothDialogueManager';
import { BarDialogueManager } from '../Entities/BarDialogueManager';
import { BichoManager } from '../BichoManager';
import { HUD } from '../UI/HUD';
import { NewspaperUI } from '../UI/NewspaperUI';
import { PurrinhaGame } from '../MiniGames/PurrinhaGame';
import { PurrinhaUI } from '../MiniGames/PurrinhaUI';
import { DiceGame } from '../MiniGames/DiceGame';
import { DiceUI } from '../MiniGames/DiceUI';
import { RondaGame } from '../MiniGames/RondaGame';
import { RondaUI } from '../MiniGames/RondaUI';
import { DominoGame } from '../MiniGames/DominoGame';
import { DominoUI } from '../MiniGames/DominoUI';
import { HeadsTailsGame } from '../MiniGames/HeadsTailsGame';
import { HeadsTailsUI } from '../MiniGames/HeadsTailsUI';
import { PalitinhoGame } from '../MiniGames/PalitinhoGame';
import { PalitinhoUI } from '../MiniGames/PalitinhoUI';
import { FanTanGame } from '../MiniGames/FanTanGame';
import { FanTanUI } from '../MiniGames/FanTanUI';
import { HorseRacingGame } from '../MiniGames/HorseRacingGame';
import { HorseRacingUI } from '../MiniGames/HorseRacingUI';
import { DogRacingGame } from '../MiniGames/DogRacingGame';
import { DogRacingUI } from '../MiniGames/DogRacingUI';
import { VideoBingoGame } from '../MiniGames/VideoBingoGame';
import { VideoBingoUI } from '../MiniGames/VideoBingoUI';
import { PoliceManager } from '../PoliceManager';
import { UIScale } from '../Core/UIScale';

export class ExplorationScene implements Scene {
    public name = 'exploration';

    // Systems
    private renderer: Renderer;
    private camera: Camera;
    private input: InputManager;
    private tileMap: TileMap;
    private tileRenderer: TileRenderer;
    private minimap: Minimap;
    private lighting: Lighting;
    private hud: HUD;

    // Entities
    public player: Player;
    private npcManager: NPCManager;
    private houseDialogue: HouseDialogueManager;
    private barDialogue: BarDialogueManager;
    private boothDialogue: BoothDialogueManager;
    private newspaper: NewspaperUI;

    // Minigames
    private purrinhaUI: PurrinhaUI | null = null;
    private diceGame: DiceGame;
    private diceUI: DiceUI | null = null;
    private rondaGame: RondaGame;
    private rondaUI: RondaUI | null = null;
    private dominoGame: DominoGame;
    private dominoUI: DominoUI | null = null;
    private headsTailsUI: HeadsTailsUI | null = null;
    private palitinhoUI: PalitinhoUI | null = null;
    private fanTanUI: FanTanUI | null = null;
    private horseRacingGame: HorseRacingGame;
    private horseRacingUI: HorseRacingUI | null = null;
    private dogRacingGame: DogRacingGame;
    private dogRacingUI: DogRacingUI | null = null;
    private videoBingoGame: VideoBingoGame;
    private videoBingoUI: VideoBingoUI | null = null;

    private activeMinigame: 'none' | 'purrinha' | 'dice' | 'ronda' | 'domino' | 'generic' | 'heads_tails' | 'palitinho' | 'fan_tan' | 'horse_racing' | 'dog_racing' | 'video_bingo' | 'bar_menu' = 'none';
    private selectedBarMenuIndex: number = 0;
    private currentBar: any | null = null;

    // State
    private screenW: number;
    private screenH: number;
    private fps: number = 0;
    private globalTimer: number = 0;
    private policeBattleRolls: { player: number, police: number } | null = null;
    private policeBattleTimer: number = 0;
    private wasInHighRiskArea: boolean = false;

    // Zoom Stages (6 stages: 0.5x to 3.0x)
    private zoomStages: number[] = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    private zoomStageIndex: number = 1; // Default 1.0x
    // Player light source (Softened for natural look)
    private playerLight = {
        worldX: 0,
        worldY: 0,
        radius: 200, // Reduced from 350
        color: '#ffffff',
        intensity: 0.75,  // Reduced from 0.98
        flicker: false,
    };

    // Callbacks
    public onEnterCasino?: (type: 'shopping' | 'station') => void;
    public onGameOver?: () => void;

    constructor(renderer: Renderer, screenW: number, screenH: number) {
        this.renderer = renderer;
        this.screenW = screenW;
        this.screenH = screenH;
        this.input = InputManager.getInstance();

        // Core
        this.camera = new Camera();
        this.camera.resize(screenW, screenH);

        // World
        this.tileMap = new TileMap(); // Uses MAP_DATA
        this.tileRenderer = new TileRenderer();
        this.minimap = new Minimap(this.tileMap);

        // Entities
        this.player = new Player(); // Spawns at safe spot
        this.npcManager = new NPCManager();
        this.houseDialogue = new HouseDialogueManager(this.tileMap);
        this.barDialogue = new BarDialogueManager();
        this.boothDialogue = new BoothDialogueManager(242, 155); // Station Booth coordinates

        // Graphics / Atmosphere
        this.lighting = new Lighting();
        this.lighting.resize(screenW, screenH);
        this.lighting.addLight(this.playerLight);
        this.hud = new HUD();
        this.newspaper = new NewspaperUI();

        // Minigames
        this.diceGame = new DiceGame();
        this.rondaGame = new RondaGame();
        this.dominoGame = new DominoGame();
        this.horseRacingGame = new HorseRacingGame();
        this.dogRacingGame = new DogRacingGame();
        this.videoBingoGame = new VideoBingoGame();

        // Zoom inicial — mobile usa zoom levemente maior para legibilidade
        if (isMobile()) {
            this.camera.zoom = 2.5;
            this.camera.targetZoom = 2.5;
            this.zoomStageIndex = 4; // aponta para zoomStages[4] = 2.5
        } else {
            this.camera.zoom = 2.0;
            this.camera.targetZoom = 2.0;
            this.zoomStageIndex = 3; // aponta para zoomStages[3] = 2.0
        }

        // Snap camera to player initially to avoid "running camera" effect
        this.camera.snapTo(this.player.x, this.player.y);

        // Expose to window for minigame access
        (window as any).gameInput = this.input;
        (window as any).bmanager = BichoManager.getInstance();
    }

    public resize(w: number, h: number) {
        this.screenW = w;
        this.screenH = h;
        this.camera.resize(w, h);
        this.lighting.resize(w, h);
    }

    public setFPS(fps: number) {
        this.fps = fps;
    }

    public enter() {
        // Reset context if needed
    }

    public resetPlayer() {
        this.player.respawn();
        this.camera.snapTo(this.player.x, this.player.y);
    }

    public exit() {
        // Cleanup if needed
    }

    public onEnter() {
        // Called when switching to this scene
    }

    public update(dt: number) {
        const bmanager = BichoManager.getInstance();
        const pm = PoliceManager.getInstance();
        const isIllegal = this.activeMinigame !== 'none' && this.activeMinigame !== 'domino';

        // 0. Newspaper Blocking
        if (this.newspaper.isVisible()) {
            this.newspaper.update(dt, this.input);
            return;
        }

        // Minimap Maximized Blocking
        if (this.input.wasPressed('KeyM')) {
            this.minimap.toggleMaximized();
            if (this.minimap.getMaximized()) {
                this.input.pushContext('menu');
            } else {
                this.input.popContext();
            }
        }

        if (this.minimap.getMaximized()) {
            return; // Block movement and other world updates
        }

        pm.update(dt, this.player.x, this.player.y, bmanager.playerMoney, isIllegal);

        // High Risk Warning logic
        const inHighRisk = pm.isPeriphery(this.player.x, this.player.y);
        if (inHighRisk && !this.wasInHighRiskArea) {
            bmanager.addNotification("Alto Índice de Achacamento!", 4);
        }
        this.wasInHighRiskArea = inHighRisk;

        // 1. Minigame Logic / Interruption
        if (pm.phase !== 'none') {
            // If a raid just started (phase is interruption but we were in a minigame)
            if (this.activeMinigame !== 'none') {
                this.exitMinigame();
            }
            this.updatePoliceRaid(dt);
            return; // Block world and minigame update during raid
        }

        if (this.activeMinigame === 'purrinha' && this.purrinhaUI) {
            this.purrinhaUI.update(dt);
            return; // Block world update
        }

        // 0. Game Over Check
        if (bmanager.playerMoney <= 0 && !bmanager.hasPendingBets() && this.activeMinigame === 'none') {
            if (this.onGameOver) this.onGameOver();
            return;
        }
        if (this.activeMinigame === 'dice' && this.diceUI) {
            this.diceUI.update(dt);
            return;
        }
        if (this.activeMinigame === 'ronda' && this.rondaUI) {
            this.rondaUI.update(dt);
            return;
        }
        if (this.activeMinigame === 'domino' && this.dominoUI) {
            this.dominoUI.update(dt);
            if (this.input.wasPressed('Escape')) {
                if (this.dominoGame.phase === 'playing' || this.dominoGame.phase === 'result') {
                    BichoManager.getInstance().addNotification(`Partida abandonada! Perdeu R$${this.dominoGame.betAmount}.`, 4);
                }
                this.dominoGame.reset();
                this.activeMinigame = 'none';
                this.input.popContext();
                this.player.nearbyInteraction = null;
            }
            return;
        }

        if (this.activeMinigame === 'generic' || this.activeMinigame === 'heads_tails' || this.activeMinigame === 'palitinho' || this.activeMinigame === 'fan_tan') {
            const pm = PoliceManager.getInstance();
            if (pm.phase === 'none') {
                if (this.headsTailsUI) this.headsTailsUI.update(dt);
                if (this.palitinhoUI) this.palitinhoUI.update(dt);
                if (this.fanTanUI) this.fanTanUI.update(dt);
            }
            return;
        }

        if (this.activeMinigame === 'horse_racing' && this.horseRacingUI) {
            this.horseRacingUI.update(dt);
            return;
        }
        if (this.activeMinigame === 'dog_racing' && this.dogRacingUI) {
            this.dogRacingUI.update(dt);
            return;
        }
        if (this.activeMinigame === 'video_bingo' && this.videoBingoUI) {
            this.videoBingoUI.update(dt);
            return;
        }
        if (this.activeMinigame === 'bar_menu') {
            this.updateBarMenu(dt);
            return;
        }

        // World Logic
        // Night Interminável (No Cycle)
        this.globalTimer += dt; // Keep a timer running for Bicho betting results

        BichoManager.getInstance().update(dt);

        // Dynamic Ambient Darkness (Soft Realistic Night)
        const isNavigating = this.activeMinigame === 'none' && pm.phase === 'none';
        this.lighting.setAmbientDarkness(isNavigating ? 0.35 : 0.15);

        // PC-Only Cyclical Zoom with 'Z' key
        if (!isMobile() && isNavigating && this.input.wasPressed('KeyZ')) {
            this.zoomStageIndex = (this.zoomStageIndex + 1) % this.zoomStages.length;
            this.camera.targetZoom = this.zoomStages[this.zoomStageIndex];
        }

        // Player
        this.player.update(dt, this.tileMap);
        this.camera.follow(this.player.x, this.player.y, dt);
        this.camera.update(dt);

        // NPCs
        this.npcManager.update(dt, this.player.x, this.player.y, this.tileMap);

        // House Dialogue
        this.houseDialogue.update(dt, this.player.x, this.player.y);

        // Bar Dialogue
        this.barDialogue.update(dt, this.player.x, this.player.y);

        // Booth Dialogue
        this.boothDialogue.update(dt, this.player.x, this.player.y);

        // Lights
        this.playerLight.worldX = this.player.x;
        this.playerLight.worldY = this.player.y;

        // Interactions
        this.checkInteractions();

        // 6. Adaptive Player Light logic (Fluid and Automatic)
        this.updateAdaptiveLighting(dt);

        // Zoom Debug
        if (this.input.wasPressed('Equal') || this.input.wasPressed('NumpadAdd')) {
            this.camera.targetZoom = Math.min(3.0, this.camera.targetZoom + 0.25);
        }
        if (this.input.wasPressed('Minus') || this.input.wasPressed('NumpadSubtract')) {
            this.camera.targetZoom = Math.max(0.5, this.camera.targetZoom - 0.25);
        }
    }

    private updateAdaptiveLighting(dt: number) {
        // 1. Calculate environmental light at my position
        const originalIntensity = this.playerLight.intensity;
        this.playerLight.intensity = 0;
        const envLight = this.lighting.getLightIntensityAt(this.player.x, this.player.y);
        this.playerLight.intensity = originalIntensity;

        // 2. Define target states - COMPLETE DARKNESS ONLY
        // Player light ONLY appears if ambient light is basically zero (< 0.1)
        let targetIntensity = 0;
        let targetRadius = 0;

        if (envLight < 0.1) {
            // Scale light up as it gets even darker (0.1 -> 0.0)
            const darknessFactor = 1.0 - (envLight / 0.1);
            targetIntensity = darknessFactor * 0.85;
            targetRadius = darknessFactor * 220;
        }

        // 3. Fluid and slow transition (10x smoother)
        const speed = 0.8;
        this.playerLight.intensity += (targetIntensity - this.playerLight.intensity) * speed * dt;
        this.playerLight.radius += (targetRadius - this.playerLight.radius) * speed * dt;

        // Cutoff to prevent oscillation/flicker
        if (this.playerLight.intensity < 0.01) {
            this.playerLight.intensity = 0;
            this.playerLight.radius = 0;
        }
    }

    private updatePoliceRaid(dt: number) {
        const pm = PoliceManager.getInstance();
        const bmanager = BichoManager.getInstance();
        const mobile = isMobile();

        if (pm.phase === 'none') return;
        pm.update(dt);

        if (pm.phase === 'interruption') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                pm.phase = 'gamble_check';
            }
        } else if (pm.phase === 'gamble_check') {
            const acceptBank = this.input.wasPressed('KeyY') || (mobile && (this.input.wasPressed('ArrowUp') || this.input.wasPressed('ArrowLeft')));
            const payContrib = this.input.wasPressed('KeyN') || (mobile && (this.input.wasPressed('ArrowDown') || this.input.wasPressed('ArrowRight')));

            if (acceptBank) { // Aceitar jogar como banca (150)
                if (bmanager.playerMoney >= 150) {
                    bmanager.playerMoney -= 150;
                    pm.phase = 'dice_battle';
                    this.policeBattleTimer = 2.0; // 2 seconds of "rolling"
                    this.policeBattleRolls = {
                        player: Math.floor(Math.random() * 6) + 1,
                        police: Math.floor(Math.random() * 6) + 1
                    };
                } else {
                    bmanager.addNotification("Você não tem R$150 para bancar!", 3);
                }
            } else if (payContrib) { // Pagar contribuição (10)
                const cost = 10;
                if (bmanager.playerMoney >= cost) {
                    bmanager.playerMoney -= cost;
                    pm.currentJoke = pm.getRandomSarcasticComment();
                    pm.phase = 'consequence';
                } else {
                    bmanager.addNotification("Você está quebrado demais até para propina!", 3);
                    pm.phase = 'interruption'; // Go back or just stay there? Let's just stay or maybe police gets angry?
                    // For now, just let it stay in check phase but with a message.
                }
            }
        } else if (pm.phase === 'dice_battle') {
            this.policeBattleTimer -= dt;
            if (this.policeBattleTimer <= 0) {
                pm.phase = 'dice_battle_result';

                const win = this.policeBattleRolls!.player > this.policeBattleRolls!.police;
                if (win) {
                    bmanager.playerMoney += 300; // 150 bet + 150 reward
                    pm.currentJoke = "Sorte de principiante... Pega esse dinheiro e some da minha frente!";
                } else {
                    pm.currentJoke = "Eu avisei que a banca do Estado nunca perde. Agora tchau!";
                }
            }
        } else if (pm.phase === 'dice_battle_result') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('Enter')) {
                pm.phase = 'none';
                this.exitMinigame();
            }
        } else if (pm.phase === 'consequence') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                pm.phase = 'none';
                this.exitMinigame();
            }
        }
    }

    private handleMinigameExit(game?: any, payout: number = 0) {
        const bmanager = BichoManager.getInstance();
        if (game) {
            // Se saiu no meio da partida (já tinha apostado e não terminou)
            // No Bingo, 'picking' também conta como partida iniciada após pagar
            const inProgress = game.phase !== 'betting' && game.phase !== 'result';

            if (inProgress) {
                // Jogos que não descontam no ato da aposta, descontamos no abandono
                const needsDeduction = [
                    'purrinha', 'heads_tails', 'palitinho', 'fantan'
                ].includes(this.activeMinigame);

                if (needsDeduction) {
                    bmanager.playerMoney -= game.betAmount;
                }
                bmanager.addNotification(`Partida abandonada! Perdeu R$${game.betAmount}.`, 4);
            }
            if (payout > 0) bmanager.playerMoney += payout;
        }
        this.exitMinigame();
    }

    private exitMinigame() {
        this.activeMinigame = 'none';
        this.purrinhaUI = null;
        this.diceUI = null;
        this.rondaUI = null;
        this.dominoUI = null;
        this.headsTailsUI = null;
        this.palitinhoUI = null;
        this.fanTanUI = null;
        this.horseRacingUI = null;
        this.dogRacingUI = null;
        this.videoBingoUI = null;

        // Force reset on all persistent game objects to ensure return starts from zero
        this.diceGame.reset();
        this.rondaGame.reset();
        this.dominoGame.reset();
        this.horseRacingGame.reset();
        this.dogRacingGame.reset();
        this.videoBingoGame.reset();

        this.input.popContext();
        this.player.nearbyInteraction = null;
    }



    private checkInteractions() {
        // 1. Map Transitions (Casino/Subsolo)
        // CHECK RADIUS: Increased proximity detection for transitions (1.5 range)
        let isAtEntrance = false;
        for (let dy = -1.5; dy <= 1.5; dy += 0.5) {
            for (let dx = -1.5; dx <= 1.5; dx += 0.5) {
                const tile = this.tileMap.getTile(this.player.x + dx, this.player.y + dy);
                if (tile === TILE_TYPES.ENTRANCE || tile === TILE_TYPES.STAIRS_DOWN) {
                    isAtEntrance = true;
                    break;
                }
            }
            if (isAtEntrance) break;
        }

        if (isAtEntrance) {
            this.player.nearbyInteraction = '▶ E - Entrar no Subsolo';
            if (this.input.wasPressed('KeyE')) {
                const isStation = this.player.x > 200; // Station is roughly at x=242
                if (this.onEnterCasino) this.onEnterCasino(isStation ? 'station' : 'shopping');
                return;
            }
        }

        // 1.5 Bar Interactions
        let nearBar = null;
        for (const bar of BARS) {
            const dx = Math.abs(this.player.x - bar.x);
            const dy = Math.abs(this.player.y - bar.y);
            if (dx < 1.5 && dy < 1.5) {
                nearBar = bar;
                break;
            }
        }

        if (nearBar) {
            this.player.nearbyInteraction = `▶ E - Entrar no ${nearBar.name}`;
            if (this.input.wasPressed('KeyE')) {
                this.startBarActivities(nearBar);
                return;
            }
        }

        // 2. NPC Interactions
        const nearbyNPC = this.npcManager.getNearbyInteractable(this.player.x, this.player.y);

        if (nearbyNPC) {
            const type = nearbyNPC.minigameType;

            if (type) {
                // Fixed: Use gameName or fallback
                const gameDisplay = nearbyNPC.gameName || type.toUpperCase();
                this.player.nearbyInteraction = `▶ E - Jogar ${gameDisplay}`;

                if (this.input.wasPressed('KeyE')) {
                    if (type === 'purrinha') this.startPurrinha();
                    else if (type === 'dice') this.startDice();
                    else if (type === 'ronda') this.startRonda();
                    else if (type === 'domino') this.startDomino();
                    else if (type === 'heads_tails') this.startHeadsTails();
                    else if (type === 'palitinho') this.startPalitinho();
                    else if (type === 'fan_tan') this.startFanTan();
                }
            } else {
                this.player.nearbyInteraction = null;
            }
        } else if (!isAtEntrance) {
            this.player.nearbyInteraction = null;
        }
    }

    // --- Minigame Starters ---

    private startPurrinha() {
        this.activeMinigame = 'purrinha';
        this.input.pushContext('minigame');
        const bmanager = BichoManager.getInstance();
        const game = new PurrinhaGame(bmanager.playerMoney);
        // Note: purrinhaUI constructor logic might need checking, but we assume it matches
        this.purrinhaUI = new PurrinhaUI(game, (payout: number) => {
            this.handleMinigameExit(game, payout);
        }, (moneyChange: number) => {
            // Play Again logic
            bmanager.playerMoney += moneyChange;
            if (bmanager.playerMoney < 0) bmanager.playerMoney = 0;
            game.reset(bmanager.playerMoney);
            bmanager.addNotification(`Saldo atualizado: R$${bmanager.playerMoney}`, 2);
        });
    }

    private startHeadsTails() {
        const bmanager = BichoManager.getInstance();
        const game = new HeadsTailsGame(bmanager.playerMoney);
        this.activeMinigame = 'heads_tails';
        this.input.pushContext('minigame');

        this.headsTailsUI = new HeadsTailsUI(game, (payout: number) => {
            this.handleMinigameExit(game, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            game.reset(bmanager.playerMoney);
        });
    }

    private startPalitinho() {
        const bmanager = BichoManager.getInstance();
        const game = new PalitinhoGame();
        this.activeMinigame = 'palitinho';
        this.input.pushContext('minigame');

        this.palitinhoUI = new PalitinhoUI(game, (payout: number) => {
            this.handleMinigameExit(game, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            game.reset();
        });
    }

    private startFanTan() {
        const bmanager = BichoManager.getInstance();
        const game = new FanTanGame();
        this.activeMinigame = 'fan_tan';
        this.input.pushContext('minigame');

        this.fanTanUI = new FanTanUI(game, (payout: number) => {
            this.handleMinigameExit(game, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            game.reset();
        });
    }

    private startDice() {
        const bmanager = BichoManager.getInstance();
        this.activeMinigame = 'dice';
        this.input.pushContext('minigame');
        this.diceGame.reset();

        this.diceUI = new DiceUI(this.diceGame, (payout: number) => {
            this.handleMinigameExit(this.diceGame, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            this.diceGame.reset();
        });
    }

    private startRonda() {
        const bmanager = BichoManager.getInstance();
        this.activeMinigame = 'ronda';
        this.input.pushContext('minigame');
        this.rondaGame.reset();

        this.rondaUI = new RondaUI(this.rondaGame, (payout: number) => {
            this.handleMinigameExit(this.rondaGame, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            this.rondaGame.reset();
        });
    }

    private startDomino() {
        const bmanager = BichoManager.getInstance();
        this.activeMinigame = 'domino';
        this.input.pushContext('minigame');
        this.dominoGame.reset();

        this.dominoUI = new DominoUI(this.dominoGame, (payout: number) => {
            this.handleMinigameExit(this.dominoGame, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            this.dominoGame.reset();
        });
    }

    private startBarActivities(bar: any) {
        this.activeMinigame = 'bar_menu';
        this.currentBar = bar;
        this.selectedBarMenuIndex = 0;
        this.input.pushContext('menu');
    }

    private updateBarMenu(_dt: number) {
        if (this.input.wasPressed('ArrowUp')) {
            this.selectedBarMenuIndex = (this.selectedBarMenuIndex - 1 + 3) % 3;
        }
        if (this.input.wasPressed('ArrowDown')) {
            this.selectedBarMenuIndex = (this.selectedBarMenuIndex + 1) % 3;
        }
        if (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
            this.input.popContext();
            if (this.selectedBarMenuIndex === 0) this.startVideoBingo();
            else if (this.selectedBarMenuIndex === 1) this.startHorseRacing();
            else if (this.selectedBarMenuIndex === 2) this.startDogRacing();
        }
        if (this.input.wasPressed('Escape')) {
            this.activeMinigame = 'none';
            this.input.popContext();
        }
    }

    private startHorseRacing() {
        this.activeMinigame = 'horse_racing';
        this.input.pushContext('minigame');
        this.horseRacingUI = new HorseRacingUI(
            this.horseRacingGame,
            (p) => this.handleMinigameExit(this.horseRacingGame, p),
            (p) => {
                if (p > 0) BichoManager.getInstance().playerMoney += p;
                this.horseRacingGame.reset();
            }
        );
    }

    private startDogRacing() {
        this.activeMinigame = 'dog_racing';
        this.input.pushContext('minigame');
        this.dogRacingUI = new DogRacingUI(
            this.dogRacingGame,
            (p) => this.handleMinigameExit(this.dogRacingGame, p),
            (p) => {
                if (p > 0) BichoManager.getInstance().playerMoney += p;
                this.dogRacingGame.reset();
            }
        );
    }

    private startVideoBingo() {
        this.activeMinigame = 'video_bingo';
        this.input.pushContext('minigame');
        this.videoBingoUI = new VideoBingoUI(
            this.videoBingoGame,
            (p) => this.handleMinigameExit(this.videoBingoGame, p),
            (p) => {
                if (p > 0) BichoManager.getInstance().playerMoney += p;
                this.videoBingoGame.reset();
            }
        );
    }


    // --- Rendering ---

    private renderBarMenu(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const w = this.screenW;
        const h = this.screenH;

        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${UIScale.r(32)}px "Segoe UI"`;
        ctx.fillText(this.currentBar?.name.toUpperCase() || "BAR", w / 2, h / 2 - s(100));

        const options = [
            "VIDEO BINGO ELETRÔNICO",
            "APOSTAS EM CAVALOS",
            "CORRIDA DE CÃES"
        ];

        options.forEach((opt, i) => {
            const isSelected = i === this.selectedBarMenuIndex;
            ctx.fillStyle = isSelected ? '#fff' : '#666';
            ctx.font = `${isSelected ? 'bold ' : ''}${UIScale.r(20)}px monospace`;

            if (isSelected) {
                ctx.fillText(`> ${opt} <`, w / 2, h / 2 - s(20) + i * s(40));
            } else {
                ctx.fillText(opt, w / 2, h / 2 - s(20) + i * s(40));
            }
        });

        ctx.fillStyle = '#888';
        ctx.font = `${UIScale.r(14)}px monospace`;
        ctx.fillText("Use [SETAS] para selecionar e [ESPAÇO/E] para entrar", w / 2, h / 2 + s(100));
        ctx.fillText("[ESC] para sair", w / 2, h / 2 + s(125));
    }

    public render(ctx: CanvasRenderingContext2D) {
        // Clear
        this.renderer.clear('#06060e');

        // 1. Ground
        this.tileRenderer.renderGround(this.renderer, this.camera, this.tileMap);
        this.lighting.renderGroundGlow(ctx, this.camera);

        // 2. Entities (Depth Sorted)
        this.drawDepthSorted(ctx);

        // 3. Night Atmosphere (Strong Immersion Only during exploration)
        const pm = PoliceManager.getInstance();
        const isNavigating = this.activeMinigame === 'none' && pm.phase === 'none';

        if (isNavigating) {
            this.lighting.render(ctx, this.camera, this.screenW, this.screenH);
            this.lighting.renderFog(ctx, this.screenW, this.screenH, 0.016); // Subtle fog
        } else {
            // Light atmosphere for minigames/raids so they remain visible
            this.tileRenderer.renderNightOverlay(ctx);
        }

        // 4. Overlays
        if (isNavigating) {
            this.tileRenderer.renderOverlays(ctx, this.camera);
            this.houseDialogue.draw(ctx, this.camera);
            this.barDialogue.draw(ctx, this.camera);
            this.boothDialogue.draw(ctx, this.camera);
            this.npcManager.drawUI(ctx, this.camera);
        }

        // 5. Minigames
        if (this.activeMinigame === 'purrinha' && this.purrinhaUI) {
            this.purrinhaUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'dice' && this.diceUI) {
            this.diceUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'ronda' && this.rondaUI) {
            this.rondaUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'domino' && this.dominoUI) {
            this.dominoUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'generic' || this.activeMinigame === 'heads_tails' || this.activeMinigame === 'palitinho' || this.activeMinigame === 'fan_tan') {
            if (this.headsTailsUI) this.headsTailsUI.draw(ctx, this.screenW, this.screenH);
            if (this.palitinhoUI) this.palitinhoUI.draw(ctx, this.screenW, this.screenH);
            if (this.fanTanUI) this.fanTanUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'horse_racing' && this.horseRacingUI) {
            this.horseRacingUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'dog_racing' && this.dogRacingUI) {
            this.dogRacingUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'video_bingo' && this.videoBingoUI) {
            this.videoBingoUI.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'bar_menu') {
            this.renderBarMenu(ctx);
        }

        // 6. UI / HUD (Rendered AFTER minigames to be always visible)
        this.hud.render(
            ctx, this.screenW, this.screenH,
            BichoManager.getInstance().playerMoney,
            this.player.stamina,
            this.player.maxStamina,
            this.fps,
            isNavigating ? this.player.nearbyInteraction : null
        );

        // 7. Global Notifications & Minimap
        this.hud.renderNotifications(ctx, this.screenW, BichoManager.getInstance().getNotifications());
        this.minimap.render(ctx, this.screenW, this.screenH, this.player.x, this.player.y, this.camera, this.npcManager.npcs);

        // --- POLICE GIROFLEX ---
        const pmanager = PoliceManager.getInstance();
        if (pmanager.phase !== 'none') {
            const pulse = (Math.sin(pmanager.giroflexTimer * 2.5) + 1) / 2;
            ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.12})`;
            ctx.fillRect(0, 0, this.screenW, this.screenH);
            ctx.fillStyle = `rgba(0, 0, 255, ${(1 - pulse) * 0.12})`;
            ctx.fillRect(0, 0, this.screenW, this.screenH);
            const grad = ctx.createRadialGradient(this.screenW / 2, this.screenH / 2, 100, this.screenW / 2, this.screenH / 2, this.screenH);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, `rgba(0, 0, 0, 0.1)`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, this.screenW, this.screenH);
        }

        this.renderPoliceOverlay(ctx);

        // 8. Newspaper (Final Overlay)
        if (this.newspaper.isVisible()) {
            this.newspaper.render(ctx, this.screenW, this.screenH);
        }
    }

    private renderPoliceOverlay(ctx: CanvasRenderingContext2D) {
        const pm = PoliceManager.getInstance();
        if (pm.phase === 'none') return;

        const s = UIScale.s.bind(UIScale);
        const mobile = isMobile();
        const w = this.screenW;
        const h = this.screenH;
        const cx = w / 2;
        const cy = h / 2;

        // Dark heavy vignette
        const grad = ctx.createRadialGradient(cx, cy, s(100), cx, cy, h);
        grad.addColorStop(0, 'rgba(0,0,0,0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';

        if (pm.phase === 'interruption') {
            ctx.font = `bold ${UIScale.r(40)}px "Segoe UI"`;
            ctx.fillStyle = '#ff4444';

            // Scaled text for "POLÍCIA! PARADO!" if screen is too narrow
            const title = "POLÍCIA! PARADO!";
            const titleWidth = ctx.measureText(title).width;
            if (titleWidth > w - s(40)) {
                ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
            }
            ctx.fillText(title, cx, cy - s(100));

            ctx.font = `italic ${UIScale.r(20)}px "Segoe UI"`;
            ctx.fillStyle = '#fff';
            this.drawTextWrapped(ctx, `"${pm.currentJoke}"`, cx, cy - s(20), w - s(60), UIScale.r(25));

            ctx.font = `bold ${UIScale.r(14)}px monospace`;
            const expl = `ACONTECEU UMA BATIDA! ELES ESTÃO DE OLHO NO SEU DINHEIRO...`;
            this.drawTextWrapped(ctx, expl, cx, cy + s(40), w - s(40), UIScale.r(18));

            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = `bold ${UIScale.r(16)}px monospace`;
            const hint = mobile ? "[ OK ] OUVIR O POLICIAL" : "[ ESPAÇO ] OUVIR O POLICIAL";
            ctx.fillText(hint, cx, cy + s(100));
        } else if (pm.phase === 'gamble_check') {
            const bmanager = BichoManager.getInstance();
            const canAffordBanca = bmanager.playerMoney >= 150;

            ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
            ctx.fillText("O POLICIAL TE DÁ UMA ESCOLHA...", cx, cy - s(80));

            const qFont = UIScale.r(24);
            ctx.font = `${qFont}px "Segoe UI"`;
            const question = canAffordBanca
                ? `"Quer ser a banca por 150 ou vai 'contribuir' com 10?"`
                : `"Como você tá liso, vai ter que 'contribuir' com 10."`;

            this.drawTextWrapped(ctx, question, cx, cy, w - s(40), qFont + s(4));

            if (canAffordBanca) {
                ctx.font = `bold ${UIScale.r(20)}px monospace`;
                ctx.fillStyle = '#ffff00';
                ctx.fillText(`APOSTA ÚNICA: R$150 CONTRA A LEI`, cx, cy + s(50));

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${UIScale.r(14)}px monospace`;
                const hint = mobile
                    ? "[D-Pad ↑] BANCA (150)   [D-Pad ↓] CONTRIBUIR (10)"
                    : "[Y] JOGAR COMO BANCA (150)   [N] PAGAR CONTRIBUIÇÃO (10)";
                ctx.fillText(hint, cx, cy + s(120));
            } else {
                ctx.font = `bold ${UIScale.r(20)}px monospace`;
                ctx.fillStyle = '#ff4444';
                ctx.fillText(`PAGAMENTO OBRIGATÓRIO: R$10`, cx, cy + s(50));

                ctx.fillStyle = '#fff';
                ctx.font = `bold ${UIScale.r(14)}px monospace`;
                const hint = mobile ? "[D-Pad ↓] PAGAR CONTRIBUIÇÃO (10)" : "[N] PAGAR CONTRIBUIÇÃO (10)";
                ctx.fillText(hint, cx, cy + s(120));
            }
        } else if (pm.phase === 'dice_battle' || pm.phase === 'dice_battle_result') {
            const isRolling = pm.phase === 'dice_battle';

            ctx.font = `bold ${UIScale.r(36)}px "Segoe UI"`;
            ctx.fillStyle = '#ffff00';
            ctx.fillText("BATALHA DE DADOS", cx, cy - s(140));

            // Dice Display
            const spacing = s(Math.min(150, (w - s(100)) / 2));

            const playerVal = isRolling ? Math.floor(Math.random() * 6) + 1 : this.policeBattleRolls!.player;
            const policeVal = isRolling ? Math.floor(Math.random() * 6) + 1 : this.policeBattleRolls!.police;

            // Draw Dice
            this.drawDie(ctx, cx - spacing, cy, playerVal, "VOCÊ", '#44aaff');
            this.drawDie(ctx, cx + spacing, cy, policeVal, "POLÍCIA", '#ff4444');

            if (!isRolling) {
                const win = this.policeBattleRolls!.player > this.policeBattleRolls!.police;
                ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
                ctx.fillStyle = win ? '#2ecc71' : '#ff4444';
                ctx.fillText(win ? "VITÓRIA!" : "DERROTA!", cx, cy + s(100));

                ctx.font = `${UIScale.r(16)}px monospace`;
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                const hint = mobile ? "[ OK ] CONTINUAR" : "[ ESPAÇO ] CONTINUAR";
                ctx.fillText(hint, cx, cy + s(150));
            } else {
                ctx.font = `italic ${UIScale.r(20)}px "Segoe UI"`;
                ctx.fillStyle = '#fff';
                ctx.fillText("Rodando...", cx, cy + s(100));
            }
        } else if (pm.phase === 'consequence') {
            ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
            ctx.fillText("FIM DA BATIDA", cx, cy - s(100));
            ctx.font = `italic ${UIScale.r(20)}px "Segoe UI"`;
            ctx.fillStyle = '#fff';
            this.drawTextWrapped(ctx, `"${pm.currentJoke}"`, cx, cy, w - s(60), UIScale.r(25));
            ctx.font = `${UIScale.r(16)}px monospace`;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            const hint = mobile ? "[ OK ] VOLTAR PARA A RUA" : "[ ESPAÇO ] VOLTAR PARA A RUA";
            ctx.fillText(hint, cx, cy + s(100));
        }
    }

    private drawDepthSorted(ctx: CanvasRenderingContext2D) {
        const drawables = this.tileRenderer.getStructureDrawables(this.renderer, this.camera, this.tileMap);

        drawables.push({
            y: this.player.x + this.player.y,
            draw: () => this.player.draw(ctx, this.camera),
        });

        for (const npc of this.npcManager.npcs) {
            // Frustum Cull Check
            const { sx, sy } = this.camera.worldToScreen(npc.x, npc.y);
            if (sx > -50 && sx < this.screenW + 50 && sy > -50 && sy < this.screenH + 50) {
                drawables.push({
                    y: npc.x + npc.y,
                    draw: () => npc.draw(ctx, this.camera),
                });
            }
        }

        drawables.sort((a, b) => a.y - b.y);
        for (const d of drawables) d.draw();
    }

    private drawDie(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, label: number | string, color: string) {
        const s = UIScale.s.bind(UIScale);
        const size = s(100);
        const radius = s(15);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(x - size / 2 + s(5), y - size / 2 + s(5), size, size, radius);
        ctx.fill();

        // Main Body
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, radius);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = s(4);
        ctx.stroke();

        // Label
        ctx.fillStyle = color;
        ctx.font = `bold ${UIScale.r(20)}px "Segoe UI"`;
        ctx.textAlign = 'center';
        ctx.fillText(label.toString(), x, y - size / 2 - s(20));

        // Dots
        ctx.fillStyle = '#333';
        const dotR = s(8);
        const q = size / 4;

        const drawDot = (dx: number, dy: number) => {
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
            ctx.fill();
        };

        if (value === 1) {
            drawDot(0, 0);
        } else if (value === 2) {
            drawDot(-q, -q); drawDot(q, q);
        } else if (value === 3) {
            drawDot(-q, -q); drawDot(0, 0); drawDot(q, q);
        } else if (value === 4) {
            drawDot(-q, -q); drawDot(q, -q); drawDot(-q, q); drawDot(q, q);
        } else if (value === 5) {
            drawDot(-q, -q); drawDot(q, -q); drawDot(0, 0); drawDot(-q, q); drawDot(q, q);
        } else if (value === 6) {
            drawDot(-q, -q); drawDot(q, -q); drawDot(-q, 0); drawDot(q, 0); drawDot(-q, q); drawDot(q, q);
        }
    }

    private drawTextWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }
}

