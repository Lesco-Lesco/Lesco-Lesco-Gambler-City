/**
 * ChurchScene — Igreja Nossa Senhora da Conceição.
 * Tema: Barroco, religioso, calmo.
 * Minigame: Rítmico de sentar e levantar durante a missa.
 */

import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { BichoManager } from '../BichoManager';
import { UIScale } from '../Core/UIScale';
import { drawMinigameFooter } from '../Core/MinigameBackground';
import { SoundManager } from '../Core/SoundManager';
import { BuffManager } from '../Core/BuffManager';
import { Camera } from '../Core/Camera';
import { drawCharacter } from '../Entities/CharacterRenderer';
import { AchievementManager } from '../Core/AchievementManager';

type ChurchState = 'intro' | 'playing' | 'success' | 'failed';
type ActionType = 'sit' | 'stand';

export class ChurchScene implements Scene {
    public name = 'church';

    private screenW: number;
    private screenH: number;
    private input: InputManager;
    private camera: Camera;

    // Game State
    private state: ChurchState = 'intro';
    private currentAction: ActionType = 'sit';
    private targetAction: ActionType = 'sit';
    private streak: number = 0;
    private consecutiveErrors: number = 0;
    private timer: number = 0;
    private nextCommandTimer: number = 2.0;
    private inputWindow: number = 0; // Time remaining to hit the command
    private message: string = 'A missa está começando...';
    private subMessage: string = 'Siga as ordens do Padre';
    
    // Callbacks
    public onSceneExitRequest?: () => void;

    // Visuals
    private time: number = 0;
    private npcGuests: { x: number, y: number, state: ActionType, appearance: any }[] = [];

    constructor(screenW: number, screenH: number) {
        this.screenW = screenW;
        this.screenH = screenH;
        this.input = InputManager.getInstance();
        this.camera = new Camera();
        this.camera.zoom = 2.0;

        this.setupNPCs();
    }

    private setupNPCs() {
        // Generate fixed NPCs for the pews
        for (let row = 0; row < 4; row++) {
            for (let side = 0; side < 2; side++) {
                const sideX = side === 0 ? -2 : 2;
                for (let i = 0; i < 3; i++) {
                    this.npcGuests.push({
                        x: sideX + (i * 0.6) - 0.6,
                        y: 2 + row * 1.5,
                        state: 'sit',
                        appearance: {
                            bodyColor: `hsl(${Math.random() * 360}, 30%, 40%)`,
                            legColor: '#222',
                            skinColor: '#d2b48c',
                            hasHat: Math.random() > 0.8,
                            hatColor: '#333'
                        }
                    });
                }
            }
        }
    }

    public resize(w: number, h: number) {
        this.screenW = w;
        this.screenH = h;
    }

    public onEnter() {
        this.state = 'intro';
        this.streak = 0;
        this.consecutiveErrors = 0;
        this.currentAction = 'sit';
        this.nextCommandTimer = 3.0;
        this.message = 'A missa está começando...';
        this.subMessage = 'Prepare-se para acompanhar os fiéis.';
        
        const sm = SoundManager.getInstance();
        sm.fadeOutLoop('ambient_night', 500);
        sm.playLoop('ambient_church' as any); // Assuming this sound exists or fallback
        sm.play('door_enter');

        this.input.pushContext('minigame');
    }

    public onExit() {
        this.input.popContext();
        const sm = SoundManager.getInstance();
        sm.fadeOutLoop('ambient_church' as any, 500);
        sm.play('door_exit');

        // Trigger 'Pecador' achievement upon exiting for the first time
        AchievementManager.getInstance().recordLocationVisit('church');
    }

    public update(dt: number) {
        this.time += dt;
        this.timer += dt;

        if (this.state === 'intro') {
            this.nextCommandTimer -= dt;
            if (this.nextCommandTimer <= 0) {
                this.state = 'playing';
                this.triggerCommand();
            }
        } else if (this.state === 'playing') {
            this.updatePlaying(dt);
        } else if (this.state === 'success' || this.state === 'failed') {
            this.nextCommandTimer -= dt;
            if (this.nextCommandTimer <= 0) {
                if (this.onSceneExitRequest) this.onSceneExitRequest();
            }
        }

        if (this.input.wasPressed('Escape')) {
            if (this.onSceneExitRequest) this.onSceneExitRequest();
        }
    }

    private triggerCommand() {
        // Toggle action
        this.targetAction = this.targetAction === 'sit' ? 'stand' : 'sit';
        this.inputWindow = 1.2; // 1.2 seconds to react
        
        const religiousPhrases = [
            "Louvado seja o Senhor!",
            "Glória a Deus nas alturas!",
            "Em nome do Pai...",
            "Amém, irmãos!",
            "Graças a Deus!",
            "Orai e vigiai!",
            "Paz de Cristo!"
        ];

        this.message = this.targetAction === 'sit' ? "Todos SENTADOS!" : "Todos de PÉ!";
        if (Math.random() < 0.4) {
            this.subMessage = religiousPhrases[Math.floor(Math.random() * religiousPhrases.length)];
        }

        // NPCs follow immediately (except player)
        this.npcGuests.forEach(npc => npc.state = this.targetAction);
        
        SoundManager.getInstance().play('menu_select');
    }

    private updatePlaying(dt: number) {
        if (this.inputWindow > 0) {
            this.inputWindow -= dt;

            const react = this.input.wasPressed('Space') || this.input.wasPressed('KeyE') || this.input.wasPressed('Enter');

            if (react) {
                // Player reacted
                this.currentAction = this.targetAction;
                this.streak++;
                this.consecutiveErrors = 0;
                this.inputWindow = 0; // Action done
                SoundManager.getInstance().play('menu_confirm');

                if (this.streak >= 7) {
                    this.win();
                } else {
                    this.nextCommandTimer = 1.0 + Math.random() * 1.5;
                }
            } else if (this.inputWindow <= 0) {
                // Missed the window
                this.consecutiveErrors++;
                this.streak = 0;
                SoundManager.getInstance().play('lose');
                this.message = "Você se atrasou!";
                
                if (this.consecutiveErrors >= 8) {
                    this.fail();
                } else {
                    this.nextCommandTimer = 2.0;
                }
            }
        } else {
            this.nextCommandTimer -= dt;
            if (this.nextCommandTimer <= 0) {
                this.triggerCommand();
            }
        }
    }

    private win() {
        this.state = 'success';
        this.message = "Você recebeu a comunhão!";
        this.subMessage = "O poder de Deus te guia. (Sorte +10%)";
        this.nextCommandTimer = 4.0;
        
        const buffMgr = BuffManager.getInstance();
        buffMgr.addBuff('comungado', 90); // 90 seconds buff
        buffMgr.setCooldown('church', 300); // 5 min cooldown

        SoundManager.getInstance().play('win_small');
        BichoManager.getInstance().addNotification('Comungado! +10% de Sorte Ativado.', 5);
    }

    private fail() {
        this.state = 'failed';
        this.message = "O Padre pediu para você se retirar.";
        this.subMessage = "Você está muito distraído para a missa.";
        this.nextCommandTimer = 4.0;

        const buffMgr = BuffManager.getInstance();
        buffMgr.setCooldown('church', 300); // 5 min punishment

        SoundManager.getInstance().play('lose');
        BichoManager.getInstance().addNotification('Expulso da igreja! Volte em 5 minutos.', 5);
    }

    public render(ctx: CanvasRenderingContext2D) {
        this.drawBackground(ctx);

        // Altar Area
        this.drawAltar(ctx);

        // Priest
        this.drawEntities(ctx);

        // UI
        this.drawUI(ctx);
    }

    private drawBackground(ctx: CanvasRenderingContext2D) {
        // Floor (Marble/Stone)
        const grad = ctx.createLinearGradient(0, 0, 0, this.screenH);
        grad.addColorStop(0, '#2c2c2c');
        grad.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Perspective Walls
        ctx.fillStyle = '#3d3d3d';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.screenW * 0.2, this.screenH * 0.3);
        ctx.lineTo(this.screenW * 0.8, this.screenH * 0.3);
        ctx.lineTo(this.screenW, 0);
        ctx.fill();

        // Decorative Windows (Stained Glass look)
        for (let i = 0; i < 3; i++) {
            const wx = this.screenW * (0.3 + i * 0.2);
            const wy = this.screenH * 0.05;
            const ww = this.screenW * 0.08;
            const wh = this.screenH * 0.2;

            const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
            winGrad.addColorStop(0, '#ffcc00');
            winGrad.addColorStop(0.5, '#ff3300');
            winGrad.addColorStop(1, '#3366ff');
            
            ctx.fillStyle = winGrad;
            ctx.beginPath();
            ctx.roundRect(wx - ww / 2, wy, ww, wh, UIScale.s(20));
            ctx.fill();
            
            // Inner patterns
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            for(let j=1; j<4; j++) {
                ctx.beginPath();
                ctx.moveTo(wx - ww/2, wy + wh * (j/4));
                ctx.lineTo(wx + ww/2, wy + wh * (j/4));
                ctx.stroke();
            }
        }
    }

    private drawAltar(ctx: CanvasRenderingContext2D) {
        const { sx, sy } = this.camera.worldToScreen(0, 0);
        const z = this.camera.zoom;

        // Altar Base
        ctx.fillStyle = '#5d4037'; // Wood
        ctx.fillRect(sx - 100 * z, sy - 20 * z, 200 * z, 40 * z);
        
        // Golden accents
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx - 100 * z, sy - 20 * z, 200 * z, 5 * z);
        
        // Cross
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx - 2 * z, sy - 60 * z, 4 * z, 40 * z); // Vertical
        ctx.fillRect(sx - 15 * z, sy - 50 * z, 30 * z, 4 * z); // Horizontal
    }

    private drawEntities(ctx: CanvasRenderingContext2D) {
        // 1. NPCs in Pews
        this.npcGuests.forEach(npc => {
            drawCharacter(ctx, this.camera, npc.x, npc.y, npc.appearance, {
                isMoving: false,
                isRunning: false,
                animFrame: 0,
                direction: 'up',
                isSitting: npc.state === 'sit'
            });
        });

        // 2. Player (Centered at the back)
        const playerApp = { bodyColor: '#3498db', legColor: '#2c3e50', skinColor: '#ffdbac' };
        drawCharacter(ctx, this.camera, 0, 8, playerApp as any, {
            isMoving: false,
            isRunning: false,
            animFrame: 0,
            direction: 'up',
            isSitting: this.currentAction === 'sit'
        });

        // 3. Priest (In front of altar)
        const priestApp = { bodyColor: '#ffffff', legColor: '#000', skinColor: '#ffdbac', hasHat: false };
        drawCharacter(ctx, this.camera, 0, -0.5, priestApp as any, {
            isMoving: false,
            isRunning: false,
            animFrame: 0,
            direction: 'down'
        });
    }

    private drawUI(ctx: CanvasRenderingContext2D) {
        const s = UIScale.s.bind(UIScale);
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;

        // Feedback Text
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${UIScale.r(24)}px "Press Start 2P"`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(this.message, cx, cy - s(100));
        ctx.fillText(this.message, cx, cy - s(100));

        ctx.font = `${UIScale.r(14)}px "Press Start 2P"`;
        ctx.strokeText(this.subMessage, cx, cy - s(60));
        ctx.fillText(this.subMessage, cx, cy - s(60));

        // Streak indicator
        if (this.state === 'playing') {
            const barW = s(200);
            const barH = s(20);
            const bx = cx - barW / 2;
            const by = cy + s(150);

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx, by, barW, barH);
            
            // Progress
            const progress = (this.streak / 7) * barW;
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(bx, by, progress, barH);
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, barW, barH);

            ctx.fillStyle = '#fff';
            ctx.font = `${UIScale.r(10)}px "Press Start 2P"`;
            ctx.fillText(`FÉ: ${this.streak}/7`, cx, by - s(10));
        }

        // Action Prompt
        if (this.inputWindow > 0) {
            const prompt = this.targetAction === 'sit' ? '[ESPAÇO] SENTAR' : '[ESPAÇO] LEVANTAR';
            const pulse = 1 + Math.sin(this.time * 10) * 0.1;
            ctx.save();
            ctx.translate(cx, cy + s(50));
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#ffd700';
            ctx.font = `bold ${UIScale.r(20)}px "Press Start 2P"`;
            ctx.strokeText(prompt, 0, 0);
            ctx.fillText(prompt, 0, 0);
            ctx.restore();
        }

        // Footer
        const hint = '[ESPAÇO/E] AGUIR  |  [ESC] SAIR';
        drawMinigameFooter(ctx, this.screenW, this.screenH, { accent: '#ffd700', bg: '#1a1a1a', text: '#fff' } as any, hint);
    }
}
