import { InputManager } from '../Core/InputManager';
import { GamepadManager } from '../Core/GamepadManager';
import { UIScale } from '../Core/UIScale';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { SoundManager } from '../Core/SoundManager';

interface Vec2 { x: number; y: number; }

interface Button {
    id: number;
    homeX: number;
    homeY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    team: number; // 0: Player, 1: Enemy
    isGoalie: boolean;
}

interface Team {
    name: string;
    primary: string;
    secondary: string;
    altPrimary: string;
    altSecondary: string;
}

interface GoalParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotSpeed: number;
    alpha: number;
}

const TEAMS: Team[] = [
    { 
        name: 'CALIPAL F.C.', 
        primary: '#ff8c00', secondary: '#000000', 
        altPrimary: '#ffffff', altSecondary: '#ff8c00' 
    },
    { 
        name: 'E.C. GUANABARA', 
        primary: '#c10000', secondary: '#ffffff', 
        altPrimary: '#111111', altSecondary: '#c10000' 
    },
    { 
        name: 'GRÊMIO DO BICHO', 
        primary: '#5d4037', secondary: '#ffd700', 
        altPrimary: '#00bfff', altSecondary: '#ffd700' 
    },
    { 
        name: 'COBRA CRIADA A.C.', 
        primary: '#1a472a', secondary: '#000000', 
        altPrimary: '#d4ff00', altSecondary: '#1a472a' 
    },
    { 
        name: 'E.C. CESARÃO', 
        primary: '#ffffff', secondary: '#000000', 
        altPrimary: '#00008b', altSecondary: '#ffffff' 
    },
];

export class FutebolBotaoGame {
    private fieldW = 940;
    private fieldH = 520;
    private margin = 40;
    
    public scorePlayer = 0;
    public scoreEnemy = 0;
    public phase: 'kickoff' | 'positioning_goalie' | 'aiming' | 'moving' | 'goal_anim' | 'game_over' = 'kickoff';
    private gameOverPhrase: string = '';

    private playerTeam: Team = TEAMS[0];
    private enemyTeam: Team = TEAMS[1];
    private playerActiveColor = { primary: '#ff8c00', secondary: '#000000' };
    private enemyActiveColor = { primary: '#c10000', secondary: '#ffffff' };

    private ball: { x: number, y: number, vx: number, vy: number, radius: number, spin: number, mass: number } = {
        x: 400, y: 225, vx: 0, vy: 0, radius: 10, spin: 0, mass: 3.0 // 3x heavier
    };

    private buttons: Button[] = [];
    private selectedButtonIndex: number = -1;
    private aimPower = 0;
    private aimAngle = 0;
    private aimRotationSpeed = 0;
    
    private currentTurn: number = 0; // 0: Player, 1: Enemy
    private playsLeft: number = 2;
    private stateTimer: number = 0;

    // Goalie rules
    private lastPlayWasGoalie: boolean = false;
    private readonly GOALIE_BALL_RANGE = 120;
    private readonly GOALIE_MAX_SPEED  = 620;

    // Meticulous Scoring System Stats
    private statsGoalsScored = 0;
    private statsGoalsConceded = 0;
    private statsNutmegs = 0;
    private statsTabelas = 0;
    private statsPerfectShots = 0;

    // Estilômetro
    private estiloMeter: number = 0;        // 0-3
    private readonly ESTILO_MAX = 3;
    private estiloReady: boolean = false;   // super-shot charged
    private ballXAtShot: number = 470;
    private estiloFlash: number = 0;        // notification timer

    // Caneta (nutmeg)
    private nutmegNear: Set<number> = new Set(); // ids of near-missed opponents
    private nutmegDetected: boolean = false;
    private nutmegFlash: number = 0;

    // Tabela (wall bounce)
    private tabelaActive: boolean = false;
    private tabelaFlash: number = 0;

    // Pressão (marking)
    private pressingIdx: number = -1;       // player piece in pressing mode

    // AI Adaptation & Rage mode
    private aiDifficultyFlash: number = 0;
    private aiSuperShotFlash: number = 0;

    private goalParticles: GoalParticle[] = [];
    private shakeIntensity = 0;

    private lastScale = 1;
    private lastOx = 0;
    private lastOy = 0;

    constructor() {
        this.initButtons();
        this.reset();
    }

    private initButtons() {
        this.buttons = [];
        // Formation: 1 Goalie, 3 Defenders, 2 Forwards (1-3-2)
        // Team 0 (Player)
        // Field is now 940x520; goal center at y=260
        this.buttons.push({ id: 0, homeX: 45,  homeY: 260, x: 45,  y: 260, vx: 0, vy: 0, radius: 25, team: 0, isGoalie: true });
        this.buttons.push({ id: 1, homeX: 170, homeY: 110, x: 170, y: 110, vx: 0, vy: 0, radius: 18, team: 0, isGoalie: false });
        this.buttons.push({ id: 2, homeX: 170, homeY: 260, x: 170, y: 260, vx: 0, vy: 0, radius: 18, team: 0, isGoalie: false });
        this.buttons.push({ id: 3, homeX: 170, homeY: 410, x: 170, y: 410, vx: 0, vy: 0, radius: 18, team: 0, isGoalie: false });
        this.buttons.push({ id: 4, homeX: 340, homeY: 175, x: 340, y: 175, vx: 0, vy: 0, radius: 18, team: 0, isGoalie: false });
        this.buttons.push({ id: 5, homeX: 340, homeY: 345, x: 340, y: 345, vx: 0, vy: 0, radius: 18, team: 0, isGoalie: false });

        // Team 1 (Enemy)
        this.buttons.push({ id: 6, homeX: 895, homeY: 260, x: 895, y: 260, vx: 0, vy: 0, radius: 25, team: 1, isGoalie: true });
        this.buttons.push({ id: 7, homeX: 770, homeY: 110, x: 770, y: 110, vx: 0, vy: 0, radius: 18, team: 1, isGoalie: false });
        this.buttons.push({ id: 8, homeX: 770, homeY: 260, x: 770, y: 260, vx: 0, vy: 0, radius: 18, team: 1, isGoalie: false });
        this.buttons.push({ id: 9, homeX: 770, homeY: 410, x: 770, y: 410, vx: 0, vy: 0, radius: 18, team: 1, isGoalie: false });
        this.buttons.push({ id: 10, homeX: 600, homeY: 175, x: 600, y: 175, vx: 0, vy: 0, radius: 18, team: 1, isGoalie: false });
        this.buttons.push({ id: 11, homeX: 600, homeY: 345, x: 600, y: 345, vx: 0, vy: 0, radius: 18, team: 1, isGoalie: false });
    }

    public reset() {
        this.scorePlayer = 0;
        this.scoreEnemy = 0;
        this.phase = 'kickoff';
        this.stateTimer = 2.0; // 2 seconds kickoff delay
        this.currentTurn = 0;
        this.playsLeft = 3;
        this.lastPlayWasGoalie = false;
        this.estiloMeter = 0; this.estiloReady = false; this.estiloFlash = 0;
        this.nutmegNear.clear(); this.nutmegDetected = false; this.nutmegFlash = 0;
        this.tabelaActive = false; this.tabelaFlash = 0;
        this.pressingIdx = -1;
        this.aiDifficultyFlash = 0;
        this.aiSuperShotFlash = 0;

        // Reset meticulous stats
        this.statsGoalsScored = 0;
        this.statsGoalsConceded = 0;
        this.statsNutmegs = 0;
        this.statsTabelas = 0;
        this.statsPerfectShots = 0;

        this.pickRandomTeams();
        this.resetToHome();
    }

    private getRgb(hex: string) {
        const clean = hex.replace('#', '');
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        return { r, g, b };
    }

    private colorsClash(hex1: string, hex2: string): boolean {
        const c1 = this.getRgb(hex1);
        const c2 = this.getRgb(hex2);
        // Euclidean distance in RGB color space
        const dist = Math.sqrt((c1.r - c2.r)**2 + (c1.g - c2.g)**2 + (c1.b - c2.b)**2);
        return dist < 135;
    }

    private pickRandomTeams() {
        const available = [...TEAMS];
        const pIdx = Math.floor(Math.random() * available.length);
        this.playerTeam = available.splice(pIdx, 1)[0];
        const eIdx = Math.floor(Math.random() * available.length);
        this.enemyTeam = available[eIdx];

        // Player team always wears their classic Home colors
        this.playerActiveColor = {
            primary: this.playerTeam.primary,
            secondary: this.playerTeam.secondary
        };

        // If the Enemy team's Home primary clashes with the Player's Home primary,
        // the Enemy wears their Away/Alternate kit to avoid visual confusion.
        if (this.colorsClash(this.playerActiveColor.primary, this.enemyTeam.primary)) {
            this.enemyActiveColor = {
                primary: this.enemyTeam.altPrimary,
                secondary: this.enemyTeam.altSecondary
            };
        } else {
            this.enemyActiveColor = {
                primary: this.enemyTeam.primary,
                secondary: this.enemyTeam.secondary
            };
        }
    }

    public getFinalScore(): number {
        // Goals scored: 25 pts each
        const goalPoints = this.statsGoalsScored * 25;
        
        // Goals conceded: -10 pts each
        const concededPoints = this.statsGoalsConceded * -10;
        
        // Nutmegs: 5 pts each
        const nutmegPoints = this.statsNutmegs * 5;
        
        // Tabelas: 2 pts each
        const tabelaPoints = this.statsTabelas * 2;
        
        // Perfect Shots: 3 pts each
        const perfectPoints = this.statsPerfectShots * 3;
        
        // Win bonus: +20 pts if player reached 3 goals, else 0
        const winBonus = this.scorePlayer >= 3 ? 20 : 0;
        
        // Clean sheet bonus: +15 pts if won and enemy scored 0
        const cleanSheetBonus = (this.scorePlayer >= 3 && this.scoreEnemy === 0) ? 15 : 0;
        
        // Sum it up
        let total = goalPoints + concededPoints + nutmegPoints + tabelaPoints + perfectPoints + winBonus + cleanSheetBonus;
        
        // Clamp: Minimum of 5 points (participation points) to keep rank interesting but modest,
        // and maximum typical perfect game is around 120-130 points.
        return Math.max(5, total);
    }

    private resetToHome() {
        this.ball.x = 470;
        this.ball.y = 260;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.spin = 0;
        for (const b of this.buttons) {
            b.x = b.homeX;
            b.y = b.homeY;
            b.vx = 0; b.vy = 0;
        }
        this.autoSelectBestButton();
    }

    /** Freezes everything in place — ball and pieces stay where they stopped. */
    private resetBallOnly() {
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.spin = 0;
        for (const b of this.buttons) {
            b.vx = 0; b.vy = 0;
        }
        this.autoSelectBestButton();
    }

    private autoSelectBestButton() {
        let bestIdx = -1;
        let minDist = Infinity;
        for (let i = 0; i < this.buttons.length; i++) {
            const b = this.buttons[i];
            if (b.team === this.currentTurn && !b.isGoalie) {
                const d = Math.sqrt((b.x - this.ball.x)**2 + (b.y - this.ball.y)**2);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }
        }
        this.selectedButtonIndex = bestIdx;
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        switch (this.phase) {
            case 'kickoff':
                this.updateKickoff(dt);
                break;
            case 'positioning_goalie':
                this.updateGoaliePositioning(dt);
                break;
            case 'aiming':
                this.updateAiming(dt);
                break;
            case 'moving':
                this.updatePhysics(dt);
                break;
            case 'goal_anim':
                this.stateTimer -= dt;
                if (this.stateTimer <= 0) {
                    if (this.scorePlayer >= 3 || this.scoreEnemy >= 3) {
                        this.phase = 'game_over';
                        this.gameOverPhrase = getMotivationalPhrase();
                    } else {
                        this.resetToHome();
                        this.phase = 'positioning_goalie';
                        this.stateTimer = 1.0;
                    }
                }
                break;
        }

        // Update mechanic flashes
        if (this.estiloFlash > 0) this.estiloFlash -= dt;
        if (this.nutmegFlash > 0) this.nutmegFlash -= dt;
        if (this.tabelaFlash > 0) this.tabelaFlash -= dt;
        if (this.aiDifficultyFlash > 0) this.aiDifficultyFlash -= dt;
        if (this.aiSuperShotFlash > 0) this.aiSuperShotFlash -= dt;

        // Update screen shake
        if (this.shakeIntensity > 0) {
            this.shakeIntensity = Math.max(0, this.shakeIntensity - 8.0 * dt);
        }

        // Update goal particles
        if (this.phase === 'goal_anim') {
            for (const p of this.goalParticles) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 220 * dt; // gravity
                p.rotation += p.rotSpeed * dt;
                p.alpha = Math.max(0, p.alpha - 0.28 * dt);
            }
        } else {
            this.goalParticles = [];
        }
    }

    private updateKickoff(dt: number) {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.phase = 'aiming';
            this.autoSelectBestButton();
        }
    }

    private updateGoaliePositioning(dt: number) {
        const goalieTeam = 1 - this.currentTurn;
        const goalie = this.buttons.find(b => b.team === goalieTeam && b.isGoalie);
        if (!goalie) return;

        const goalMinY = this.fieldH / 2 - 65;
        const goalMaxY = this.fieldH / 2 + 65;

        if (goalieTeam === 0) {
            const input = InputManager.getInstance();
            if (input.isDown('ArrowUp') || input.isDown('KeyW')) goalie.y -= 250 * dt;
            if (input.isDown('ArrowDown') || input.isDown('KeyS')) goalie.y += 250 * dt;
        } else {
            const targetY = Math.max(goalMinY, Math.min(goalMaxY, this.ball.y));
            // Goalie speed scaling with AI Level
            const aiLevel = Math.max(1, Math.min(3, 1 + this.scorePlayer));
            const interpSpeed = aiLevel === 1 ? 4 : aiLevel === 2 ? 6.5 : 9.5;
            goalie.y += (targetY - goalie.y) * interpSpeed * dt;
        }
        
        goalie.y = Math.max(goalMinY, Math.min(goalMaxY, goalie.y));
        
        // Anti-overlap check during positioning
        this.preventBallOverlap(goalie);

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.phase = 'aiming';
            this.autoSelectBestButton();
        }
    }

    private preventBallOverlap(pillar: Button) {
        const dx = this.ball.x - pillar.x;
        const dy = this.ball.y - pillar.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = pillar.radius + this.ball.radius + 2;
        if (dist < minDist) {
            const angle = Math.atan2(dy, dx);
            this.ball.x = pillar.x + Math.cos(angle) * minDist;
            this.ball.y = pillar.y + Math.sin(angle) * minDist;
            this.ball.vx = 0;
            this.ball.vy = 0;
        }
    }

    private updateAiming(dt: number) {
        if (this.currentTurn === 1) {
            this.updateAI(dt);
            return;
        }

        const input = InputManager.getInstance();
        
        // Mouse Selection
        if (input.wasPressed('MouseLeft')) {
            const { x: mx, y: my } = input.getMousePos();
            const gx = (mx - this.lastOx) / this.lastScale;
            const gy = (my - this.lastOy) / this.lastScale;

            for (let i = 0; i < this.buttons.length; i++) {
                const b = this.buttons[i];
                if (b.team !== 0) continue;
                if (b.isGoalie) {
                    // Goalie only selectable when ball is nearby
                    const distToBall = Math.hypot(b.x - this.ball.x, b.y - this.ball.y);
                    if (distToBall > this.GOALIE_BALL_RANGE) continue;
                }
                const d = Math.hypot(b.x - gx, b.y - gy);
                if (d < b.radius + 15) {
                    this.selectedButtonIndex = i;
                    SoundManager.getInstance().play('arcade_bounce');
                    break;
                }
            }
        }

        if (input.wasPressed('KeyQ') || input.wasPressed('Gamepad_X')) {
            const start = this.selectedButtonIndex;
            let next = (start + 1) % this.buttons.length;
            while (next !== start) {
                const btn = this.buttons[next];
                if (btn.team === 0) {
                    if (!btn.isGoalie) break;
                    const distToBall = Math.hypot(btn.x - this.ball.x, btn.y - this.ball.y);
                    if (distToBall <= this.GOALIE_BALL_RANGE) break;
                }
                next = (next + 1) % this.buttons.length;
            }
            if (next !== start) {
                this.selectedButtonIndex = next;
                SoundManager.getInstance().play('arcade_bounce');
            }
        }

        // Pressing: E or Gamepad_Y toggles marking on the selected piece
        // We bypass KeyE if gamepad is active since Gamepad_A triggers both Space and KeyE
        const isGamepadActive = GamepadManager.getInstance().getActiveGamepadIndex() !== null;
        const togglePressing = isGamepadActive 
            ? input.wasPressed('Gamepad_Y') 
            : (input.wasPressed('KeyE') || input.wasPressed('Gamepad_Y'));

        if (togglePressing && this.selectedButtonIndex !== -1) {
            const sel = this.buttons[this.selectedButtonIndex];
            if (sel && sel.team === 0) {
                this.pressingIdx = (this.pressingIdx === this.selectedButtonIndex) ? -1 : this.selectedButtonIndex;
                SoundManager.getInstance().play('arcade_bounce');
            }
        }

        const rotAccel = 12 * dt;
        const maxRotSpeed = 5.0;
        
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
            this.aimRotationSpeed = Math.min(this.aimRotationSpeed + rotAccel, maxRotSpeed);
            this.aimAngle -= this.aimRotationSpeed * dt;
        } else if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
            this.aimRotationSpeed = Math.min(this.aimRotationSpeed + rotAccel, maxRotSpeed);
            this.aimAngle += this.aimRotationSpeed * dt;
        } else {
            this.aimRotationSpeed = 0;
        }
        
        if (input.isDown('Space') || input.isDown('Enter')) {
            this.aimPower = Math.min(this.aimPower + 900 * dt, 900);
        } else if (this.aimPower > 0) {
            this.shoot(this.selectedButtonIndex, this.aimAngle, this.aimPower);
            this.aimPower = 0;
        }
    }

    private updateAI(dt: number) {
        this.stateTimer += dt;
        
        // Target player goal on the left
        const targetGoalY = this.fieldH / 2;
        const playerGoalie = this.buttons.find(g => g.team === 0 && g.isGoalie);
        
        let Tx = 10;
        let Ty = targetGoalY;
        
        const aiLevel = Math.max(1, Math.min(3, 1 + this.scorePlayer));
        
        if (aiLevel === 2) {
            // Level 2: Aim at the center of the player's goal
            Ty = 260;
        } else if (aiLevel === 3 && playerGoalie) {
            // Level 3: Smart aim, target the corner furthest from player's goalkeeper
            Ty = playerGoalie.y < 260 ? 315 : 205;
        }

        // 1. Select the best button based on tactical direction and own goal prevention
        let selectedIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < this.buttons.length; i++) {
            const b = this.buttons[i];
            if (b.team === 1) {
                if (b.isGoalie) {
                    const distToBall = Math.hypot(b.x - this.ball.x, b.y - this.ball.y);
                    if (distToBall > this.GOALIE_BALL_RANGE) continue;
                }
                const d = Math.hypot(b.x - this.ball.x, b.y - this.ball.y);
                const pToBallX = this.ball.x - b.x;
                const pToBallY = this.ball.y - b.y;

                let score = 1000 - d;
                const isBehindBall = b.x > this.ball.x; // Piece is on the right of the ball (can push left)

                if (isBehindBall) {
                    score += 400; // Pushing towards player's goal is a good tactical choice
                } else if (this.ball.x > 500) {
                    // Pushing to the right (towards own goal) in own defensive half.
                    // Let's check if the straight line trajectory goes towards the goal mouth (y between 180 and 340)
                    const dx = pToBallX;
                    const dy = pToBallY;
                    if (dx > 0) {
                        const t = (940 - this.ball.x) / dx;
                        const yAtGoal = this.ball.y + dy * t;
                        if (yAtGoal > 180 && yAtGoal < 340) {
                            score -= 1500; // Massive penalty for direct own-goal danger!
                        } else {
                            score -= 300;  // Moderate penalty for clearing to the side walls/corners
                        }
                    } else {
                        score -= 300;
                    }
                } else {
                    score -= 100; // In opponent's half, pushing right is not dangerous, just suboptimal
                }

                if (score > bestScore) {
                    bestScore = score;
                    selectedIdx = i;
                }
            }
        }
        
        this.selectedButtonIndex = selectedIdx;
        const b = this.buttons[selectedIdx];
        if (!b) return;

        // 2. Calculate the ideal shot angle and power
        let angle = 0;
        let power = 400 + Math.random() * 450;
        
        const isBehindBall = b.x > this.ball.x;
        if (!isBehindBall) {
            // Clearance target: AI's own corner (top-right or bottom-right)
            Tx = 930;
            Ty = b.y < this.ball.y ? 490 : 30; // Push down to bottom-right or up to top-right
        }

        if (aiLevel === 1) {
            // Level 1: Aim directly at the ball with a slow-moving time wobble
            let dx = this.ball.x - b.x;
            let dy = this.ball.y - b.y;
            
            // If pushing own goal, deflect it significantly towards the walls
            if (!isBehindBall) {
                dy += b.y < this.ball.y ? 150 : -150;
            }

            angle = Math.atan2(dy, dx);
            
            const wobble = Math.sin(Date.now() * 0.004) * 0.22;
            angle += wobble;
            power = 320 + Math.random() * 180;
        } else {
            // Level 2 & 3: Aim at the ideal impact position behind the ball relative to target
            const targetDx = Tx - this.ball.x;
            const targetDy = Ty - this.ball.y;
            const targetDist = Math.hypot(targetDx, targetDy);
            const targetNx = targetDx / targetDist;
            const targetNy = targetDy / targetDist;

            const distBetween = b.radius + this.ball.radius;
            const impactX = this.ball.x - targetNx * distBetween;
            const impactY = this.ball.y - targetNy * distBetween;

            // Check if piece is in front of the impact position relative to target direction
            const dot = (this.ball.x - b.x) * targetNx + (this.ball.y - b.y) * targetNy;
            
            if (dot > 0) {
                angle = Math.atan2(impactY - b.y, impactX - b.x);
            } else {
                // Fallback: aim at the ball but deflect it towards the target
                angle = Math.atan2(this.ball.y - b.y, this.ball.x - b.x);
            }

            // Wobble/precision based on level
            const wobbleRange = aiLevel === 2 ? 0.12 : 0.03;
            angle += Math.sin(Date.now() * 0.005) * wobbleRange;
            
            power = aiLevel === 2 ? 480 + Math.random() * 160 : 700 + Math.random() * 180;
        }

        // Store aiming information so we can draw the AI's red warning line
        this.aimAngle = angle;
        this.aimPower = power;

        // 3. Shoot when "thinking" phase concludes
        if (this.stateTimer > 1.2) {
            // Level 3 gets a 40% chance of triggered Super Shot with spin!
            if (aiLevel === 3 && Math.random() < 0.40) {
                power *= 1.35;
                (this.ball as any)._spinBoost = 1.25;
                this.aiSuperShotFlash = 2.0;
                SoundManager.getInstance().play('arcade_shoot');
            }
            
            this.shoot(this.selectedButtonIndex, angle, power);
            this.stateTimer = 0;
        }
    }

    private shoot(idx: number, angle: number, power: number) {
        if (idx === -1) return;
        const b = this.buttons[idx];

        // Consecutive goalie rule: if last play was goalie and now a field player shoots,
        // snap the goalie back to goal immediately
        if (this.lastPlayWasGoalie && !b.isGoalie) {
            const goalie = this.buttons.find(g => g.team === this.currentTurn && g.isGoalie);
            if (goalie) {
                goalie.x  = goalie.homeX;
                goalie.y  = goalie.homeY;
                goalie.vx = 0;
                goalie.vy = 0;
            }
        }

        this.ballXAtShot = this.ball.x;
        this.nutmegNear.clear();

        let finalPower = power;
        let spinBoost = 1.0;
        if (this.estiloReady && this.currentTurn === 0) {
            finalPower *= 1.35;
            spinBoost = 1.25;
            this.estiloReady = false;
            this.estiloMeter = 0;
            this.estiloFlash = 2.0;
            // Apply spin boost flag via a temporary field
            (this.ball as any)._spinBoost = spinBoost;
        }

        if (b.isGoalie) {
            const goalPower = finalPower * 1.4;
            b.vx = Math.cos(angle) * goalPower;
            b.vy = Math.sin(angle) * goalPower;
            const speed = Math.hypot(b.vx, b.vy);
            if (speed > this.GOALIE_MAX_SPEED) {
                b.vx = (b.vx / speed) * this.GOALIE_MAX_SPEED;
                b.vy = (b.vy / speed) * this.GOALIE_MAX_SPEED;
            }
        } else {
            b.vx = Math.cos(angle) * finalPower;
            b.vy = Math.sin(angle) * finalPower;
        }

        this.lastPlayWasGoalie = b.isGoalie;
        this.phase = 'moving';
        SoundManager.getInstance().play('arcade_hit');
    }

    private lineSegmentsIntersect(A: Vec2, B: Vec2, C: Vec2, D: Vec2): boolean {
        const rX = B.x - A.x;
        const rY = B.y - A.y;
        const sX = D.x - C.x;
        const sY = D.y - C.y;
        const denom = rX * sY - rY * sX;
        if (denom === 0) return false;
        const t = ((C.x - A.x) * sY - (C.y - A.y) * sX) / denom;
        const u = ((C.x - A.x) * rY - (C.y - A.y) * rX) / denom;
        return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
    }

    private updatePhysics(dt: number) {
        const friction = 0.965;       // Buttons slow down faster (less sliding)
        const ballFriction = 0.988;   // Ball rolls a bit more freely
        let moving = false;

        const prevBallX = this.ball.x;
        const prevBallY = this.ball.y;

        for (const b of this.buttons) {
            if (Math.abs(b.vx) > 1 || Math.abs(b.vy) > 1) {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.vx *= friction;
                b.vy *= friction;
                moving = true;
                this.checkWallCollision(b);
            } else {
                b.vx = 0; b.vy = 0;
            }
        }

        if (Math.abs(this.ball.vx) > 1 || Math.abs(this.ball.vy) > 1) {
            if (Math.abs(this.ball.spin) > 0.02) {
                const speed = Math.sqrt(this.ball.vx ** 2 + this.ball.vy ** 2);
                const angle = Math.atan2(this.ball.vy, this.ball.vx) + this.ball.spin * dt * 1.2;
                this.ball.vx = Math.cos(angle) * speed;
                this.ball.vy = Math.sin(angle) * speed;
                this.ball.spin *= 0.88;
            }

            this.ball.x += this.ball.vx * dt;
            this.ball.y += this.ball.vy * dt;
            this.ball.vx *= ballFriction;
            this.ball.vy *= ballFriction;
            moving = true;
            this.checkBallWallCollision();
        } else {
            this.ball.vx = 0; this.ball.vy = 0; this.ball.spin = 0;
        }

        for (let i = 0; i < this.buttons.length; i++) {
            const b1 = this.buttons[i];
            this.checkCircleCollision(b1, this.ball, true);
            for (let j = i + 1; j < this.buttons.length; j++) {
                this.checkCircleCollision(b1, this.buttons[j], false);
            }
        }

        // Nutmeg: track if ball segment intersects any pair of opponent buttons that are close together
        if (this.currentTurn === 0 && !this.nutmegDetected && (Math.abs(this.ball.vx) > 1 || Math.abs(this.ball.vy) > 1)) {
            const opps = this.buttons.filter(b => b.team === 1);
            const ballA = { x: prevBallX, y: prevBallY };
            const ballB = { x: this.ball.x, y: this.ball.y };
            
            outer: for (let i = 0; i < opps.length; i++) {
                const o1 = opps[i];
                for (let j = i + 1; j < opps.length; j++) {
                    const o2 = opps[j];
                    const distBetweenO = Math.hypot(o1.x - o2.x, o1.y - o2.y);
                    if (distBetweenO < 95) {
                        const segC = { x: o1.x, y: o1.y };
                        const segD = { x: o2.x, y: o2.y };
                        if (this.lineSegmentsIntersect(ballA, ballB, segC, segD)) {
                            this.nutmegDetected = true;
                            this.nutmegFlash = 2.5;
                            this.statsNutmegs++;
                            SoundManager.getInstance().play('win_small');
                            break outer;
                        }
                    }
                }
            }
        }

        // Pressing: soft deflection when ball passes near marked piece
        if (this.pressingIdx !== -1 && this.currentTurn === 1) {
            const p = this.buttons[this.pressingIdx];
            if (p) {
                const dist = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
                const intercept = p.radius + this.ball.radius + 28;
                if (dist < intercept && dist > p.radius + this.ball.radius) {
                    const nx = (this.ball.x - p.x) / dist;
                    const ny = (this.ball.y - p.y) / dist;
                    this.ball.vx += nx * 120;
                    this.ball.vy += ny * 120;
                }
            }
        }

        if (!moving) {
            this.finishPlay();
        }
    }

    private checkWallCollision(b: Button) {
        if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -0.5; }
        if (b.x + b.radius > this.fieldW) { b.x = this.fieldW - b.radius; b.vx *= -0.5; }
        if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -0.5; }
        if (b.y + b.radius > this.fieldH) { b.y = this.fieldH - b.radius; b.vy *= -0.5; }
    }

    private checkBallWallCollision() {
        const b = this.ball;
        const goalMinY = this.fieldH / 2 - 65;
        const goalMaxY = this.fieldH / 2 + 65;
        if (b.y > goalMinY && b.y < goalMaxY) {
            if (b.x < 0) this.scoreGoal(1);
            if (b.x > this.fieldW) this.scoreGoal(0);
            return;
        }
        const bounced =
            (b.x - b.radius < 0) || (b.x + b.radius > this.fieldW) ||
            (b.y - b.radius < 0) || (b.y + b.radius > this.fieldH);
        if (b.x - b.radius < 0) { b.x = b.radius; b.vx *= -0.8; }
        if (b.x + b.radius > this.fieldW) { b.x = this.fieldW - b.radius; b.vx *= -0.8; }
        if (b.y - b.radius < 0) { b.y = b.radius; b.vy *= -0.8; }
        if (b.y + b.radius > this.fieldH) { b.y = this.fieldH - b.radius; b.vy *= -0.8; }
        if (bounced) { this.tabelaActive = true; }
    }

    private checkCircleCollision(c1: any, c2: any, isBall: boolean) {
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = c1.radius + c2.radius;

        if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const angle = Math.atan2(dy, dx);
            const overlap = minDist - dist;
            
            const c1IsOpponent = c1.team !== undefined && c1.team !== this.currentTurn;
            const c2IsOpponent = c2.team !== undefined && c2.team !== this.currentTurn;

            // Push out immediately
            if (c1IsOpponent) {
                c2.x += Math.cos(angle) * overlap;
                c2.y += Math.sin(angle) * overlap;
            } else if (c2IsOpponent) {
                c1.x -= Math.cos(angle) * overlap;
                c1.y -= Math.sin(angle) * overlap;
            } else {
                c1.x -= Math.cos(angle) * overlap * 0.5;
                c1.y -= Math.sin(angle) * overlap * 0.5;
                c2.x += Math.cos(angle) * overlap * 0.5;
                c2.y += Math.sin(angle) * overlap * 0.5;
            }

            const nx = dx / dist;
            const ny = dy / dist;
            
            // Mass-based elastic collision
            const m1 = 1.0;
            const m2 = isBall ? this.ball.mass : 1.0;

            if (c1IsOpponent) {
                // Static vs Mobile
                const v2n = c2.vx * nx + c2.vy * ny;
                c2.vx -= 1.8 * v2n * nx;
                c2.vy -= 1.8 * v2n * ny;
            } else if (c2IsOpponent) {
                const v1n = c1.vx * nx + c1.vy * ny;
                c1.vx -= 1.8 * v1n * nx;
                c1.vy -= 1.8 * v1n * ny;
            } else {
                // Mobile vs Mobile
                const v1n = c1.vx * nx + c1.vy * ny;
                const v2n = c2.vx * nx + c2.vy * ny;
                
                const p = (2.0 * (v1n - v2n)) / (m1 + m2);
                c1.vx -= p * m2 * nx;
                c1.vy -= p * m2 * ny;
                c2.vx += p * m1 * nx;
                c2.vy += p * m1 * ny;
            }

            if (isBall) {
                const dot = (c1.vx * nx + c1.vy * ny);
                if (Math.abs(dot) < 400) {
                    const spinMult = this.tabelaActive ? 1.25 : 1.0;
                    c2.spin = (c1.vy * nx - c1.vx * ny) * 0.003 * spinMult;
                    if (this.tabelaActive) {
                        this.tabelaActive = false;
                        this.tabelaFlash = 1.5;
                        this.statsTabelas++;
                    }
                }
                SoundManager.getInstance().play('arcade_bounce');
            }
        }
    }

    private scoreGoal(team: number) {
        if (team === 0) {
            this.scorePlayer++;
            this.statsGoalsScored++;
        } else {
            this.scoreEnemy++;
            this.statsGoalsConceded++;
        }
        this.phase = 'goal_anim';
        this.stateTimer = 3.5;
        SoundManager.getInstance().play('win_big');

        // Trigger vigorous screen shake
        this.shakeIntensity = 28;

        // Spawn 80 colorful confetti particles bursting from the scored goal
        const burstX = team === 0 ? this.fieldW : 0;
        const burstY = this.fieldH / 2;
        const colors = ['#ff0055', '#00ffff', '#ffff00', '#00ff55', '#ff8800', '#cc00ff', '#ffffff'];

        this.goalParticles = [];
        for (let i = 0; i < 80; i++) {
            // Burst towards the field: if player scored on the right (team 0), burst leftwards (angle near PI).
            // If enemy scored on the left (team 1), burst rightwards (angle near 0).
            const angleRange = Math.PI * 0.7;
            const baseAngle = team === 0 ? Math.PI : 0;
            const angle = baseAngle + (Math.random() - 0.5) * angleRange;
            
            const speed = 120 + Math.random() * 260;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 50; // lift upward

            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 5 + Math.random() * 8;
            const rotSpeed = (Math.random() - 0.5) * 8;

            this.goalParticles.push({
                x: burstX,
                y: burstY + (Math.random() - 0.5) * 80, // spread along goal mouth
                vx,
                vy,
                color,
                size,
                rotation: Math.random() * Math.PI,
                rotSpeed,
                alpha: 1.0
            });
        }
    }

    private finishPlay() {
        this.aimPower = 0;
        this.aimRotationSpeed = 0;

        // Estilômetro: did ball advance toward opponent goal?
        if (this.currentTurn === 0) {
            if (this.ball.x > this.ballXAtShot + 20) {
                this.estiloMeter = Math.min(this.estiloMeter + 1, this.ESTILO_MAX);
                if (this.estiloMeter >= this.ESTILO_MAX && !this.estiloReady) {
                    this.estiloReady = true;
                    this.estiloFlash = 3.0;
                    this.statsPerfectShots++;
                }
            } else {
                this.estiloMeter = Math.max(0, this.estiloMeter - 1);
            }
        }

        // Caneta bonus play
        if (this.nutmegDetected && this.currentTurn === 0) {
            this.playsLeft++; // award extra play
            this.nutmegDetected = false;
        }
        this.nutmegNear.clear();

        const turnChanged = (this.playsLeft <= 1);
        this.playsLeft--;

        if (this.playsLeft <= 0) {
            this.currentTurn = 1 - this.currentTurn;
            this.playsLeft = 3;
            this.lastPlayWasGoalie = false;
            this.pressingIdx = -1;
            this.resetBallOnly();
            this.phase = 'positioning_goalie';
            this.stateTimer = 1.0;
        } else {
            this.autoSelectBestButton();
            this.phase = 'aiming';
            this.stateTimer = 0;
        }

        // Keep goalie in goal during opponent's play, and clear overlapping buttons
        const goaliesToReset: Button[] = [];
        if (turnChanged) {
            // Turn transitioned: reset BOTH goalies to their goals
            const g1 = this.buttons.find(g => g.team === 0 && g.isGoalie);
            const g2 = this.buttons.find(g => g.team === 1 && g.isGoalie);
            if (g1) goaliesToReset.push(g1);
            if (g2) goaliesToReset.push(g2);
        } else {
            // Active turn: only reset the defending goalie (1 - currentTurn)
            const defGoalie = this.buttons.find(g => g.team === (1 - this.currentTurn) && g.isGoalie);
            if (defGoalie) goaliesToReset.push(defGoalie);
        }

        const goalMinY = this.fieldH / 2 - 65;
        const goalMaxY = this.fieldH / 2 + 65;

        for (const goalie of goaliesToReset) {
            // Check for any other button overlapping this goalie's home position
            for (const b of this.buttons) {
                if (b.id !== goalie.id) {
                    const distToGoalieHome = Math.hypot(b.x - goalie.homeX, b.y - goalie.homeY);
                    if (distToGoalieHome < 48) {
                        b.x = b.homeX;
                        b.y = b.homeY;
                        b.vx = 0;
                        b.vy = 0;
                    }
                }
            }
            
            // Snap the goalie back to its goal line
            goalie.x = goalie.homeX;
            if (goalie.y < goalMinY || goalie.y > goalMaxY) {
                goalie.y = goalie.homeY;
            }
            goalie.vx = 0;
            goalie.vy = 0;
        }
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Pulsing background stadium strobe lights during goal celebration
        let bgStyle = '#051a0a';
        if (this.phase === 'goal_anim') {
            const flashVal = Math.floor(Date.now() / 150) % 3;
            bgStyle = flashVal === 0 ? '#1a052e' : flashVal === 1 ? '#052a1a' : '#05122e';
        }
        ctx.fillStyle = bgStyle;
        ctx.fillRect(0, 0, screenW, screenH);

        this.lastScale = Math.min(screenW * 0.95 / this.fieldW, screenH * 0.85 / this.fieldH);
        this.lastOx = (screenW - this.fieldW * this.lastScale) / 2;
        this.lastOy = (screenH - this.fieldH * this.lastScale) / 2 + s(20);

        // Draw Team Names in the background or UI
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.textAlign = 'left';
        ctx.font = `bold ${r(40)}px monospace`;
        ctx.fillText(this.playerTeam.name, s(20), screenH - s(20));
        ctx.textAlign = 'right';
        ctx.fillText(this.enemyTeam.name, screenW - s(20), screenH - s(20));

        // Screen Shake calculation
        let shakeX = 0;
        let shakeY = 0;
        if (this.shakeIntensity > 0) {
            shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            shakeY = (Math.random() - 0.5) * this.shakeIntensity;
        }

        ctx.save();
        ctx.translate(this.lastOx + shakeX, this.lastOy + shakeY);
        ctx.scale(this.lastScale, this.lastScale);

        // Field Grass
        ctx.fillStyle = '#0a3a15';
        ctx.fillRect(-this.margin, -this.margin, this.fieldW + this.margin * 2, this.fieldH + this.margin * 2);
        for(let x=0; x<this.fieldW; x+=100) {
            ctx.fillStyle = (x/100)%2===0 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, 0, 100, this.fieldH);
        }
        
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.fieldW, this.fieldH);
        ctx.beginPath();
        ctx.moveTo(this.fieldW / 2, 0);
        ctx.lineTo(this.fieldW / 2, this.fieldH);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.fieldW / 2, this.fieldH / 2, 60, 0, Math.PI * 2);
        ctx.stroke();

        // Goal posts — centered on new field height (520), opening 130px tall
        const goalY = this.fieldH / 2 - 65;
        const goalH = 130;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.strokeRect(-25, goalY, 25, goalH);
        ctx.strokeRect(this.fieldW, goalY, 25, goalH);

        for (let i = 0; i < this.buttons.length; i++) {
            const b = this.buttons[i];
            const activeColor = b.team === 0 ? this.playerActiveColor : this.enemyActiveColor;
            const isSelected = (i === this.selectedButtonIndex && this.phase === 'aiming' && this.currentTurn === 0);
            
            ctx.save();
            
            // 1. Subtle Shadow (Depth)
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 3;
            
            // 2. Main Body (Thick Plastic with Opacity)
            ctx.globalAlpha = 0.85; 
            ctx.fillStyle = activeColor.primary;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 3. Decoration Ring
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = activeColor.secondary;
            ctx.lineWidth = b.radius * 0.2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            
            // 4. Subtle Gloss/Highlight
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();

            // 5. AI Adaptability Glow Effect
            if (b.team === 1) {
                const aiLevel = Math.max(1, Math.min(3, 1 + this.scorePlayer));
                if (aiLevel === 2) {
                    // Removed: AI Adaptability Glow Effect
                }
            }

            // 6. Selection Effect
            if (isSelected) {
                ctx.save();
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#fff';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius + 8 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // 7. Pressing Mode Effect
            if (i === this.pressingIdx) {
                ctx.save();
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff4400';
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Player Aiming Dotted Line
        if (this.phase === 'aiming' && this.currentTurn === 0 && this.selectedButtonIndex !== -1) {
            const b = this.buttons[this.selectedButtonIndex];
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            const aimX = b.x + Math.cos(this.aimAngle) * 140;
            const aimY = b.y + Math.sin(this.aimAngle) * 140;
            ctx.lineTo(aimX, aimY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            const arrowAngle = this.aimAngle;
            ctx.beginPath();
            ctx.moveTo(aimX, aimY);
            ctx.lineTo(aimX - 15 * Math.cos(arrowAngle - 0.5), aimY - 15 * Math.sin(arrowAngle - 0.5));
            ctx.lineTo(aimX - 15 * Math.cos(arrowAngle + 0.5), aimY - 15 * Math.sin(arrowAngle + 0.5));
            ctx.closePath();
            ctx.fill();

            if (this.aimPower > 0) {
                const p = this.aimPower / 900;
                ctx.fillStyle = `rgb(${255*p}, ${255*(1-p)}, 0)`;
                ctx.fillRect(b.x - 25, b.y + b.radius + 15, p * 50, 8);
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(b.x - 25, b.y + b.radius + 15, 50, 8);
            }
        }

        // Draw goal confetti particles inside the field coordinate system
        if (this.phase === 'goal_anim') {
            for (const p of this.goalParticles) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            }
        }

        // Removed: AI Aiming Dotted Line and label to make AI actions completely invisible and natural to read!

        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = `bold ${r(28)}px monospace`;
        ctx.fillText(`${this.playerTeam.name} ${this.scorePlayer} - ${this.scoreEnemy} ${this.enemyTeam.name}`, screenW / 2, this.lastOy - s(30));
        
        // Removed: AI Difficulty Badge UI to keep it completely hidden

        ctx.font = `bold ${r(16)}px monospace`;
        let status = "";
        let color = "#fff";
        if (this.phase === 'kickoff') {
            status = "PREPARE-SE PARA O KICK-OFF!";
            color = "#ffff00";
        }
        else if (this.phase === 'positioning_goalie') {
            status = this.currentTurn === 1 ? "POSICIONE SEU GOLEIRO (W/S)" : "IA POSICIONANDO GOLEIRO...";
            color = "#00ffff";
        }
        else if (this.phase === 'aiming') {
            status = this.currentTurn === 0 ? `JOGADA ${4-this.playsLeft}/3 - CLIQUE PARA SELECIONAR` : "VEZ DO ADVERSÁRIO...";
            color = this.currentTurn === 0 ? "#00ff88" : "#ff4444";
        }
        else if (this.phase === 'goal_anim') {
            status = "GOOOOOOOOOOL!!!";
            color = "#ffff00";
        }
        
        ctx.fillStyle = color;
        ctx.fillText(status, screenW / 2, this.lastOy + (this.fieldH * this.lastScale) + s(50));

        // Estilômetro UI
        const barW = s(200);
        const barH = s(15);
        const barX = screenW / 2 - barW / 2;
        const barY = this.lastOy - s(70);
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        
        const fillP = this.estiloMeter / this.ESTILO_MAX;
        const barColor = this.estiloReady ? `rgb(255, ${150 + Math.sin(Date.now()*0.01)*100}, 0)` : '#00ff88';
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW * fillP, barH);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        
        ctx.font = `bold ${r(12)}px monospace`;
        ctx.fillStyle = '#fff';
        ctx.fillText("ESTILÔMETRO", screenW / 2, barY - s(5));

        // Notifications/Flashes
        ctx.font = `italic bold ${r(32)}px monospace`;
        ctx.textAlign = 'center';
        
        // Removed: AI Difficulty and Super Shot notification flashes
        if (this.nutmegFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 0, ${Math.min(1, this.nutmegFlash)})`;
            ctx.fillText("CANETA!!! +1 JOGADA", screenW / 2, screenH / 2);
        }
        else if (this.tabelaFlash > 0) {
            ctx.fillStyle = `rgba(0, 255, 255, ${Math.min(1, this.tabelaFlash)})`;
            ctx.fillText("TABELA! CURVA BÔNUS", screenW / 2, screenH / 2);
        }
        else if (this.estiloFlash > 0) {
            ctx.fillStyle = `rgba(255, 100, 0, ${Math.min(1, this.estiloFlash)})`;
            ctx.fillText(this.estiloReady ? "SUPER CHUTE CARREGADO!" : "ESTILO STREET!", screenW / 2, screenH / 2);
        }

        // Giant Retro Arcade GOOL Celebration Alert
        if (this.phase === 'goal_anim') {
            ctx.save();
            ctx.translate(screenW / 2, screenH / 2);
            
            // Pulsing scale bounce using sine wave
            const scaleBounce = 1.0 + Math.sin(Date.now() * 0.015) * 0.25;
            ctx.scale(scaleBounce, scaleBounce);
            
            // Slight rotation wobble for playfulness
            const rotWobble = Math.sin(Date.now() * 0.015) * 0.1;
            ctx.rotate(rotWobble);
            
            // Premium double drop shadow
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffff00';
            ctx.fillStyle = '#ff0055';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = s(6);
            ctx.font = `italic bold ${r(80)}px Impact, Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw double drop-shadow effect
            ctx.strokeText("GOOOOOOL!!!", 0, 0);
            ctx.fillText("GOOOOOOL!!!", 0, 0);
            
            ctx.restore();
        }

        if (this.phase === 'kickoff') {
            ctx.save();
            ctx.translate(screenW / 2, screenH / 2);
            
            // Pulsing scale bounce
            const scaleBounce = 1.0 + Math.sin(Date.now() * 0.01) * 0.15;
            ctx.scale(scaleBounce, scaleBounce);
            
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff88';
            ctx.fillStyle = '#ffaa00';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = s(5);
            ctx.font = `italic bold ${r(60)}px Impact, Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.strokeText("KICK-OFF!", 0, 0);
            ctx.fillText("KICK-OFF!", 0, 0);
            
            ctx.restore();
        }

        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.scorePlayer, this.gameOverPhrase);
        }
    }
}
