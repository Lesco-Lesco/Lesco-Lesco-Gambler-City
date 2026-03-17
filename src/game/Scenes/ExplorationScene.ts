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
import { TILE_TYPES, BARS, ARCADES } from '../World/MapData';
import type { ArcadeGameType } from '../World/MapData';
import { Player } from '../Entities/Player';
import { NPCManager } from '../Entities/NPCManager';
import { HouseDialogueManager } from '../Entities/HouseDialogueManager';
import { BoothDialogueManager } from '../Entities/BoothDialogueManager';
import { BarDialogueManager } from '../Entities/BarDialogueManager';
import { ArcadeDialogueManager } from '../Entities/ArcadeDialogueManager';
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
import { JokenpoGame } from '../MiniGames/JokenpoGame';
import { JokenpoUI } from '../MiniGames/JokenpoUI';
import { PoliceManager } from '../PoliceManager';
import { UIScale } from '../Core/UIScale';
import { AirPongGame } from '../ArcadeGames/AirPongGame';
import { TankAttackGame } from '../ArcadeGames/TankAttackGame';
import { FaroesteGame } from '../ArcadeGames/FaroesteGame';
import { RiscaFacaGame } from '../ArcadeGames/RiscaFacaGame';
import { SinucaGame } from '../ArcadeGames/SinucaGame';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { drawMinigameBackground, drawMinigameTitle, drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import { AchievementManager } from '../Core/AchievementManager';
import { AchievementUI } from '../UI/AchievementUI';

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
    private arcadeDialogue: ArcadeDialogueManager;
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
    private jokenpoUI: JokenpoUI | null = null;

    private activeMinigame: 'none' | 'purrinha' | 'dice' | 'ronda' | 'domino' | 'generic' | 'heads_tails' | 'palitinho' | 'fan_tan' | 'jokenpo' | 'horse_racing' | 'dog_racing' | 'video_bingo' | 'bar_menu' | 'arcade_menu' | 'arcade_air_pong' | 'arcade_tank_attack' | 'arcade_faroeste' | 'arcade_risca_faca' | 'arcade_sinuca' = 'none';
    private selectedBarMenuIndex: number = 0;
    private currentBar: any | null = null;

    // Arcade state
    private selectedArcadeMenuIndex: number = 0;
    private currentArcade: any | null = null;
    private arcadeCredits: number = 0;
    private airPongGame: AirPongGame | null = null;
    private tankAttackGame: TankAttackGame | null = null;
    private faroesteGame: FaroesteGame | null = null;
    private riscaFacaGame: RiscaFacaGame | null = null;
    private sinucaGame: SinucaGame | null = null;

    // State
    private screenW: number;
    private screenH: number;
    private fps: number = 0;
    private globalTimer: number = 0;
    private policeBattleRolls: { player: number, police: number } | null = null;
    private policeBattleTimer: number = 0;
    private wasInHighRiskArea: boolean = false;
    private footstepTimer: number = 0;
    private musicCooldown: number = 60; // Start with 1 min cooldown
    private distanceSinceLastMusic: number = 0;
    private lastPlayerTileX: number = 0;
    private lastPlayerTileY: number = 0;

    // Achievement system
    private achievementUI: AchievementUI;
    private walkTimeAccumulator: number = 0;
    private locationTriggerTimer: number = 0; // Timer to throttle geographic checks
    private lastActiveMinigame: string = 'none'; // Track state changes for exit achievements

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
        this.arcadeDialogue = new ArcadeDialogueManager();
        this.boothDialogue = new BoothDialogueManager(242, 155); // Station Booth coordinates

        // Graphics / Atmosphere
        this.lighting = new Lighting();
        this.lighting.resize(screenW, screenH);
        this.lighting.addLight(this.playerLight);
        this.hud = new HUD();
        this.newspaper = new NewspaperUI();

        // Achievement system
        this.achievementUI = AchievementUI.getInstance();

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
        const sm = SoundManager.getInstance();
        sm.stopLoop('ambient_casino');
        sm.playLoop('ambient_night');
    }

    public update(dt: number) {
        this.updateMusic(dt);
        BichoManager.getInstance().update(dt);
        const bmanager = BichoManager.getInstance();
        const pm = PoliceManager.getInstance();
        const isInArcade = (this.activeMinigame as string).startsWith('arcade_');
        const isIllegal = this.activeMinigame !== 'none' &&
            this.activeMinigame !== 'domino' &&
            !isInArcade;

        // 0. Newspaper Blocking
        if (this.newspaper.isVisible()) {
            this.newspaper.update(dt, this.input);
            return;
        }

        const isNavigating = this.activeMinigame === 'none' && pm.phase === 'none';

        // Minimap Maximized Blocking
        const wasMaximized = this.minimap.getMaximized();
        const toggleMap = isNavigating && (this.input.wasPressed('KeyM') ||
            (isMobile() && !wasMaximized && this.input.wasPressed('MouseLeft') &&
                this.minimap.isPointInMinimap(this.input.getMousePos().x, this.input.getMousePos().y, this.screenW, this.screenH)));

        if (toggleMap) {
            this.minimap.toggleMaximized();
            if (this.minimap.getMaximized()) {
                this.input.pushContext('menu');
            } else {
                this.input.popContext();
            }
        }

        if (this.minimap.getMaximized()) {
            // Only update interaction if it was already open at start of frame
            // This prevents the same click from opening AND closing/zooming it
            if (wasMaximized) {
                this.minimap.update(this.screenW, this.screenH);
            }
            return; // Block movement and other world updates
        }

        const isBarGame = ['horse_racing', 'dog_racing', 'video_bingo', 'bar_menu'].includes(this.activeMinigame as string);
        const isInBribedBar = isBarGame && this.currentBar?.paysBribe === true;
        pm.update(dt, this.player.x, this.player.y, bmanager.playerMoney, isIllegal, isInBribedBar, isBarGame);

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
                const game = this.getCurrentMinigameObject();
                const bet = game?.betAmount || 0;
                pm.confiscatedAmount = bet; // Tell police how much was taken
                
                // Use handleMinigameExit to process the loss
                this.handleMinigameExit(game);
            }

            // Achievement: record first contact with police
            if (pm.phase === 'interruption') {
                AchievementManager.getInstance().recordRaidEncounter();
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

        if (this.activeMinigame === 'generic' || this.activeMinigame === 'heads_tails' || this.activeMinigame === 'palitinho' || this.activeMinigame === 'fan_tan' || this.activeMinigame === 'jokenpo') {
            const pm = PoliceManager.getInstance();
            if (pm.phase === 'none') {
                if (this.headsTailsUI) this.headsTailsUI.update(dt);
                if (this.palitinhoUI) this.palitinhoUI.update(dt);
                if (this.fanTanUI) this.fanTanUI.update(dt);
                if (this.jokenpoUI) this.jokenpoUI.update(dt);
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
        if (this.activeMinigame === 'arcade_menu') {
            this.updateArcadeMenu(dt);
            return;
        }
        if (this.activeMinigame === 'arcade_air_pong' && this.airPongGame) {
            this.airPongGame.update(dt);
            if (this.airPongGame.phase === 'game_over' && (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE'))) {
                this.processArcadeEnd('air_pong', this.airPongGame.score);
                this.airPongGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            if (this.input.wasPressed('Escape')) {
                this.airPongGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            return;
        }
        if (this.activeMinigame === 'arcade_tank_attack' && this.tankAttackGame) {
            this.tankAttackGame.update(dt);
            if (this.tankAttackGame.phase === 'game_over' && (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE'))) {
                this.processArcadeEnd('tank_attack', this.tankAttackGame.score);
                this.tankAttackGame = null;
                this.activeMinigame = 'arcade_menu';
                InputManager.getInstance().setActiveMinigame(null);
            }
            if (this.input.wasPressed('Escape')) {
                this.tankAttackGame = null;
                this.activeMinigame = 'arcade_menu';
                InputManager.getInstance().setActiveMinigame(null);
            }
            return;
        }
        if (this.activeMinigame === 'arcade_faroeste' && this.faroesteGame) {
            this.faroesteGame.update(dt);
            if (this.faroesteGame.phase === 'game_over' && (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE'))) {
                this.processArcadeEnd('faroeste', this.faroesteGame.score);
                this.faroesteGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            if (this.input.wasPressed('Escape')) {
                this.faroesteGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            return;
        }
        if (this.activeMinigame === 'arcade_risca_faca' && this.riscaFacaGame) {
            this.riscaFacaGame.update(dt);
            if (this.riscaFacaGame.phase === 'game_over' && (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE'))) {
                this.processArcadeEnd('risca_faca', this.riscaFacaGame.score);
                this.riscaFacaGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            if (this.input.wasPressed('Escape')) {
                this.riscaFacaGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            return;
        }
        if (this.activeMinigame === 'arcade_sinuca' && this.sinucaGame) {
            this.sinucaGame.update(dt);
            if (this.sinucaGame.phase === 'game_over' && (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE'))) {
                // Check Sinuca win (player pocketed all AI balls = score includes 500 win bonus)
                const sinucaWon = this.sinucaGame.score >= 500;
                this.processArcadeEnd('sinuca', this.sinucaGame.score);
                if (sinucaWon) {
                    AchievementManager.getInstance().recordSinucaWin();
                }
                this.sinucaGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            if (this.input.wasPressed('Escape')) {
                this.sinucaGame = null;
                this.activeMinigame = 'arcade_menu';
            }
            return;
        }

        this.globalTimer += dt; // Keep a timer running for Bicho betting results

        // Dynamic Ambient Darkness (Soft Realistic Night)
        this.lighting.setAmbientDarkness(isNavigating ? 0.35 : 0.15);

        // PC-Only Cyclical Zoom with 'Z' key
        if (!isMobile() && isNavigating && this.input.wasPressed('KeyZ')) {
            this.zoomStageIndex = (this.zoomStageIndex + 1) % this.zoomStages.length;
            this.camera.targetZoom = this.zoomStages[this.zoomStageIndex];
        }

        // Player
        this.player.update(dt, this.tileMap);
        this.camera.follow(this.player.x, this.player.y, dt);

        // Footstep sounds when walking + achievement walk time tracking
        if (this.player.isMoving) {
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0) {
                SoundManager.getInstance().play('footstep');
                this.footstepTimer = this.player.isRunning ? 0.22 : 0.35;
            }
            // Walk time for achievements (batch to avoid spamming)
            this.walkTimeAccumulator += dt;
            if (this.walkTimeAccumulator >= 5.0) {
                AchievementManager.getInstance().addWalkTime(this.walkTimeAccumulator);
                this.walkTimeAccumulator = 0;
            }
        } else {
            this.footstepTimer = 0;
        }
        this.camera.update(dt);

        // NPCs
        this.npcManager.update(dt, this.player.x, this.player.y, this.tileMap);

        // House Dialogue
        this.houseDialogue.update(dt, this.player.x, this.player.y);

        // Bar Dialogue
        this.barDialogue.update(dt, this.player.x, this.player.y);

        // Arcade Dialogue
        this.arcadeDialogue.update(dt, this.player.x, this.player.y);

        // Booth Dialogue
        this.boothDialogue.update(dt, this.player.x, this.player.y);

        // Lights
        this.playerLight.worldX = this.player.x;
        this.playerLight.worldY = this.player.y;

        // Interactions
        this.checkInteractions();

        // Exploration Achievements (Throttled geographic checks)
        this.locationTriggerTimer -= dt;
        if (this.locationTriggerTimer <= 0) {
            this.checkGeographicAchievements();
            this.locationTriggerTimer = 0.5; // Every half second
        }

        // Detect Exit from Bar/Arcade
        if (this.lastActiveMinigame !== 'none' && this.activeMinigame === 'none') {
            if (this.lastActiveMinigame === 'bar_menu') {
                AchievementManager.getInstance().recordEstablishmentExit('bar');
            } else if (this.lastActiveMinigame === 'arcade_menu') {
                AchievementManager.getInstance().recordEstablishmentExit('arcade');
            }
        }
        this.lastActiveMinigame = this.activeMinigame;

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

    private updateMusic(dt: number) {
        if (this.musicCooldown > 0) {
            this.musicCooldown -= dt;
        }

        const tx = Math.floor(this.player.x);
        const ty = Math.floor(this.player.y);

        // Distance tracking for "Long Walk" trigger
        if (tx !== this.lastPlayerTileX || ty !== this.lastPlayerTileY) {
            const dist = Math.sqrt((tx - this.lastPlayerTileX) ** 2 + (ty - this.lastPlayerTileY) ** 2);
            this.distanceSinceLastMusic += dist;
            this.lastPlayerTileX = tx;
            this.lastPlayerTileY = ty;

            // Trigger music after ~150-200 tiles of walking (clinical feel)
            if (this.musicCooldown <= 0 && this.distanceSinceLastMusic > 150 + Math.random() * 100) {
                this.playRandomMusicMotif();
            }
        }
    }

    private playRandomMusicMotif() {
        if (this.musicCooldown > 0) return;

        const trackNum = Math.floor(Math.random() * 9) + 1;
        const trackName = `music_${trackNum}` as any;
        
        // Periphery check for volume boost
        const isPeriphery = PoliceManager.getInstance().isPeriphery(this.player.x, this.player.y);
        const volume = isPeriphery ? 0.4 : 0.22;

        console.log(`🎵 Playing clinical music motif: ${trackName} (Volume: ${volume})`);
        SoundManager.getInstance().play(trackName, { volume });

        // Cooldown: 3 to 6 minutes of silence (classic Sim City feel)
        this.musicCooldown = 180 + Math.random() * 180;
        this.distanceSinceLastMusic = 0;
    }

    private updatePoliceRaid(dt: number) {
        const pm = PoliceManager.getInstance();
        const bmanager = BichoManager.getInstance();
        const mobile = isMobile();

        if (pm.phase === 'none') return;
        pm.update(dt);

        if (pm.phase === 'interruption' || pm.phase === 'bribed_interruption') {
            if (this.input.wasPressed('Space') || this.input.wasPressed('KeyE')) {
                SoundManager.getInstance().play('menu_confirm');
                if (pm.phase === 'bribed_interruption') {
                    pm.phase = 'none';
                    this.exitMinigame();
                } else {
                    pm.phase = 'gamble_check';
                    SoundManager.getInstance().play('police_whistle');
                }
            }
        } else if (pm.phase === 'gamble_check') {
            const acceptBank = this.input.wasPressed('KeyY') || (mobile && this.input.wasPressed('Space'));
            const payContrib = this.input.wasPressed('KeyN') || (mobile && this.input.wasPressed('Escape'));

            if (acceptBank) { // Aceitar jogar como banca (150)
                if (bmanager.playerMoney >= 150) {
                    bmanager.playerMoney -= 150;
                    pm.phase = 'dice_battle';
                    this.policeBattleTimer = 2.0; // 2 seconds of "rolling"
                    SoundManager.getInstance().play('dice_roll');
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
                    SoundManager.getInstance().play('coin_loss');
                    AchievementManager.getInstance().recordBribePaid();
                    AchievementManager.getInstance().recordRaidSurvived();
                } else {
                    bmanager.addNotification("Você está quebrado demais até para propina!", 3);
                    pm.phase = 'interruption';
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
                    SoundManager.getInstance().play('win_small');
                    AchievementManager.getInstance().recordRaidSurvived();
                } else {
                    pm.currentJoke = "Eu avisei que a banca do Estado nunca perde. Agora tchau!";
                    SoundManager.getInstance().play('lose');
                    AchievementManager.getInstance().recordRaidSurvived();
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
        const sm = SoundManager.getInstance();
        const achManager = AchievementManager.getInstance();

        // Track minigame play for achievements
        if (this.activeMinigame !== 'none' && this.activeMinigame !== 'bar_menu' && this.activeMinigame !== 'arcade_menu') {
            achManager.recordMinigamePlay(this.activeMinigame);
        }

        if (game) {
            const inProgress = game.phase !== 'betting' && game.phase !== 'result';

            if (inProgress) {
                const needsDeduction = [
                    'purrinha', 'heads_tails', 'palitinho', 'fan_tan', 'jokenpo',
                    'dice', 'ronda'
                ].includes(this.activeMinigame as string);

                if (needsDeduction && game && game.betAmount) {
                    bmanager.playerMoney -= game.betAmount;
                    bmanager.addNotification(`Partida interrompida! Perdeu R$${game.betAmount}.`, 4);
                    sm.play('coin_loss');
                } else if (inProgress) {
                    bmanager.addNotification(`Partida encerrada.`, 4);
                }
                achManager.recordMinigameLoss();
            }
            if (payout > 0) {
                bmanager.playerMoney += payout;
                sm.play('coin_gain');
                achManager.recordMinigameWin(this.activeMinigame);
            } else if (payout < 0) {
                bmanager.playerMoney += payout;
                sm.play('coin_loss');
                achManager.recordMinigameLoss();
            } else if (!inProgress && game.phase === 'result') {
                achManager.recordMinigameLoss();
            }
        }

        achManager.updateMaxMoney(bmanager.playerMoney);
        this.exitMinigame();
    }

    /** Process arcade game end: record stats for achievements only (no direct money reward per session) */
    private processArcadeEnd(type: string, score: number): void {
        const achManager = AchievementManager.getInstance();
        const bmanager = BichoManager.getInstance();

        // Track stats and trigger any achievement unlocks (achievements are one-time events, not farmable)
        achManager.recordArcadeEnd(type, score);

        // No direct money reward per session — prevents score farming exploit.
        // Financial recognition comes exclusively through one-time achievement unlocks.
        achManager.updateMaxMoney(bmanager.playerMoney);
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
        this.jokenpoUI = null;
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

    private getCurrentMinigameObject(): any {
        if (this.activeMinigame === 'purrinha') return (this.purrinhaUI as any)?.game;
        if (this.activeMinigame === 'dice') return this.diceGame;
        if (this.activeMinigame === 'ronda') return this.rondaGame;
        if (this.activeMinigame === 'domino') return this.dominoGame;
        if (this.activeMinigame === 'heads_tails') return (this.headsTailsUI as any)?.game;
        if (this.activeMinigame === 'palitinho') return (this.palitinhoUI as any)?.game;
        if (this.activeMinigame === 'fan_tan') return (this.fanTanUI as any)?.game;
        if (this.activeMinigame === 'jokenpo') return (this.jokenpoUI as any)?.game;
        if (this.activeMinigame === 'horse_racing') return this.horseRacingGame;
        if (this.activeMinigame === 'dog_racing') return this.dogRacingGame;
        if (this.activeMinigame === 'video_bingo') return this.videoBingoGame;
        return null;
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
                SoundManager.getInstance().play('door_enter');
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
                SoundManager.getInstance().play('door_enter');
                this.startBarActivities(nearBar);
                return;
            }
        }

        // 1.6 Arcade Interactions
        let nearArcade = null;
        for (const arcade of ARCADES) {
            const dx = Math.abs(this.player.x - arcade.x);
            const dy = Math.abs(this.player.y - arcade.y);
            if (dx < 1.5 && dy < 1.5) {
                nearArcade = arcade;
                break;
            }
        }

        if (nearArcade) {
            this.player.nearbyInteraction = `▶ E - Entrar no ${nearArcade.name}`;
            if (this.input.wasPressed('KeyE')) {
                SoundManager.getInstance().play('door_enter');
                this.startArcadeActivities(nearArcade);
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
                    SoundManager.getInstance().play('menu_confirm');
                    if (type === 'purrinha') this.startPurrinha();
                    else if (type === 'dice') this.startDice();
                    else if (type === 'ronda') this.startRonda();
                    else if (type === 'domino') this.startDomino();
                    else if (type === 'heads_tails') this.startHeadsTails();
                    else if (type === 'palitinho') this.startPalitinho();
                    else if (type === 'fan_tan') this.startFanTan();
                    else if (type === 'jokenpo') this.startJokenpo();
                }
            } else {
                this.player.nearbyInteraction = null;
            }
        } else if (!isAtEntrance && !nearBar && !nearArcade) {
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

    private startJokenpo() {
        const bmanager = BichoManager.getInstance();
        const game = new JokenpoGame(bmanager.playerMoney);
        this.activeMinigame = 'jokenpo';
        this.input.pushContext('minigame');

        this.jokenpoUI = new JokenpoUI(game, (payout: number) => {
            this.handleMinigameExit(game, payout);
        }, (moneyChange: number) => {
            bmanager.playerMoney += moneyChange;
            game.reset(bmanager.playerMoney);
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

    private startArcadeActivities(arcade: any) {
        this.activeMinigame = 'arcade_menu';
        this.currentArcade = arcade;
        this.selectedArcadeMenuIndex = 0;
        this.input.pushContext('menu');
    }

    private getArcadeMenuItems(): { label: string; cost: string; gameType: ArcadeGameType | 'buy'; icon: string; color: string }[] {
        const GAME_INFO: Record<ArcadeGameType, { label: string; icon: string; color: string }> = {
            'air_pong': { label: 'AIR PONG', icon: '🏓', color: '#00ccff' },
            'tank_attack': { label: 'TANK ATTACK', icon: '🎯', color: '#7cb342' },
            'faroeste': { label: 'FAROESTE', icon: '🤠', color: '#d2691e' },
            'risca_faca': { label: 'RISCA FACA', icon: '🔪', color: '#cc0000' },
            'sinuca': { label: 'SINUCA', icon: '🎱', color: '#009966' },
        };

        const items: { label: string; cost: string; gameType: ArcadeGameType | 'buy'; icon: string; color: string }[] = [
            { label: 'COMPRAR CRÉDITOS', cost: '2 por R$10', gameType: 'buy', icon: '💰', color: '#ffcc00' }
        ];

        const availableGames: ArcadeGameType[] = this.currentArcade?.games || [];
        for (const game of availableGames) {
            const info = GAME_INFO[game];
            items.push({ label: info.label, cost: '1 crédito', gameType: game, icon: info.icon, color: info.color });
        }

        return items;
    }

    private launchArcadeGame(gameType: ArcadeGameType) {
        this.arcadeCredits--;
        this.input.popContext();
        this.input.pushContext('minigame');

        switch (gameType) {
            case 'air_pong': this.airPongGame = new AirPongGame(); this.activeMinigame = 'arcade_air_pong'; break;
            case 'tank_attack': 
                this.tankAttackGame = new TankAttackGame(); 
                this.activeMinigame = 'arcade_tank_attack'; 
                InputManager.getInstance().setActiveMinigame('tank_attack');
                break;
            case 'faroeste': this.faroesteGame = new FaroesteGame(); this.activeMinigame = 'arcade_faroeste'; break;
            case 'risca_faca': this.riscaFacaGame = new RiscaFacaGame(); this.activeMinigame = 'arcade_risca_faca'; break;
            case 'sinuca': this.sinucaGame = new SinucaGame(); this.activeMinigame = 'arcade_sinuca'; break;
        }
    }

    private updateArcadeMenu(_dt: number) {
        const items = this.getArcadeMenuItems();
        const menuItems = items.length; // 1 (buy) + 3 games = 4

        const cols = isMobile() ? 2 : 3;

        if (this.input.wasPressed('ArrowLeft') || this.input.wasPressed('KeyA')) {
            this.selectedArcadeMenuIndex = Math.max(0, this.selectedArcadeMenuIndex - 1);
        }
        if (this.input.wasPressed('ArrowRight') || this.input.wasPressed('KeyD')) {
            this.selectedArcadeMenuIndex = Math.min(menuItems - 1, this.selectedArcadeMenuIndex + 1);
        }
        if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
            if (this.selectedArcadeMenuIndex >= cols) {
                this.selectedArcadeMenuIndex -= cols;
            } else {
                this.selectedArcadeMenuIndex = 0;
            }
        }
        if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
            if (this.selectedArcadeMenuIndex + cols < menuItems) {
                this.selectedArcadeMenuIndex += cols;
            } else {
                this.selectedArcadeMenuIndex = menuItems - 1;
            }
        }
        if (this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.wasPressed('KeyE')) {
            const selected = items[this.selectedArcadeMenuIndex];
            if (selected.gameType === 'buy') {
                const bmanager = BichoManager.getInstance();
                if (bmanager.playerMoney >= 10) {
                    bmanager.playerMoney -= 10;
                    this.arcadeCredits += 2;
                    bmanager.addNotification('Comprou 2 créditos!', 2);
                } else {
                    bmanager.addNotification('Dinheiro insuficiente!', 2);
                }
            } else if (this.arcadeCredits >= 1) {
                this.launchArcadeGame(selected.gameType);
            } else {
                BichoManager.getInstance().addNotification('Sem créditos! Compre mais.', 2);
            }
        }
        if (this.input.wasPressed('Escape')) {
            this.activeMinigame = 'none';
            this.arcadeCredits = 0;
            this.input.popContext();
            if (this.musicCooldown <= 0 && Math.random() < 0.3) {
                this.playRandomMusicMotif();
            }
        }
    }

    private startHorseRacing() {
        this.activeMinigame = 'horse_racing';
        this.input.pushContext('minigame');
        const bmanager = BichoManager.getInstance();
        this.horseRacingUI = new HorseRacingUI(
            this.horseRacingGame,
            (p) => {
                const hadChange = this.activeMinigame !== 'none';
                this.handleMinigameExit(this.horseRacingGame, p);
                if (hadChange && this.activeMinigame === 'none' && this.musicCooldown <= 0 && Math.random() < 0.3) {
                    this.playRandomMusicMotif();
                }
            },
            (payout) => {
                if (payout > 0) {
                    bmanager.playerMoney += payout;
                    SoundManager.getInstance().play('coin_gain');
                }
                this.horseRacingGame.reset();
            }
        );
    }

    private startDogRacing() {
        this.activeMinigame = 'dog_racing';
        this.input.pushContext('minigame');
        const bmanager = BichoManager.getInstance();
        this.dogRacingUI = new DogRacingUI(
            this.dogRacingGame,
            (p) => {
                const hadChange = this.activeMinigame !== 'none';
                this.handleMinigameExit(this.dogRacingGame, p);
                if (hadChange && this.activeMinigame === 'none' && this.musicCooldown <= 0 && Math.random() < 0.3) {
                    this.playRandomMusicMotif();
                }
            },
            (payout) => {
                if (payout > 0) {
                    bmanager.playerMoney += payout;
                    SoundManager.getInstance().play('coin_gain');
                }
                this.dogRacingGame.reset();
            }
        );
    }

    private startVideoBingo() {
        this.activeMinigame = 'video_bingo';
        this.input.pushContext('minigame');
        const bmanager = BichoManager.getInstance();
        this.videoBingoUI = new VideoBingoUI(
            this.videoBingoGame,
            (p) => {
                const hadChange = this.activeMinigame !== 'none';
                this.handleMinigameExit(this.videoBingoGame, p);
                if (hadChange && this.activeMinigame === 'none' && this.musicCooldown <= 0 && Math.random() < 0.3) {
                    this.playRandomMusicMotif();
                }
            },
            (payout) => {
                if (payout > 0) {
                    bmanager.playerMoney += payout;
                    SoundManager.getInstance().play('coin_gain');
                }
                this.videoBingoGame.reset();
            }
        );
    }


    // --- Rendering ---

    private renderBarMenu(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const w = this.screenW;
        const h = this.screenH;
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.bar_menu;
        const cx = w / 2;

        // Fullscreen themed background
        drawMinigameBackground(ctx, w, h, theme);

        // Bar name title
        ctx.shadowBlur = s(20);
        ctx.shadowColor = theme.accent;
        ctx.fillStyle = theme.accent;
        ctx.font = `bold ${UIScale.r(mobile ? 24 : 28)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(this.currentBar?.name.toUpperCase() || 'BAR', cx, h * 0.10);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Subtitle
        ctx.fillStyle = theme.textMuted;
        ctx.font = `${UIScale.r(mobile ? 11 : 11)}px ${theme.titleFont}`;
        ctx.textAlign = 'center';
        ctx.fillText('ESCOLHA SUA DIVERSÃO', cx, h * 0.16);

        // Game options as decorative cards
        const options = [
            { name: 'VIDEO BINGO', icon: '🎰', desc: 'Bingo eletrônico com cartelas', color: '#7b2dff' },
            { name: 'CORRIDA CAVALOS', icon: '🐎', desc: 'Apostas em tempo real', color: '#228b22' },
            { name: 'CORRIDA DE CÃES', icon: '🐕', desc: 'Galgos em alta velocidade', color: '#ff6b00' },
        ];

        const cardW = Math.min(s(mobile ? 280 : 320), w * 0.85);
        const cardH = s(mobile ? 65 : 75);
        const spacing = s(mobile ? 10 : 14);
        const totalH = options.length * cardH + (options.length - 1) * spacing;
        const startY = (h - totalH) / 2 + s(10);

        options.forEach((opt, i) => {
            const isSelected = i === this.selectedBarMenuIndex;
            const y = startY + i * (cardH + spacing);
            const cardX = cx - cardW / 2;

            // Card background - Solid and opaque to prevent "faded" look
            ctx.save();
            if (isSelected) {
                ctx.shadowBlur = s(18);
                ctx.shadowColor = opt.color;
            }
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.roundRect(cardX, y, cardW, cardH, s(10));
            ctx.fill();

            ctx.strokeStyle = isSelected ? opt.color : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isSelected ? s(2.5) : s(1.5);
            ctx.stroke();
            ctx.restore();

            // Icon
            const iconSize = Math.floor(cardH * 0.55);
            ctx.font = `${iconSize}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(opt.icon, cardX + s(35), y + cardH / 2);
            ctx.textBaseline = 'alphabetic';

            // Name - Solid white for maximum clarity
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${UIScale.r(mobile ? 12 : 15)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'left';
            ctx.fillText(opt.name, cardX + s(60), y + cardH * 0.40);

            // Description - Solid white for maximum clarity
            ctx.fillStyle = '#ffffff';
            ctx.font = `${UIScale.r(mobile ? 9 : 11)}px "Segoe UI", sans-serif`;
            ctx.fillText(opt.desc, cardX + s(60), y + cardH * 0.72);

            // Selection arrow
            if (isSelected) {
                const bounce = Math.sin(Date.now() / 200) * s(4);
                ctx.fillStyle = opt.color;
                ctx.font = `bold ${UIScale.r(16)}px monospace`;
                ctx.textAlign = 'right';
                ctx.fillText('▶', cardX + cardW - s(12) + bounce, y + cardH / 2 + s(5));
            }
        });

        // Footer
        const hint = mobile
            ? '[↑↓] SELECIONAR  |  [E] ENTRAR  |  [✕] SAIR'
            : '[↑↓] SELECIONAR  |  [ESPAÇO/E] ENTRAR  |  [ESC] SAIR';
        drawMinigameFooter(ctx, w, h, theme, hint);
    }

    private renderArcadeMenu(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const w = this.screenW;
        const h = this.screenH;
        const mobile = isMobile();
        const theme = MINIGAME_THEMES.arcade_menu;
        const cx = w / 2;
        const time = Date.now() / 1000;

        // Fullscreen themed background
        drawMinigameBackground(ctx, w, h, theme, time);

        // Animated neon grid (arcade atmosphere)
        const gridSize = s(60);
        const gridPulse = Math.sin(time * 0.8) * 0.04 + 0.08;
        ctx.strokeStyle = `rgba(0, 255, 136, ${gridPulse})`;
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        for (let x = 0; x < w; x += gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        // Title
        drawMinigameTitle(ctx, w, h, theme, this.currentArcade?.name?.toUpperCase() || 'FLIPERAMA');

        // Credits LED display
        ctx.save();
        const ledW = s(mobile ? 200 : 260);
        const ledH = s(mobile ? 40 : 48);
        const ledX = cx - ledW / 2;
        const ledY = h * 0.12;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(ledX, ledY, ledW, ledH, s(8));
        ctx.fill();
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = s(1.5);
        ctx.stroke();

        ctx.fillStyle = '#00ff88';
        ctx.font = `bold ${UIScale.r(mobile ? 12 : 15)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`CRÉDITOS: ${this.arcadeCredits}`, cx, ledY + ledH * 0.55);

        // Money display
        const bm = BichoManager.getInstance();
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${UIScale.r(mobile ? 10 : 12)}px "Press Start 2P", monospace`;
        ctx.fillText(`R$ ${bm.playerMoney.toFixed(0)}`, cx, ledY + ledH + s(18));
        ctx.restore();

        // Game items as arcade cabinet cards
        const options = this.getArcadeMenuItems();
        const cols = mobile ? 2 : 3;
        const cardW = Math.min(s(mobile ? 140 : 170), (w * 0.88) / cols - s(10));
        const cardH = s(mobile ? 100 : 120);
        const gapX = s(mobile ? 8 : 14);
        const gapY = s(mobile ? 8 : 14);
        const gridW = cols * cardW + (cols - 1) * gapX;
        const gridStartX = cx - gridW / 2;
        const gridStartY = h * (mobile ? 0.34 : 0.32);

        options.forEach((opt, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = gridStartX + col * (cardW + gapX);
            const y = gridStartY + row * (cardH + gapY);
            const isSelected = i === this.selectedArcadeMenuIndex;

            ctx.save();

            // Card body
            if (isSelected) {
                ctx.shadowBlur = s(20);
                ctx.shadowColor = opt.color;
            }

            // Card background gradient
            const cardGrad = ctx.createLinearGradient(x, y, x, y + cardH);
            cardGrad.addColorStop(0, isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)');
            cardGrad.addColorStop(1, isSelected ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)');
            ctx.fillStyle = cardGrad;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, s(10));
            ctx.fill();

            // Card border
            ctx.strokeStyle = isSelected ? opt.color : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = isSelected ? s(2.5) : s(1);
            ctx.stroke();

            // Top accent bar
            ctx.fillStyle = isSelected ? opt.color : 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + s(1), y + s(1), cardW - s(2), s(4));

            ctx.restore();

            // Icon
            const iconSize = Math.floor(cardH * 0.35);
            ctx.font = `${iconSize}px "Segoe UI Emoji", Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(opt.icon, x + cardW / 2, y + cardH * 0.38);
            ctx.textBaseline = 'alphabetic';

            // Name
            ctx.fillStyle = isSelected ? '#fff' : '#888';
            let labelFontSize = mobile ? 9 : 11;
            ctx.font = `bold ${UIScale.r(labelFontSize)}px "Press Start 2P", monospace`;
            while (ctx.measureText(opt.label).width > cardW - s(12) && labelFontSize > 5) {
                labelFontSize -= 0.5;
                ctx.font = `bold ${UIScale.r(labelFontSize)}px "Press Start 2P", monospace`;
            }
            ctx.textAlign = 'center';
            ctx.fillText(opt.label, x + cardW / 2, y + cardH * 0.72);

            // Cost / subtitle
            if (opt.cost) {
                ctx.fillStyle = isSelected ? opt.color : '#555';
                ctx.font = `${UIScale.r(mobile ? 7 : 9)}px "Press Start 2P", monospace`;
                ctx.fillText(opt.cost, x + cardW / 2, y + cardH * 0.88);
            }

            // Selection indicator
            if (isSelected) {
                const bounce = Math.sin(time * 6) * s(3);
                ctx.fillStyle = '#fff';
                ctx.font = `${UIScale.r(mobile ? 12 : 14)}px monospace`;
                ctx.fillText('▼', x + cardW / 2, y - s(4) + bounce);
            }
        });

        // Decorative joystick
        this.drawMenuJoystickDecoration(ctx, w * (mobile ? 0.88 : 0.88), h * 0.08, s);

        // Footer
        const hint = mobile
            ? '[D-Pad] SELECIONAR  |  [E] JOGAR  |  [✕] SAIR'
            : '[↑↓ ←→] SELECIONAR  |  [ESPAÇO/E] JOGAR  |  [ESC] SAIR';
        drawMinigameFooter(ctx, w, h, theme, hint);
    }

    private drawMenuJoystickDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, s: (v: number) => number) {
        const time = Date.now();
        const flicker = Math.sin(time / 100) > 0.8 ? 0.3 : 1.0;

        ctx.save();
        ctx.globalAlpha = flicker * 0.6;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = s(2);

        // Base
        ctx.beginPath();
        ctx.moveTo(x - s(15), y + s(10));
        ctx.lineTo(x + s(15), y + s(10));
        ctx.lineTo(x + s(12), y + s(15));
        ctx.lineTo(x - s(12), y + s(15));
        ctx.closePath();
        ctx.stroke();

        // Stick
        ctx.beginPath();
        ctx.moveTo(x, y + s(10));
        ctx.lineTo(x - s(5), y - s(8));
        ctx.stroke();

        // Ball
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(x - s(5), y - s(10), s(4), 0, Math.PI * 2);
        ctx.fill();

        // Buttons
        ctx.beginPath();
        ctx.arc(x + s(18), y + s(2), s(3), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + s(25), y + s(2), s(3), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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
            this.arcadeDialogue.draw(ctx, this.camera);
            this.boothDialogue.draw(ctx, this.camera);
            this.npcManager.drawUI(ctx, this.camera);
        }

        // 5. Minigames
        if (this.activeMinigame === 'purrinha' && this.purrinhaUI) {
            this.purrinhaUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'dice' && this.diceUI) {
            this.diceUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'ronda' && this.rondaUI) {
            this.rondaUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'domino' && this.dominoUI) {
            this.dominoUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'generic' || this.activeMinigame === 'heads_tails' || this.activeMinigame === 'palitinho' || this.activeMinigame === 'fan_tan' || this.activeMinigame === 'jokenpo') {
            if (this.headsTailsUI) this.headsTailsUI.render(ctx, this.screenW, this.screenH);
            if (this.palitinhoUI) this.palitinhoUI.render(ctx, this.screenW, this.screenH);
            if (this.fanTanUI) this.fanTanUI.render(ctx, this.screenW, this.screenH);
            if (this.jokenpoUI) this.jokenpoUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'horse_racing' && this.horseRacingUI) {
            this.horseRacingUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'dog_racing' && this.dogRacingUI) {
            this.dogRacingUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'video_bingo' && this.videoBingoUI) {
            this.videoBingoUI.render(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'bar_menu') {
            this.renderBarMenu(ctx);
        } else if (this.activeMinigame === 'arcade_menu') {
            this.renderArcadeMenu(ctx);
        } else if (this.activeMinigame === 'arcade_air_pong' && this.airPongGame) {
            this.airPongGame.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'arcade_tank_attack' && this.tankAttackGame) {
            this.tankAttackGame.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'arcade_faroeste' && this.faroesteGame) {
            this.faroesteGame.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'arcade_risca_faca' && this.riscaFacaGame) {
            this.riscaFacaGame.draw(ctx, this.screenW, this.screenH);
        } else if (this.activeMinigame === 'arcade_sinuca' && this.sinucaGame) {
            this.sinucaGame.draw(ctx, this.screenW, this.screenH);
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
        if (isNavigating || this.minimap.getMaximized()) {
            this.minimap.render(ctx, this.screenW, this.screenH, this.player.x, this.player.y, this.camera, this.npcManager.npcs);
        }

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

        // 8. Achievement Toasts (above everything except newspaper)
        this.achievementUI.update(0.016); // Approximate dt for render-time toasts
        this.achievementUI.render(ctx, this.screenW, this.screenH);

        // 9. Newspaper (Final Overlay)
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

        if (pm.phase === 'interruption' || pm.phase === 'bribed_interruption') {
            const isBribed = pm.phase === 'bribed_interruption';
            ctx.font = `bold ${UIScale.r(40)}px "Segoe UI"`;
            ctx.fillStyle = isBribed ? '#44aaff' : '#ff4444';

            // Scaled text
            const title = isBribed ? "FISCALIZAÇÃO DE ROTINA" : "POLÍCIA! PARADO!";
            const titleWidth = ctx.measureText(title).width;
            if (titleWidth > w - s(40)) {
                ctx.font = `bold ${UIScale.r(30)}px "Segoe UI"`;
            }
            ctx.fillText(title, cx, cy - s(100));

            ctx.font = `italic ${UIScale.r(20)}px "Segoe UI"`;
            ctx.fillStyle = '#fff';
            this.drawTextWrapped(ctx, `"${pm.currentJoke}"`, cx, cy - s(20), w - s(60), UIScale.r(25));

            ctx.font = `bold ${UIScale.r(14)}px monospace`;
            let expl = isBribed
                ? "A POLÍCIA APARECEU PARA DAR UMA OLHADA... HÁ UM ACORDO, MAS O JOGO PRECISA PARAR."
                : "ACONTECEU UMA BATIDA! ELES ESTÃO DE OLHO NO SEU DINHEIRO...";
            
            if (pm.confiscatedAmount > 0) {
                expl += ` (R$ ${pm.confiscatedAmount} CONFISCADO DA MESA)`;
            }
            this.drawTextWrapped(ctx, expl, cx, cy + s(40), w - s(40), UIScale.r(18));

            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = `bold ${UIScale.r(16)}px monospace`;
            const hint = mobile
                ? (isBribed ? "[ OK ] ACATAR E SAIR" : "[ OK ] OUVIR O POLICIAL")
                : (isBribed ? "[ ESPAÇO ] ACATAR E SAIR" : "[ ESPAÇO ] OUVIR O POLICIAL");
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

    private checkGeographicAchievements() {
        const ach = AchievementManager.getInstance();
        const px = this.player.x;
        const py = this.player.y;

        // 1. Church
        if (px >= 125 && px <= 135 && py >= 86 && py <= 98) {
            ach.recordLocationVisit('church');
        }

        // 2. Plaza Marques de Herval
        if (px >= 148 && px <= 168 && py >= 160 && py <= 190) {
            ach.recordLocationVisit('plaza_main');
        }

        // 3. Marco Imperial
        if (px >= 225 && px <= 245 && py >= 130 && py <= 149) {
            ach.recordLocationVisit('marco_imperial');
        }

        // 4. Residential Areas
        const isResidential = 
            (px >= 45 && px <= 95 && py >= 35 && py <= 145) ||
            (px >= 165 && px <= 215 && py >= 35 && py <= 145) ||
            (px >= 10 && px <= 35) || // Far West Favela
            (px >= 225 && px <= 290) || // Far East Favela
            (py >= 205 && py <= 290); // South Favela

        if (isResidential) {
            ach.recordLocationVisit('residential');
        }

        // 5. High Risk Area (Periphery)
        if (PoliceManager.getInstance().isPeriphery(px, py)) {
            ach.recordLocationVisit('high_risk');
        }
    }
}

