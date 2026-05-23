import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { SoundManager } from '../Core/SoundManager';

interface Fighter {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    maxHp: number;
    stun: number;
    maxStun: number;
    energy: number;
    maxEnergy: number;
    comboCount: number;
    comboTimer: number;
    state: 'idle' | 'moving' | 'attack' | 'hit' | 'stunned' | 'dead' | 'defending';
    stateTimer: number;
    team: number; // 0: Player, 1: Enemy
    comboStep: number;        // 0–3: position in the 3-hit combo sequence
    comboWindowTimer: number; // time remaining to chain the next combo hit
    direction: number; // 1: Right, -1: Left
    charId: number;
    isBisected?: boolean;
    bisectTimer?: number;
    attackCooldownTimer?: number;
    defenseCooldownTimer?: number;
}

interface Hazard {
    x: number;
    y: number;
    type: 'rock' | 'tree' | 'hurricane' | 'fire';
    vx: number;
    vy: number;
    active: boolean;
    timer: number;
    ownerTeam?: number;
}

interface Spark {
    x: number;
    y: number;
    color: string;
    size: number;
    timer: number;
    maxTimer: number;
    vx?: number;
    vy?: number;
}

export class ValoriumGame {
    private fieldW = 800;
    private fieldH = 450;
    private groundY = 380;
    
    public phase: 'char_select' | 'opponent_select' | 'boss_intro' | 'round_intro' | 'fighting' | 'round_end' | 'game_over' = 'char_select';
    private round = 1;
    private playerWins = 0;
    private enemyWins = 0;
    private gameOverPhrase: string = '';
    
    private p1: Fighter;
    private p2: Fighter;
    private hazards: Hazard[] = [];
    private stateTimer = 3; // Round intro timer
    private dragonFrame = 0;
    private dragonFire = 0;
    private dragonDirection = 1;

    // Autocombo / Special system
    private autocomboAttacker: Fighter | null = null;
    private autocomboDefender: Fighter | null = null;
    private autocomboStep = 0;
    private autocomboTimer = 0;
    private maxAutocomboSteps = 7; // 6 rapid hits + 1 finisher
    private screenFlash = 0;
    private screenFlashColor = '255, 255, 255';
    private sparks: Spark[] = [];

    // Pre-special dramatic freeze
    private specialPreFreezeTimer = 0;
    private specialPreFreezeAttacker: Fighter | null = null;
    private specialPreFreezeDefender: Fighter | null = null;

    // Detailed Score Tracking
    private playerMaxCombo = 0;
    private perfectRounds = 0;
    private specialFinishedMatch = false;
    private totalMatchTime = 0;

    private characters = [
        // comboWindow  = seconds the player has to chain the next hit after the previous one
        // comboEndCooldown = recovery after the 3rd hit (longer = more punishment window for opponent)
        { name: 'FROST',         speed: 310, damage: 10, hp: 105, color: '#00ffff', attackDuration: 0.33, attackCooldown: 0.11, defenseCooldown: 0.14, comboWindow: 0.38, comboEndCooldown: 0.55 },
        { name: 'VULCAN',        speed: 210, damage: 13, hp: 125, color: '#ff4400', attackDuration: 0.40, attackCooldown: 0.17, defenseCooldown: 0.20, comboWindow: 0.48, comboEndCooldown: 0.88 },
        { name: 'SHADOW',        speed: 430, damage: 9,  hp: 88,  color: '#aa00ff', attackDuration: 0.24, attackCooldown: 0.08, defenseCooldown: 0.10, comboWindow: 0.26, comboEndCooldown: 0.62 },
        { name: 'JADE',          speed: 350, damage: 11, hp: 105, color: '#00ff88', attackDuration: 0.29, attackCooldown: 0.10, defenseCooldown: 0.12, comboWindow: 0.35, comboEndCooldown: 0.50 },
        { name: 'BEHEMOTH',      speed: 140, damage: 15, hp: 135, color: '#ffffff', attackDuration: 0.62, attackCooldown: 0.35, defenseCooldown: 0.42, comboWindow: 0.55, comboEndCooldown: 1.05 },
        { name: 'VALKOR (BOSS)', speed: 250, damage: 11, hp: 230, color: '#7a00ff', attackDuration: 0.33, attackCooldown: 0.12, defenseCooldown: 0.15, comboWindow: 0.30, comboEndCooldown: 0.75 }
    ];

    private selectedCharIndex = 0;

    // Arcade Mode Properties
    private arcadeOpponentsDefeated: boolean[] = [false, false, false, false, false];
    private isBossFight = false;
    private hasExploded = false;
    private nextOpponentIndex = 0;
    private lastScreenW = 800;
    private lastScreenH = 450;

    // Roulette Selection Screen Properties
    private wheelAngle = -Math.PI / 2;
    private targetWheelAngle = -Math.PI / 2;
    private holdTimer = 0;
    private isSpinningRandomly = false;
    private spinTimer = 0;
    private spinSpeed = 0;
    private lastSliceTick = 0;
    private cheatSequenceIndex = 0;
    private isCheatActive = false;
    private bossAIReactionTimer = 0;
    private bossRageActive = false; // True when boss drops to ≤50% HP in the deciding round

    constructor() {
        this.p1 = this.createFighter(0, 0);
        this.p2 = this.createFighter(1, 1);
        this.reset();
    }

    private createFighter(team: number, charId: number): Fighter {
        const char = this.characters[charId];
        return {
            x: team === 0 ? 200 : 600,
            y: this.groundY,
            vx: 0,
            vy: 0,
            hp: char.hp,
            maxHp: char.hp,
            stun: 0,
            maxStun: 50,
            energy: 0,
            maxEnergy: 100,
            comboCount: 0,
            comboTimer: 0,
            state: 'idle',
            stateTimer: 0,
            team,
            comboStep: 0,
            comboWindowTimer: 0,
            direction: team === 0 ? 1 : -1,
            charId,
            attackCooldownTimer: 0,
            defenseCooldownTimer: 0
        };
    }

    private getRGBColor(hex: string): string {
        if (hex === '#00ffff') return '0, 255, 255';
        if (hex === '#ff4400') return '255, 68, 0';
        if (hex === '#aa00ff') return '170, 0, 255';
        if (hex === '#00ff88') return '0, 255, 136';
        if (hex === '#7a00ff') return '122, 0, 255';
        return '255, 255, 255';
    }

    public get score(): number {
        if (this.isCheatActive) {
            // Exclusively for cheat: 0 points if player dies (loses match), 1 point if defeats boss
            return this.playerWins >= 2 ? 1 : 0;
        }

        // 1. Victory Points: 10 per round won (max 20)
        let points = this.playerWins * 10;

        // 2. Perfect Round Bonus: 15 per perfect round (full HP win)
        points += this.perfectRounds * 15;

        // 3. Special Finisher Bonus: 10 if completed the final blow of Special Autocombo
        if (this.specialFinishedMatch) {
            points += 10;
        }

        // 4. Max Combo Bonus: +1 point per hit of their highest combo
        points += this.playerMaxCombo;

        // 5. Speed Bonus: +1 point per second saved under 45 seconds total match time
        const speedBonus = Math.max(0, Math.floor(45 - this.totalMatchTime));
        points += speedBonus;

        return Math.max(0, points);
    }

    public reset() {
        this.round = 1;
        this.playerWins = 0;
        this.enemyWins = 0;
        this.playerMaxCombo = 0;
        this.perfectRounds = 0;
        this.specialFinishedMatch = false;
        this.totalMatchTime = 0;
        this.phase = 'char_select'; // Reset always returns back to character selection!
        this.selectedCharIndex = 0;
        this.wheelAngle = -Math.PI / 2;
        this.targetWheelAngle = -Math.PI / 2;
        this.holdTimer = 0;
        this.isSpinningRandomly = false;
        this.spinTimer = 0;
        this.spinSpeed = 0;
        this.lastSliceTick = 0;
        this.arcadeOpponentsDefeated = [false, false, false, false, false];
        this.isBossFight = false;
        this.hasExploded = false;
        this.cheatSequenceIndex = 0;
        this.isCheatActive = false;
    }

    private startRound() {
        this.p1.hp = this.p1.maxHp;
        this.p1.stun = 0;
        this.p1.x = 200;
        this.p1.state = 'idle';
        this.p1.comboCount = 0;
        this.p1.comboTimer = 0;
        this.p1.isBisected = false;
        this.p1.bisectTimer = 0;
        
        this.p2.hp = this.p2.maxHp;
        this.p2.stun = 0;
        this.p2.x = 600;
        this.p2.state = 'idle';
        this.p2.comboCount = 0;
        this.p2.comboTimer = 0;
        this.p2.isBisected = false;
        this.p2.bisectTimer = 0;
        this.p1.attackCooldownTimer = 0;
        this.p1.defenseCooldownTimer = 0;
        this.p1.comboStep = 0;
        this.p1.comboWindowTimer = 0;
        this.p2.attackCooldownTimer = 0;
        this.p2.defenseCooldownTimer = 0;
        this.p2.comboStep = 0;
        this.p2.comboWindowTimer = 0;
        
        this.hazards = [];
        this.phase = 'round_intro';
        this.stateTimer = 3;
        this.dragonFire = 2; // Dragon spits fire at start
        this.dragonDirection = Math.random() < 0.5 ? 1 : -1;
        this.bossRageActive = false; // Reset rage each round
        
        this.autocomboAttacker = null;
        this.autocomboDefender = null;
        this.screenFlash = 0;
        this.sparks = [];
        this.specialPreFreezeTimer = 0;
        this.specialPreFreezeAttacker = null;
        this.specialPreFreezeDefender = null;

        SoundManager.getInstance().play('arcade_hit');
    }

    private activateBossCheat() {
        SoundManager.getInstance().play('arcade_shoot');
        
        // Pick a random playable character (0–4); do NOT use selectedCharIndex
        // because the cheat key sequence moves the selection wheel as a side effect,
        // always landing on BEHEMOTH (index 4).
        const randomCharIndex = Math.floor(Math.random() * 5);
        this.selectedCharIndex = randomCharIndex;
        this.p1 = this.createFighter(0, randomCharIndex);
        
        // All opponents defeated so game ends when boss is defeated
        this.arcadeOpponentsDefeated = [true, true, true, true, true];
        this.isBossFight = true;
        this.isCheatActive = true;
        this.hasExploded = false;
        
        // Transition straight to boss intro roulette explosion!
        this.phase = 'boss_intro';
        this.stateTimer = 3.5;
    }

    public update(dt: number) {
        const input = InputManager.getInstance();

        // Run screen flash countdown (done here so it runs in all phases)
        if (this.screenFlash > 0) {
            this.screenFlash -= dt;
        }

        // Handle character selection inputs exclusively
        if (this.phase === 'char_select') {
            const leftPressed = input.wasPressed('ArrowLeft') || input.wasPressed('KeyA');
            const rightPressed = input.wasPressed('ArrowRight') || input.wasPressed('KeyD');
            const leftHeld = input.isDown('ArrowLeft') || input.isDown('KeyA');
            const rightHeld = input.isDown('ArrowRight') || input.isDown('KeyD');

            // --- CHEAT CODE DETECTION ---
            let pressedDir: string | null = null;
            if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) pressedDir = 'up';
            else if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) pressedDir = 'down';
            else if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) pressedDir = 'left';
            else if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) pressedDir = 'right';

            if (pressedDir !== null) {
                const targetSeq = ['up', 'up', 'up', 'down', 'left', 'down', 'right', 'left', 'right'];
                if (pressedDir === targetSeq[this.cheatSequenceIndex]) {
                    this.cheatSequenceIndex++;
                    if (this.cheatSequenceIndex === targetSeq.length) {
                        this.activateBossCheat();
                    }
                } else {
                    this.cheatSequenceIndex = pressedDir === targetSeq[0] ? 1 : 0;
                }
            }

            if (this.isSpinningRandomly) {
                // Run physical lucky spin rotation
                this.spinTimer -= dt;
                this.wheelAngle += this.spinSpeed * dt;
                this.spinSpeed *= Math.exp(-1.5 * dt); // decelerate

                // Tactile slot tick sound
                const sliceSize = (2 * Math.PI) / 5;
                const currentSlice = Math.round((-Math.PI / 2 - this.wheelAngle) / sliceSize);
                if (currentSlice !== this.lastSliceTick) {
                    this.lastSliceTick = currentSlice;
                    SoundManager.getInstance().play('arcade_bounce');
                }

                if (this.spinTimer <= 0) {
                    // Choose random character and settle
                    const randIndex = Math.floor(Math.random() * 5);
                    this.selectedCharIndex = randIndex;
                    this.targetWheelAngle = -Math.PI / 2 - this.selectedCharIndex * sliceSize;
                    this.isSpinningRandomly = false;
                    this.holdTimer = 0;
                }
            } else {
                // Standard manual stepping
                let dir = 0;
                if (leftPressed) dir = -1;
                if (rightPressed) dir = 1;

                if (dir !== 0) {
                    this.selectedCharIndex = (this.selectedCharIndex + dir + 5) % 5;
                    this.targetWheelAngle = -Math.PI / 2 - this.selectedCharIndex * ((2 * Math.PI) / 5);
                    SoundManager.getInstance().play('arcade_bounce');
                    this.holdTimer = 0;
                } else if (leftHeld || rightHeld) {
                    // Track hold duration for random spin trigger
                    this.holdTimer += dt;
                    if (this.holdTimer > 0.6) {
                        this.isSpinningRandomly = true;
                        this.spinTimer = 1.5; // spin duration
                        this.spinSpeed = (leftHeld ? -1 : 1) * (25 + Math.random() * 15); // spin direction matches key!
                        SoundManager.getInstance().play('arcade_shoot');
                    }
                } else {
                    this.holdTimer = 0;
                }

                // Smooth wheel angle lerping to selected target
                let diff = this.targetWheelAngle - this.wheelAngle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
                this.wheelAngle += diff * dt * 10;

                // Select and start fight
                if (input.wasPressed('Space') || input.wasPressed('Enter')) {
                    SoundManager.getInstance().play('arcade_shoot');
                    
                    // Select player fighter
                    this.p1 = this.createFighter(0, this.selectedCharIndex);
                    
                    // Reset defeated list and mark player character as "defeated" so we don't fight ourselves
                    this.arcadeOpponentsDefeated = [false, false, false, false, false];
                    this.arcadeOpponentsDefeated[this.selectedCharIndex] = true;
                    this.isBossFight = false;
                    this.hasExploded = false;

                    // Choose first AI opponent randomly from remaining undefeated (any character other than own selected)
                    const undefeated = [];
                    for (let i = 0; i < 5; i++) {
                        if (!this.arcadeOpponentsDefeated[i]) {
                            undefeated.push(i);
                        }
                    }
                    const aiChar = undefeated[Math.floor(Math.random() * undefeated.length)];
                    this.p2 = this.createFighter(1, aiChar);
                    
                    // Start fighting match
                    this.round = 1;
                    this.playerWins = 0;
                    this.enemyWins = 0;
                    this.playerMaxCombo = 0;
                    this.perfectRounds = 0;
                    this.specialFinishedMatch = false;
                    this.totalMatchTime = 0;
                    this.startRound();
                    this.phase = 'round_intro';
                }
            }

            // Background dragon breathes and oscillates during select screen!
            this.dragonFrame += dt * 3;
            if (this.dragonFire > 0) this.dragonFire -= dt;
            return;
        }

        if (this.phase === 'opponent_select') {
            this.stateTimer -= dt;
            this.spinTimer -= dt;

            const sliceSize = (2 * Math.PI) / 5;

            if (this.stateTimer > 2.2) {
                // Spin fast and decelerate
                this.wheelAngle += this.spinSpeed * dt;
                this.spinSpeed *= Math.exp(-0.8 * dt); // decelerate slightly slower

                // Track selected index to the one currently at the top of the wheel
                const currentSlice = Math.round((-Math.PI / 2 - this.wheelAngle) / sliceSize);
                this.selectedCharIndex = ((currentSlice % 5) + 5) % 5;
            } else if (this.stateTimer > 1.0) {
                // Settle smoothly on the target wheel angle
                let diff = this.targetWheelAngle - this.wheelAngle;
                diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
                this.wheelAngle += diff * dt * 8; // Lerp to target angle

                // Force selected index to the next opponent index as it starts settling
                this.selectedCharIndex = this.nextOpponentIndex;
            } else {
                // Completely stopped with the next opponent at the top of the roulette
                this.wheelAngle = this.targetWheelAngle;
                this.selectedCharIndex = this.nextOpponentIndex;
            }

            // Tactile slot tick sound
            const currentSlice = Math.round((-Math.PI / 2 - this.wheelAngle) / sliceSize);
            if (currentSlice !== this.lastSliceTick) {
                this.lastSliceTick = currentSlice;
                SoundManager.getInstance().play('arcade_bounce');
            }

            if (this.stateTimer <= 0) {
                // Settle on selected opponent
                this.selectedCharIndex = this.nextOpponentIndex;
                this.wheelAngle = this.targetWheelAngle;
                
                // Select opponent
                this.p2 = this.createFighter(1, this.nextOpponentIndex);
                this.round = 1;
                this.playerWins = 0;
                this.enemyWins = 0;
                this.startRound();
                this.phase = 'round_intro';
                this.stateTimer = 3.0; // 3 seconds round intro
            }

            // Background dragon breathes and oscillates!
            this.dragonFrame += dt * 3;
            if (this.dragonFire > 0) this.dragonFire -= dt;
            
            // Clean/update sparks
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                const sp = this.sparks[i];
                sp.timer -= dt;
                if (sp.timer <= 0) {
                    this.sparks.splice(i, 1);
                } else if (sp.vx !== undefined && sp.vy !== undefined) {
                    sp.x += sp.vx * dt;
                    sp.y += sp.vy * dt;
                    sp.vy += 650 * dt;
                }
            }
            return;
        }

        if (this.phase === 'boss_intro') {
            this.stateTimer -= dt;
            
            if (!this.hasExploded) {
                // Spin crazy fast!
                this.wheelAngle += 45 * dt;
                
                // Sound tick
                if (Math.random() < 0.25) {
                    SoundManager.getInstance().play('arcade_bounce');
                }

                // Trigger explosion at t = 1.8 remaining
                if (this.stateTimer <= 1.8) {
                    this.hasExploded = true;
                    SoundManager.getInstance().play('arcade_explosion');
                    this.screenFlash = 1.0;
                    
                    const wheelX = this.lastScreenW * 0.30;
                    const wheelY = this.lastScreenH * 0.54;

                    // 150 bright glowing sparks exploding from the roulette!
                    for (let k = 0; k < 150; k++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 300 + Math.random() * 600;
                        this.sparks.push({
                            x: wheelX + (Math.random() - 0.5) * 50,
                            y: wheelY + (Math.random() - 0.5) * 50,
                            color: k % 2 === 0 ? '#ff0055' : '#ffd700', // Crimson and Gold!
                            size: 5 + Math.random() * 8,
                            timer: 0.8 + Math.random() * 1.6,
                            maxTimer: 2.4,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed
                        });
                    }
                }
            }

            if (this.stateTimer <= 0) {
                // Set Boss Fight active!
                this.isBossFight = true;
                this.p2 = this.createFighter(1, 5); // 5 is VALKOR (BOSS)
                this.round = 1;
                this.playerWins = 0;
                this.enemyWins = 0;
                this.startRound();
                this.phase = 'round_intro';
                this.stateTimer = 3.0; // 3 seconds round intro
            }

            // Background dragon breathes and oscillates!
            this.dragonFrame += dt * 3;
            if (this.dragonFire > 0) this.dragonFire -= dt;

            // Clean/update sparks
            for (let i = this.sparks.length - 1; i >= 0; i--) {
                const sp = this.sparks[i];
                sp.timer -= dt;
                if (sp.timer <= 0) {
                    this.sparks.splice(i, 1);
                } else if (sp.vx !== undefined && sp.vy !== undefined) {
                    sp.x += sp.vx * dt;
                    sp.y += sp.vy * dt;
                    sp.vy += 650 * dt;
                }
            }
            return;
        }

        // Run screen flash countdown
        if (this.screenFlash > 0) {
            this.screenFlash -= dt;
        }

        // Update sparks with physics
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const sp = this.sparks[i];
            sp.timer -= dt;
            if (sp.timer <= 0) {
                this.sparks.splice(i, 1);
            } else if (sp.vx !== undefined && sp.vy !== undefined) {
                sp.x += sp.vx * dt;
                sp.y += sp.vy * dt;
                sp.vy += 650 * dt; // Gravity arc!
            }
        }

        // Pre-special dramatic freeze countdown
        if (this.specialPreFreezeTimer > 0) {
            this.specialPreFreezeTimer -= dt;
            if (this.specialPreFreezeTimer <= 0 && this.specialPreFreezeAttacker && this.specialPreFreezeDefender) {
                const attacker = this.specialPreFreezeAttacker;
                const defender = this.specialPreFreezeDefender;
                
                // Snap next to defender
                attacker.x = defender.x - attacker.direction * 65;
                attacker.vx = 0;

                // Start autocombo
                this.autocomboAttacker = attacker;
                this.autocomboDefender = defender;
                this.autocomboStep = 0;
                this.autocomboTimer = 0.0;

                // High-energy screen flash
                this.screenFlash = 0.5;
                this.screenFlashColor = this.getRGBColor(this.characters[attacker.charId].color);

                this.specialPreFreezeAttacker = null;
                this.specialPreFreezeDefender = null;
            }
            // Background dragon still breathes and oscillates during dramatic freeze!
            this.dragonFrame += dt * 3;
            if (this.dragonFire > 0) this.dragonFire -= dt;
            return; // Lock player/AI physics during pre-special freeze
        }

        // If a fighter is bisected, increment timer and spray red blood fountains!
        if (this.p1.isBisected) {
            this.p1.bisectTimer = (this.p1.bisectTimer || 0) + dt;
            if (this.p1.bisectTimer < 2.5) {
                const spawnCount = Math.random() < 0.45 ? 2 : 1;
                for (let k = 0; k < spawnCount; k++) {
                    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9; // Upwards fan
                    const speed = 120 + Math.random() * 220;
                    this.sparks.push({
                        x: this.p1.x + (Math.random() - 0.5) * 12,
                        y: this.p1.y - 40,
                        color: '#ff0033', // Deep neon red blood
                        size: 3 + Math.random() * 5,
                        timer: 0.5 + Math.random() * 0.4,
                        maxTimer: 0.9,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed
                    });
                }
            }
        }
        if (this.p2.isBisected) {
            this.p2.bisectTimer = (this.p2.bisectTimer || 0) + dt;
            if (this.p2.bisectTimer < 2.5) {
                const spawnCount = Math.random() < 0.45 ? 2 : 1;
                for (let k = 0; k < spawnCount; k++) {
                    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9; // Upwards fan
                    const speed = 120 + Math.random() * 220;
                    this.sparks.push({
                        x: this.p2.x + (Math.random() - 0.5) * 12,
                        y: this.p2.y - 40,
                        color: '#ff0033', // Deep neon red blood
                        size: 3 + Math.random() * 5,
                        timer: 0.5 + Math.random() * 0.4,
                        maxTimer: 0.9,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed
                    });
                }
            }
        }

        // If autocombo special is active, run it exclusively
        if (this.autocomboAttacker && this.autocomboDefender) {
            this.updateAutocombo(dt);
            // Dragon and body still animate
            this.dragonFrame += dt * 3;
            if (this.dragonFire > 0) this.dragonFire -= dt;
            
            this.updateHazards(dt);
            this.checkCollisions();

            // Check for mid-autocombo KO!
            if (this.p2.hp <= 0 && this.phase === 'fighting') {
                this.playerWins++;
                if (this.p1.hp >= this.p1.maxHp) {
                    this.perfectRounds++;
                }
                this.specialFinishedMatch = true;

                // FATALITY check! If this win makes player win the match
                if (this.playerWins >= 2) {
                    this.p2.isBisected = true;
                    this.p2.bisectTimer = 0;
                    // Massive initial fountain!
                    for (let k = 0; k < 25; k++) {
                        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
                        const speed = 180 + Math.random() * 260;
                        this.sparks.push({
                            x: this.p2.x + (Math.random() - 0.5) * 20,
                            y: this.p2.y - 40,
                            color: '#ff0033',
                            size: 4 + Math.random() * 7,
                            timer: 0.7 + Math.random() * 0.5,
                            maxTimer: 1.2,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed
                        });
                    }
                }
                
                this.autocomboAttacker = null;
                this.autocomboDefender = null;
                
                this.phase = 'round_end';
                this.stateTimer = 3.5; // Make round end screen slightly longer for fatality celebration!
                SoundManager.getInstance().play('win_big');
            }
            return;
        }

        this.dragonFrame += dt * 3;
        if (this.dragonFire > 0) this.dragonFire -= dt;

        // Decaying combo timers
        if (this.p1.comboTimer > 0) {
            this.p1.comboTimer -= dt;
            if (this.p1.comboTimer <= 0) this.p1.comboCount = 0;
        }
        if (this.p2.comboTimer > 0) {
            this.p2.comboTimer -= dt;
            if (this.p2.comboTimer <= 0) this.p2.comboCount = 0;
        }

        if (this.phase === 'game_over') return;

        // Track total match time during fighting phase
        if (this.phase === 'fighting') {
            this.totalMatchTime += dt;
        }

        if (this.phase === 'round_intro') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.phase = 'fighting';
            }
            return;
        }

        if (this.phase === 'round_end') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                if (this.playerWins >= 2 || this.enemyWins >= 2) {
                    if (this.playerWins >= 2) {
                        if (this.isBossFight) {
                            // Won the entire Arcade Mode!
                            this.phase = 'game_over';
                            this.gameOverPhrase = 'PARABÉNS! VOCÊ DESTRUIU VALKOR E SE TORNOU O CAMPEÃO SUPREMO DE VALORIUM!';
                        } else {
                            // Defeated standard opponent
                            this.arcadeOpponentsDefeated[this.p2.charId] = true;

                            // Check undefeated remaining pool
                            const undefeated = [];
                            for (let i = 0; i < 5; i++) {
                                if (!this.arcadeOpponentsDefeated[i]) {
                                    undefeated.push(i);
                                }
                            }

                            if (undefeated.length === 0) {
                                // Face the Boss!
                                this.phase = 'boss_intro';
                                this.stateTimer = 3.5;
                                this.hasExploded = false;
                                SoundManager.getInstance().play('arcade_shoot');
                            } else {
                                // Next Opponent Selector Roulette
                                this.phase = 'opponent_select';
                                this.stateTimer = 5.0;
                                this.spinTimer = 5.0;
                                this.spinSpeed = 45 + Math.random() * 15;
                                this.isSpinningRandomly = true;

                                this.nextOpponentIndex = undefeated[Math.floor(Math.random() * undefeated.length)];
                                const sliceSize = (2 * Math.PI) / 5;
                                this.targetWheelAngle = -Math.PI / 2 - this.nextOpponentIndex * sliceSize;
                                SoundManager.getInstance().play('arcade_shoot');
                            }
                        }
                    } else {
                        // Player lost the match
                        this.phase = 'game_over';
                        this.gameOverPhrase = getMotivationalPhrase();
                    }
                } else {
                    this.round++;
                    this.startRound();
                }
            }
            this.updateFighterPhysics(this.p1, dt);
            this.updateFighterPhysics(this.p2, dt);
            return;
        }

        this.updatePlayer(dt);
        this.updateAI(dt);
        this.updateFighterPhysics(this.p1, dt);
        this.updateFighterPhysics(this.p2, dt);
        this.updateHazards(dt);
        this.checkCollisions();

        // ── BOSS RAGE PHASE ──────────────────────────────────────────────────
        // Only triggers in the true tiebreaker round (both at 1 win = round 3)
        if (this.isBossFight && !this.bossRageActive) {
            const isTiebreakerRound = this.playerWins === 1 && this.enemyWins === 1;
            if (isTiebreakerRound && this.p2.hp <= this.p2.maxHp * 0.50) {
                this.bossRageActive = true;

                // Dramatic purple flash signal
                this.screenFlash = 0.8;
                this.screenFlashColor = '122, 0, 255';

                // Burst of purple sparks from VALKOR
                for (let k = 0; k < 40; k++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 150 + Math.random() * 350;
                    this.sparks.push({
                        x: this.p2.x + (Math.random() - 0.5) * 20,
                        y: this.p2.y - 50 + (Math.random() - 0.5) * 30,
                        color: k % 2 === 0 ? '#7a00ff' : '#dd00ff',
                        size: 6 + Math.random() * 10,
                        timer: 0.6 + Math.random() * 0.8,
                        maxTimer: 1.4,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed
                    });
                }

                SoundManager.getInstance().play('arcade_shoot');
            }
        }
        
        // Win/Loss check
        if (this.p1.hp <= 0 || this.p2.hp <= 0) {
            if (this.p1.hp <= 0) {
                this.enemyWins++;
                // Enemy wins round: dragon breathes fire towards Player (left)
                this.dragonFire = 2.0;
                this.dragonDirection = -1;
            } else {
                this.playerWins++;
                // Player wins round: dragon breathes fire towards Enemy (right)
                this.dragonFire = 2.0;
                this.dragonDirection = 1;

                // Track Perfect Round (full HP)
                if (this.p1.hp >= this.p1.maxHp) {
                    this.perfectRounds++;
                }

                // Track Special Finish if finished during the autocombo sequence
                if (this.autocomboAttacker && this.autocomboAttacker.team === 0) {
                    this.specialFinishedMatch = true;

                    // FATALITY check! If this win makes player win the match
                    if (this.playerWins >= 2) {
                        this.p2.isBisected = true;
                        this.p2.bisectTimer = 0;
                        // Massive initial fountain!
                        for (let k = 0; k < 25; k++) {
                            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
                            const speed = 180 + Math.random() * 260;
                            this.sparks.push({
                                x: this.p2.x + (Math.random() - 0.5) * 20,
                                y: this.p2.y - 40,
                                color: '#ff0033',
                                size: 4 + Math.random() * 7,
                                timer: 0.7 + Math.random() * 0.5,
                                maxTimer: 1.2,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed
                            });
                        }
                    }
                }
            }
            this.phase = 'round_end';
            this.stateTimer = 3.5; // Longer round end timer for fatality
            SoundManager.getInstance().play(this.p1.hp <= 0 ? 'lose' : 'win_big');
        }
    }

    private updatePlayer(dt: number) {
        const input = InputManager.getInstance();
        const char = this.characters[this.p1.charId];

        // Decrement cooldowns + combo window timer
        if (this.p1.attackCooldownTimer && this.p1.attackCooldownTimer > 0) {
            this.p1.attackCooldownTimer -= dt;
        }
        if (this.p1.defenseCooldownTimer && this.p1.defenseCooldownTimer > 0) {
            this.p1.defenseCooldownTimer -= dt;
        }
        // Combo window countdown — if it expires between hits, the sequence resets
        if (this.p1.comboWindowTimer > 0) {
            this.p1.comboWindowTimer -= dt;
            if (this.p1.comboWindowTimer <= 0) {
                this.p1.comboStep = 0;
            }
        }

        if (this.p1.state === 'hit' || this.p1.state === 'stunned') {
            this.p1.stateTimer -= dt;
            if (this.p1.stateTimer <= 0) this.p1.state = 'idle';
            return;
        }

        if (this.p1.state === 'attack') {
            this.p1.stateTimer -= dt;
            if (this.p1.stateTimer <= 0) {
                this.p1.state = 'idle';
                if (this.p1.comboStep >= 3) {
                    // 3rd hit done — full recovery cooldown, combo resets
                    this.p1.attackCooldownTimer = char.comboEndCooldown;
                    this.p1.comboStep = 0;
                    this.p1.comboWindowTimer = 0;
                } else {
                    // Hits 1 or 2 — short cooldown + open the chain window
                    this.p1.attackCooldownTimer = char.attackCooldown;
                    this.p1.comboWindowTimer = char.comboWindow;
                }
            }
            return;
        }

        // Guard / Defend mechanism (holding Q)
        if (input.isDown('KeyQ') || input.isDown('Gamepad_X')) {
            if (!this.p1.defenseCooldownTimer || this.p1.defenseCooldownTimer <= 0) {
                this.p1.state = 'defending';
                this.p1.vx = 0;
                
                // Allow triggering Special Attack from guard stance if ready!
                if ((input.wasPressed('ShiftLeft') || input.wasPressed('Gamepad_Y')) && this.p1.energy >= 100) {
                    this.performSpecialAttack(this.p1, this.p2);
                }
                return;
            }
        } else if (this.p1.state === 'defending') {
            // Released Q, return to idle
            this.p1.state = 'idle';
            this.p1.defenseCooldownTimer = char.defenseCooldown;
        }

        // Special Attack trigger
        if (input.wasPressed('ShiftLeft') || input.wasPressed('Gamepad_Y')) {
            if (this.p1.energy >= 100) {
                this.performSpecialAttack(this.p1, this.p2);
                return;
            }
        }

        let move = 0;
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) move = -1;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) move = 1;

        if (move !== 0) {
            this.p1.vx = move * char.speed;
            this.p1.state = 'moving';
            this.p1.direction = move;
        } else {
            this.p1.vx *= 0.8;
            this.p1.state = 'idle';
        }

        if (input.wasPressed('Space')) {
            if (!this.p1.attackCooldownTimer || this.p1.attackCooldownTimer <= 0) {
                this.performAttack(this.p1, this.p2);
            }
        }
    }

    private updateAI(dt: number) {
        const char = this.characters[this.p2.charId];

        // Decrement cooldowns + combo window timer
        if (this.p2.attackCooldownTimer && this.p2.attackCooldownTimer > 0) {
            this.p2.attackCooldownTimer -= dt;
        }
        if (this.p2.defenseCooldownTimer && this.p2.defenseCooldownTimer > 0) {
            this.p2.defenseCooldownTimer -= dt;
        }
        if (this.p2.comboWindowTimer > 0) {
            this.p2.comboWindowTimer -= dt;
            if (this.p2.comboWindowTimer <= 0) {
                this.p2.comboStep = 0;
            }
        }

        if (this.p2.state === 'hit' || this.p2.state === 'stunned' || this.p2.state === 'attack') {
            this.p2.stateTimer -= dt;
            if (this.p2.stateTimer <= 0) {
                const wasAttacking = this.p2.state === 'attack';
                this.p2.state = 'idle';
                if (wasAttacking) {
                    if (this.p2.comboStep >= 3) {
                        // 3rd hit done — recovery cooldown (BOSS WEAKNESS: player punishes here!)
                        this.p2.attackCooldownTimer = char.comboEndCooldown;
                        this.p2.comboStep = 0;
                        this.p2.comboWindowTimer = 0;
                        if (this.p2.charId === 5) this.bossAIReactionTimer = char.comboEndCooldown;
                    } else {
                        // Hits 1 or 2 — short cooldown + open chain window
                        this.p2.attackCooldownTimer = char.attackCooldown;
                        this.p2.comboWindowTimer = char.comboWindow;
                    }
                }
            }
            return;
        }

        // Simple AI
        const dist = Math.abs(this.p1.x - this.p2.x);

        // Boss AI: decisions only fire on a reaction timer, not every frame
        const isBoss = this.p2.charId === 5;
        const defenseChance = isBoss ? 0.65 : 0.45;
        const specialChance = isBoss ? 0.65 : 0.50;
        const speedFactor  = isBoss ? 0.85 : 0.7;
        const attackChance = isBoss ? 0.72 : 0.50;

        if (isBoss) {
            this.bossAIReactionTimer -= dt;
        }
        const canDecide = !isBoss || this.bossAIReactionTimer <= 0;

        // AI Guard logic: if player is currently attacking and close, AI has a tactical chance to guard
        if (canDecide && this.p1.state === 'attack' && dist < 120 && Math.random() < defenseChance && (!this.p2.defenseCooldownTimer || this.p2.defenseCooldownTimer <= 0)) {
            this.p2.state = 'defending';
            this.p2.vx = 0;
            if (isBoss) this.bossAIReactionTimer = 0.25 + Math.random() * 0.20;
            return;
        } else if (this.p2.state === 'defending' && (this.p1.state !== 'attack' || Math.random() < 0.1)) {
            this.p2.state = 'idle';
            this.p2.defenseCooldownTimer = char.defenseCooldown;
        }

        if (this.p2.state === 'defending') return;

        if (canDecide && this.p2.energy >= 100 && dist < 160 && Math.random() < specialChance) {
            this.performSpecialAttack(this.p2, this.p1);
            if (isBoss) this.bossAIReactionTimer = 0.28 + Math.random() * 0.22;
        } else if (dist > 100) {
            this.p2.vx = (this.p1.x > this.p2.x ? 1 : -1) * char.speed * speedFactor;
            this.p2.direction = this.p1.x > this.p2.x ? 1 : -1;
        } else {
            this.p2.vx = 0;
            const aiCanAttack = !this.p2.attackCooldownTimer || this.p2.attackCooldownTimer <= 0;
            // Mid-combo: continue chain without waiting for the reaction timer
            const aiMidCombo = this.p2.comboStep > 0 && this.p2.comboStep < 3 && this.p2.comboWindowTimer > 0;
            if (aiCanAttack && (aiMidCombo || (canDecide && Math.random() < attackChance))) {
                this.performAttack(this.p2, this.p1);
                // Reaction timer only resets on the START of a new combo, not on chained hits
                if (isBoss && !aiMidCombo) this.bossAIReactionTimer = 0.25 + Math.random() * 0.22;
            }
        }
    }

    private performAttack(attacker: Fighter, defender: Fighter) {
        const input = InputManager.getInstance();
        // Advance combo step (1 = 1st hit, 2 = 2nd, 3 = 3rd → triggers recovery on animation end)
        attacker.comboStep = Math.min(3, attacker.comboStep + 1);
        attacker.comboWindowTimer = 0; // Window is inactive during the animation itself
        attacker.state = 'attack';
        attacker.stateTimer = this.characters[attacker.charId].attackDuration;
        
        // JADE reach is 150, others are 120
        const attackReach = attacker.charId === 3 ? 150 : 120;
        const dist = Math.abs(attacker.x - defender.x);
        
        if (dist < attackReach) {
            let damage = this.characters[attacker.charId].damage;
            let push = 200;

            // VALKOR RAGE: damage boost when rage is active
            if (attacker.charId === 5 && this.bossRageActive) {
                damage *= 1.65; // ~18 damage — above normal chars but beatable
            }

            // BEHEMOTH has passive 10% damage reduction
            if (defender.charId === 4) {
                damage *= 0.90;
            }
            
            // Combo branches
            const isDown = attacker.team === 0 ? (input.isDown('ArrowDown') || input.isDown('KeyS')) : false;
            const isBack = attacker.team === 0 ? (attacker.direction === 1 ? (input.isDown('ArrowLeft') || input.isDown('KeyA')) : (input.isDown('ArrowRight') || input.isDown('KeyD'))) : false;
 
            if (isDown) { // Combo 2: Down (Heavy)
                damage *= 1.5;
                push = 50;
            } else if (isBack) { // Combo 3: Back (Counter/Evasive)
                damage *= 0.8;
                attacker.vx = -attacker.direction * 400;
                push = 100;
            } else { // Combo 1: Neutral (Normal)
                push = 400;
            }

            // Check if defender is defending (guarding from both sides)
            const isBlocking = defender.state === 'defending';
            if (isBlocking) {
                // SHADOW takes 0 chip damage when blocking
                if (defender.charId === 2) {
                    damage = 0;
                } else {
                    damage *= 0.20; // 80% blocked, 20% leaks as chip damage!
                }
                push *= 0.35;   // Greatly reduced knockback
                
                // Spawn glowing cyan shield impact sparks
                for (let i = 0; i < 3; i++) {
                    this.sparks.push({
                        x: defender.x + (Math.random() - 0.5) * 10,
                        y: defender.y - 40 + (Math.random() - 0.5) * 20,
                        color: '#00aaff',
                        size: 10 + Math.random() * 10,
                        timer: 0.15,
                        maxTimer: 0.15
                    });
                }
                
                // Play standard metallic shield block sound
                SoundManager.getInstance().play('arcade_bounce');
            } else {
                defender.state = 'hit';
                defender.stateTimer = 0.3;
                SoundManager.getInstance().play('arcade_hit');
            }

            // VULCAN: Hits spawn lava fire hazards on the ground
            if (attacker.charId === 1 && !isBlocking && Math.random() < 0.35) {
                this.hazards.push({
                    x: defender.x + (Math.random() - 0.5) * 40,
                    y: this.groundY,
                    type: 'fire',
                    vx: 0,
                    vy: 0,
                    active: true,
                    timer: 0,
                    ownerTeam: attacker.team
                });
            }

            defender.hp = Math.max(0, defender.hp - damage);
            
            if (!isBlocking) {
                defender.stun += damage * 0.5;
            } else {
                defender.stun += damage * 0.1; // Negligible stun on block
            }
            
            // BEHEMOTH has super armor (takes 30% less pushback)
            if (defender.charId === 4) {
                push *= 0.70;
            }
            defender.vx = attacker.direction * push;

            // Increment combo
            attacker.comboCount++;
            attacker.comboTimer = 1.5;
            if (attacker.team === 0 && attacker.comboCount > this.playerMaxCombo) {
                this.playerMaxCombo = attacker.comboCount;
            }

            // Earn energy: diminishing returns per combo step.
            // First hit always gives full energy; chained hits yield progressively less.
            // This means 1 slow spaced hit ≈ a few combo hits in terms of special farming.
            //   comboStep 1 (fresh/solo): 100% gain
            //   comboStep 2 (chained):    38% gain
            //   comboStep 3 (finisher):   14% gain
            // FROST's trait: base gain is 24 (vs 18 for others)
            const baseGain   = attacker.charId === 0 ? 19 : 14;
            const comboScale = attacker.comboStep <= 1 ? 1.00
                             : attacker.comboStep === 2 ? 0.38
                             : 0.14;
            const energyGain = Math.max(1, Math.round(baseGain * comboScale));
            attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + energyGain);
            defender.energy = Math.min(defender.maxEnergy, defender.energy + 8);

            // Signal combo via dragon fire!
            if (attacker.comboCount >= 2) {
                this.dragonFire = Math.min(1.5, 0.4 + attacker.comboCount * 0.15);
                this.dragonDirection = attacker.team === 0 ? 1 : -1;
            }
            
            if (!isBlocking && defender.stun >= defender.maxStun) {
                defender.state = 'stunned';
                defender.stateTimer = 1.5;
                defender.stun = 0;
            }
        }
    }

    private performSpecialAttack(attacker: Fighter, defender: Fighter) {
        attacker.energy = 0;
        
        // Face each other on special
        attacker.direction = attacker.x < defender.x ? 1 : -1;
        
        // Set wind-up dramatic charge stance
        attacker.state = 'attack';
        attacker.stateTimer = 0.6;
        attacker.vx = 0;

        // Initialize dramatic pre-freeze
        this.specialPreFreezeTimer = 0.45; // 450ms dramatic build-up pause
        this.specialPreFreezeAttacker = attacker;
        this.specialPreFreezeDefender = defender;

        // Sound cue for the dramatic wind-up
        SoundManager.getInstance().play('arcade_shoot');
    }

    private updateAutocombo(dt: number) {
        if (!this.autocomboAttacker || !this.autocomboDefender) return;

        const attacker = this.autocomboAttacker;
        const defender = this.autocomboDefender;

        this.autocomboTimer -= dt;
        if (this.autocomboTimer <= 0) {
            const isBlocking = defender.state === 'defending';

            if (this.autocomboStep < this.maxAutocomboSteps - 1) {
                // Rapid strikes: alternate punch/kick and snap attacker close
                attacker.x = defender.x - attacker.direction * 60;
                attacker.direction = attacker.x < defender.x ? 1 : -1;

                // Set quick attack pose
                attacker.state = 'attack';
                attacker.stateTimer = 0.08;

                // Deal balanced damage: 3 normal, 0.6 chip damage if blocking
                let hitDamage = 3;
                // VALKOR RAGE: boost autocombo hit damage too
                if (attacker.charId === 5 && this.bossRageActive) {
                    hitDamage = 5;
                }
                if (isBlocking) {
                    // SHADOW takes 0 chip damage when blocking
                    if (defender.charId === 2) {
                        hitDamage = 0;
                    } else {
                        hitDamage = 0.6; // Chip damage (20%)
                    }
                    
                    // Spawn neon blue block sparks
                    this.sparks.push({
                        x: defender.x + (Math.random() - 0.5) * 15,
                        y: defender.y - 45 + (Math.random() - 0.5) * 20,
                        color: '#00aaff',
                        size: 12 + Math.random() * 10,
                        timer: 0.15,
                        maxTimer: 0.15
                    });
                    
                    SoundManager.getInstance().play('arcade_bounce');
                } else {
                    // BEHEMOTH has passive 10% damage reduction
                    if (defender.charId === 4) {
                        hitDamage *= 0.90;
                    }
                    defender.state = 'hit';
                    defender.stateTimer = 0.12;

                    // Spawn neon signature sparks
                    this.sparks.push({
                        x: defender.x + (Math.random() - 0.5) * 20,
                        y: defender.y - 45 + (Math.random() - 0.5) * 30,
                        color: this.characters[attacker.charId].color,
                        size: 15 + Math.random() * 15,
                        timer: 0.15,
                        maxTimer: 0.15
                    });
                    
                    SoundManager.getInstance().play('arcade_hit');
                }

                // VULCAN rapid strike fire hazard spawn
                if (attacker.charId === 1 && Math.random() < 0.5) {
                    this.hazards.push({
                        x: defender.x + (Math.random() - 0.5) * 50,
                        y: this.groundY,
                        type: 'fire',
                        vx: 0,
                        vy: 0,
                        active: true,
                        timer: 0,
                        ownerTeam: attacker.team
                    });
                }

                defender.hp = Math.max(0, defender.hp - hitDamage);

                // Increment combo
                attacker.comboCount++;
                attacker.comboTimer = 1.5;
                if (attacker.team === 0 && attacker.comboCount > this.playerMaxCombo) {
                    this.playerMaxCombo = attacker.comboCount;
                }

                // Synergized rapid small bursts of fire from dragon mouth!
                this.dragonFire = 0.12;
                this.dragonDirection = attacker.team === 0 ? 1 : -1;

                // Rapid autocombo intervals (100ms)
                this.autocomboTimer = 0.10;
                this.autocomboStep++;
            } else {
                // FINISHER BLOW! (7th strike)
                attacker.state = 'attack';
                attacker.stateTimer = 0.4;
                attacker.vx = attacker.direction * 500;

                // Finisher damage: 12 normal, 2.4 chip damage if blocking
                let finalDamage = 12;
                let finalPush = 800;

                if (isBlocking) {
                    // SHADOW takes 0 chip damage when blocking
                    if (defender.charId === 2) {
                        finalDamage = 0;
                    } else {
                        finalDamage = 2.4; // Chip damage
                    }
                    finalPush = 300;   // Reduced push

                    // Block impact sparks
                    for (let i = 0; i < 5; i++) {
                        this.sparks.push({
                            x: defender.x + (Math.random() - 0.5) * 30,
                            y: defender.y - 40 + (Math.random() - 0.5) * 30,
                            color: '#00aaff',
                            size: 15 + Math.random() * 15,
                            timer: 0.2,
                            maxTimer: 0.2
                        });
                    }
                    SoundManager.getInstance().play('arcade_bounce');
                } else {
                    // BEHEMOTH has passive 10% damage reduction
                    if (defender.charId === 4) {
                        finalDamage *= 0.90;
                    }
                    defender.state = 'hit';
                    defender.stateTimer = 0.5;

                    // Colossal splash of yellow finisher sparks
                    for (let i = 0; i < 8; i++) {
                        this.sparks.push({
                            x: defender.x + (Math.random() - 0.5) * 40,
                            y: defender.y - 40 + (Math.random() - 0.5) * 40,
                            color: '#ffff00',
                            size: 20 + Math.random() * 25,
                            timer: 0.3,
                            maxTimer: 0.3
                        });
                    }

                    // Stun effect
                    defender.stun += 15;
                    if (defender.stun >= defender.maxStun) {
                        defender.state = 'stunned';
                        defender.stateTimer = 1.5;
                        defender.stun = 0;
                    }
                    SoundManager.getInstance().play('arcade_explosion');
                }

                // VULCAN Finisher lava hazards spawn
                if (attacker.charId === 1) {
                    for (let k = 0; k < 2; k++) {
                        this.hazards.push({
                            x: defender.x + (Math.random() - 0.5) * 60,
                            y: this.groundY,
                            type: 'fire',
                            vx: 0,
                            vy: 0,
                            active: true,
                            timer: 0,
                            ownerTeam: attacker.team
                        });
                    }
                }

                defender.hp = Math.max(0, defender.hp - finalDamage);
                
                // BEHEMOTH super armor push reduction
                if (defender.charId === 4) {
                    finalPush *= 0.70;
                }
                defender.vx = attacker.direction * finalPush;

                // Increment combo
                attacker.comboCount++;
                attacker.comboTimer = 2.0;
                if (attacker.team === 0 && attacker.comboCount > this.playerMaxCombo) {
                    this.playerMaxCombo = attacker.comboCount;
                }

                // High energy screen-wide flash on impact
                this.screenFlash = 0.5;
                this.screenFlashColor = '255, 255, 255';

                // Dragon spits immense celebratory flamethrower torrent
                this.dragonFire = 1.8;
                this.dragonDirection = attacker.team === 0 ? 1 : -1;

                // End autocombo sequence
                this.autocomboAttacker = null;
                this.autocomboDefender = null;
            }
        }
    }

    private updateFighterPhysics(f: Fighter, dt: number) {
        f.x += f.vx * dt;
        f.vx *= 0.9;
        
        // Field boundaries
        if (f.x < 50) f.x = 50;
        if (f.x > this.fieldW - 50) f.x = this.fieldW - 50;
    }

    private updateHazards(dt: number) {
        if (this.phase === 'fighting' && Math.random() < 0.01) {
            const types: ('rock' | 'tree' | 'hurricane')[] = ['rock', 'tree', 'hurricane'];
            this.hazards.push({
                x: 100 + Math.random() * 600,
                y: -50,
                type: types[Math.floor(Math.random() * 3)],
                vx: 0,
                vy: 200 + Math.random() * 300,
                active: true,
                timer: 0
            });
        }

        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            
            // Clean up inactive hazards immediately (e.g. hit by player)
            if (!h.active) {
                this.hazards.splice(i, 1);
                continue;
            }
            
            if (h.type === 'fire') {
                h.timer += dt;
                if (h.timer > 1.2) { // Vulcan fire hazard lasts 1.2 seconds instead of 3.0 seconds!
                    this.hazards.splice(i, 1);
                }
                continue;
            }
            
            h.y += h.vy * dt;
            if (h.type === 'hurricane') h.x += Math.sin(this.dragonFrame * 2) * 5;
            
            if (h.y > this.groundY) h.active = false;
            if (h.y > this.fieldH + 100) this.hazards.splice(i, 1);
        }
    }

    private checkCollisions() {
        for (const h of this.hazards) {
            if (!h.active) continue;
            [this.p1, this.p2].forEach(f => {
                if (!h.active) return;
                
                // If it is fire and f is the owner, do not collide with them!
                if (h.type === 'fire' && h.ownerTeam === f.team) {
                    return;
                }
                
                // Grace period for fire hazards so they are clearly visible before breaking
                if (h.type === 'fire' && h.timer < 0.25) {
                    return;
                }
                
                const dx = Math.abs(h.x - f.x);
                const dy = Math.abs(h.y - f.y);
                const isFire = h.type === 'fire';
                const colLimit = isFire ? 25 : 40;
                
                if (dx < colLimit && dy < colLimit) {
                    const dmg = isFire ? 2 : 5; // Reduced Vulcan lava damage from 6 to 2!
                    f.hp = Math.max(0, f.hp - dmg);
                    f.state = 'hit';
                    f.stateTimer = 0.2;
                    h.active = false; // Break immediately!
                    SoundManager.getInstance().play('arcade_bounce');
                }
            });
        }
    }

    private drawCharSelect(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        // Handle boss intro explosion rendering!
        if (this.phase === 'boss_intro' && this.hasExploded) {
            // Apply frame shake
            ctx.save();
            const shakeX = (Math.random() - 0.5) * 8;
            const shakeY = (Math.random() - 0.5) * 8;
            ctx.translate(shakeX, shakeY);

            // Dark sci-fi backdrop
            ctx.fillStyle = '#050012';
            ctx.fillRect(0, 0, screenW, screenH);

            // Grid lines
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.08)';
            ctx.lineWidth = 1.5;
            const gridGap = Math.max(30, Math.floor(screenH * 0.06));
            for (let x = 0; x < screenW; x += gridGap) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, screenH);
                ctx.stroke();
            }
            for (let y = 0; y < screenH; y += gridGap) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(screenW, y);
                ctx.stroke();
            }

            // Warning Title
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 25;
            const warningSize = Math.max(26, Math.floor(screenH * 0.065));
            ctx.font = 'bold ' + warningSize + 'px monospace';
            ctx.fillText('ALERTA DE CHEFE / BOSS WARNING', screenW / 2, screenH * 0.44);

            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            const bossSize = Math.max(20, Math.floor(screenH * 0.045));
            ctx.font = 'bold ' + bossSize + 'px monospace';
            ctx.fillText('ENFRENTE VALKOR, O DESTRUIDOR!', screenW / 2, screenH * 0.56);

            // Draw exploding sparks!
            for (const sp of this.sparks) {
                const ratio = sp.timer / sp.maxTimer;
                ctx.save();
                ctx.translate(sp.x, sp.y);
                ctx.strokeStyle = sp.color;
                ctx.shadowColor = sp.color;
                ctx.shadowBlur = 15;
                ctx.lineWidth = 3;
                ctx.beginPath();
                const currentSize = sp.size * (1 - ratio);
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * currentSize, Math.sin(angle) * currentSize);
                }
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();
            return;
        }

        // Dark sci-fi backdrop
        ctx.fillStyle = '#050012';
        ctx.fillRect(0, 0, screenW, screenH);

        // Drawing retro grid lines for high premium arcade feel
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
        ctx.lineWidth = 1.5;
        const gridGap = Math.max(30, Math.floor(screenH * 0.06));
        for (let x = 0; x < screenW; x += gridGap) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, screenH);
            ctx.stroke();
        }
        for (let y = 0; y < screenH; y += gridGap) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(screenW, y);
            ctx.stroke();
        }

        // Title sizes based on screen scale
        const titleFontSize = Math.max(26, Math.floor(screenH * 0.045));
        const subtitleFontSize = Math.max(12, Math.floor(screenH * 0.02));

        // Title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = 20;
        ctx.font = 'bold ' + titleFontSize + 'px monospace';
        ctx.fillText("VALORIUM TITAN'S FURY", screenW / 2, screenH * 0.09);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.font = 'bold ' + subtitleFontSize + 'px monospace';
        if (this.phase === 'opponent_select') {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
            ctx.fillText("SELECIONANDO PRÓXIMO OPONENTE... / SELECTING NEXT OPPONENT...", screenW / 2, screenH * 0.14);
        } else if (this.phase === 'boss_intro') {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.fillText("PREPARE-SE PARA O CHEFE... / PREPARE FOR THE BOSS...", screenW / 2, screenH * 0.14);
        } else {
            ctx.fillText("SELECIONE SEU LUTADOR / SELECT YOUR FIGHTER", screenW / 2, screenH * 0.14);
        }
        ctx.restore();

        // --- ROULETTE WHEEL (Left Side) ---
        const wheelX = screenW * 0.30;
        const wheelY = screenH * 0.54;
        const radius = Math.min(screenW * 0.22, screenH * 0.28);
        const sliceSize = (2 * Math.PI) / 5;

        ctx.save();
        ctx.translate(wheelX, wheelY);
        ctx.rotate(this.wheelAngle);

        for (let i = 0; i < 5; i++) {
            const char = this.characters[i];
            const startAng = i * sliceSize - sliceSize / 2;
            const endAng = i * sliceSize + sliceSize / 2;
            const isSelected = i === this.selectedCharIndex;

            ctx.save();

            // Grayscale filter if defeated!
            const isDefeated = this.arcadeOpponentsDefeated[i];
            if (isDefeated) {
                ctx.filter = 'grayscale(100%) brightness(35%) opacity(40%)';
            }

            // CLIP: Respect the limits of the roulette pizza slice margins!
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAng, endAng);
            ctx.closePath();
            ctx.clip();

            // Draw slice background
            ctx.fillStyle = isSelected ? 'rgba(10, 5, 30, 0.94)' : 'rgba(5, 2, 15, 0.65)';
            ctx.strokeStyle = isSelected ? char.color : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = isSelected ? 4 : 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAng, endAng);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw the inner part of the slices, close to the center, filled with the character color!
            // "de modos que as bordas das fatias, próximas do centro, sejam preenchidas com a cor do personagem"
            ctx.fillStyle = char.color;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius * 0.43, startAng, endAng);
            ctx.closePath();
            ctx.fill();

            // Draw Character Figure inside the slice (Zoomed neck and shoulders portrait like a 3x4 photo!)
            const midAng = i * sliceSize;
            const figDist = radius * 0.22;
            const figX = Math.cos(midAng) * figDist;
            const figY = Math.sin(midAng) * figDist;

            ctx.save();
            ctx.translate(figX, figY);
            ctx.rotate(midAng + Math.PI / 2); // Stand upright relative to center
            const figScale = (radius / 105) * 1.15; // Beautifully zoomed!
            ctx.scale(figScale, figScale);

            ctx.fillStyle = char.color;
            ctx.shadowColor = char.color;
            ctx.shadowBlur = isSelected ? 15 : 5;

            // Zoomed shoulders (wider rect)
            ctx.fillRect(-22, -35, 44, 40);

            // Zoomed neck
            ctx.fillRect(-7, -46, 14, 12);

            // Zoomed head
            ctx.fillRect(-15, -66, 30, 22);

            // Eye slot
            ctx.fillStyle = '#000000';
            ctx.fillRect(4, -58, 8, 4);

            // Draw character upper decorations (horns, daggers, bandanas etc.)
            // Offset standard head Y=-80 to our zoomed head Y=-66
            ctx.save();
            ctx.translate(0, 14);
            this.drawFighterUpperDetails(ctx, i, 1);
            ctx.restore();

            ctx.restore(); // restore fighter figure transform

            ctx.restore(); // restore clipping context
            ctx.filter = 'none'; // reset filter
        }

        // Draw Outer Neon Border
        ctx.strokeStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = 20;
        ctx.lineWidth = Math.max(3, Math.floor(radius * 0.038));
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Sleek Center Pin/Cap
        const centerPinRadius = Math.max(12, Math.floor(radius * 0.15));
        ctx.fillStyle = '#050012';
        ctx.strokeStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, centerPinRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Top Arrow Pointer (stays static pointing down)
        ctx.save();
        ctx.translate(wheelX, wheelY - radius - radius * 0.12);
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const arrowW = radius * 0.08;
        const arrowH = radius * 0.10;
        ctx.moveTo(-arrowW, 0);
        ctx.lineTo(arrowW, 0);
        ctx.lineTo(0, arrowH);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // --- SELECTED FIGHTER DETAILS (Right Side) ---
        const startX = screenW * 0.54;
        const startY = screenH * 0.24;
        const cardW = screenW * 0.40;
        const cardH = screenH * 0.60;

        const weaponNames = [
            'VISOR BLADE',
            'MAGMA CLAYMORE',
            'SHADOW DAGGERS',
            'JADE KATANA',
            'STEEL GREATSWORD'
        ];

        const abilities = [
            'Double Energy Charge Rate',
            'Spawns Molten Ground Lava',
            'Phases Out Shield Chip Damage',
            'Super Extended Katana Reach',
            'Heavy Super Armor & Shield'
        ];

        const currentSelected = this.characters[this.selectedCharIndex];

        ctx.save();
        ctx.translate(startX, startY);
        ctx.textAlign = 'left';

        // Card box with signature color outline
        ctx.strokeStyle = currentSelected.color;
        ctx.shadowColor = currentSelected.color;
        ctx.shadowBlur = 20;
        ctx.lineWidth = Math.max(3, Math.floor(cardH * 0.012));
        ctx.fillStyle = 'rgba(10, 5, 30, 0.90)';
        ctx.beginPath();
        ctx.roundRect(0, 0, cardW, cardH, 14);
        ctx.fill();
        ctx.stroke();

        // Large Fighter Name (Centered horizontally at cardW / 2)
        ctx.save();
        ctx.textAlign = 'center';
        const nameSize = Math.max(20, Math.floor(cardH * 0.09));
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = currentSelected.color;
        ctx.shadowBlur = 10;
        ctx.font = 'bold ' + nameSize + 'px monospace';
        ctx.fillText(currentSelected.name, cardW / 2, cardH * 0.12);

        // Weapon (Centered horizontally at cardW / 2)
        const weaponSize = Math.max(9, Math.floor(cardH * 0.04));
        ctx.fillStyle = currentSelected.color;
        ctx.font = 'bold ' + weaponSize + 'px monospace';
        ctx.fillText(weaponNames[this.selectedCharIndex], cardW / 2, cardH * 0.17);

        // DEFEATED / DERROTADO Status Overlay!
        if (this.arcadeOpponentsDefeated[this.selectedCharIndex]) {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 15;
            ctx.font = 'bold ' + Math.max(12, Math.floor(cardH * 0.045)) + 'px monospace';
            ctx.fillText("DERROTADO / DEFEATED", cardW / 2, cardH * 0.22);
        }
        ctx.restore();

        // Large Preview Figure (Left side of card)
        ctx.save();
        ctx.translate(cardW * 0.20, cardH * 0.55);
        const previewScale = (cardH / 255) * 1.15;
        ctx.scale(previewScale, previewScale);
        ctx.fillStyle = currentSelected.color;
        ctx.shadowColor = currentSelected.color;
        ctx.shadowBlur = 15;
        
        ctx.fillRect(-15, -40, 30, 60);
        this.drawFighterLegDetails(ctx, this.selectedCharIndex);
        this.drawFighterUpperDetails(ctx, this.selectedCharIndex, 1);
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(5, -32, 8, 4);
        ctx.restore();

        // Stats (Bars on the right side of card)
        const barStartX = cardW * 0.46;
        const barStartY = cardH * 0.32;
        const barW = cardW * 0.44;
        const barH = Math.max(4, Math.floor(cardH * 0.02));
        const barSpacing = cardH * 0.085;

        const statLabelSize = Math.max(9, Math.floor(cardH * 0.038));

        // HP Bar
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold ' + statLabelSize + 'px monospace';
        ctx.fillText('HP', barStartX, barStartY);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barStartX, barStartY + 4, barW, barH);
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(barStartX, barStartY + 4, (currentSelected.hp / 180) * barW, barH);

        // Speed Bar
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('SPEED', barStartX, barStartY + barSpacing);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barStartX, barStartY + barSpacing + 4, barW, barH);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(barStartX, barStartY + barSpacing + 4, (currentSelected.speed / 450) * barW, barH);

        // Damage Bar
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('DAMAGE', barStartX, barStartY + barSpacing * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(barStartX, barStartY + barSpacing * 2 + 4, barW, barH);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(barStartX, barStartY + barSpacing * 2 + 4, (currentSelected.damage / 25) * barW, barH);

        // Ability Text Sizes
        const abilityLabelSize = Math.max(10, Math.floor(cardH * 0.04));
        const abilityTextSize = Math.max(9, Math.floor(cardH * 0.038));

        // Ability
        ctx.fillStyle = currentSelected.color;
        ctx.font = 'bold ' + abilityLabelSize + 'px monospace';
        ctx.fillText('HABILIDADE ESPECIAL:', cardW * 0.08, cardH * 0.81);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + abilityTextSize + 'px monospace';
        ctx.fillText(abilities[this.selectedCharIndex], cardW * 0.08, cardH * 0.86);

        ctx.restore();

        // --- DRAW SPARKS OVER THE SELECT SCREEN DURING BOSS INTRO EXPLOSION ---
        for (const sp of this.sparks) {
            const ratio = sp.timer / sp.maxTimer;
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.strokeStyle = sp.color;
            ctx.shadowColor = sp.color;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            const currentSize = sp.size * (1 - ratio);
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * currentSize, Math.sin(angle) * currentSize);
            }
            ctx.stroke();
            ctx.restore();
        }

        // --- INSTRUCTIONS AT BOTTOM ---
        const footerSize = Math.max(10, Math.floor(screenH * 0.018));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = 'bold ' + footerSize + 'px monospace';
        
        let footerText = "A/D ou Setas: Mover.  [Mantenha pressionado]: Giro da Sorte!  Espaco/Enter: Lutar!";
        if (this.isSpinningRandomly) {
            footerText = "ROLETANDO... / SPINNING...";
        }
        if (this.phase === 'opponent_select') {
            footerText = "AGUARDE... SELECIONANDO OPONENTE / PLEASE WAIT... SELECTING OPPONENT";
        }
        if (this.phase === 'boss_intro') {
            footerText = "ALERTA! APROXIMAÇÃO DE CHEFE DETECTADA / WARNING! BOSS APPROACH DETECTED";
        }

        ctx.fillText(footerText, screenW / 2, screenH * 0.90);
        ctx.restore();
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        this.lastScreenW = screenW;
        this.lastScreenH = screenH;

        if (this.phase === 'char_select' || this.phase === 'opponent_select' || this.phase === 'boss_intro') {
            this.drawCharSelect(ctx, screenW, screenH);
            
            // Draw Screen Flash on selection/intro screens too!
            if (this.screenFlash > 0) {
                ctx.fillStyle = `rgba(${this.screenFlashColor}, ${this.screenFlash})`;
                ctx.fillRect(0, 0, screenW, screenH);
            }
            return;
        }

        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        ctx.fillStyle = '#050010';
        ctx.fillRect(0, 0, screenW, screenH);

        const scale = Math.min(screenW * 0.95 / this.fieldW, screenH * 0.85 / this.fieldH);
        const ox = (screenW - this.fieldW * scale) / 2;
        const oy = (screenH - this.fieldH * scale) / 2 + s(20);

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Background Dragon
        this.drawDragon(ctx);

        // Ground
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, this.groundY, this.fieldW, this.fieldH - this.groundY);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(this.fieldW, this.groundY);
        ctx.stroke();

        // Hazards
        for (const h of this.hazards) {
            if (!h.active) continue;
            
            ctx.save();
            if (h.type === 'fire') {
                // Symmetrical glowing fire spike
                ctx.fillStyle = '#ff4400';
                ctx.shadowColor = '#ffaa00';
                ctx.shadowBlur = 10;
                
                ctx.beginPath();
                ctx.moveTo(h.x - 12, h.y);
                ctx.lineTo(h.x, h.y - 20); // Fire spike top
                ctx.lineTo(h.x + 12, h.y);
                ctx.closePath();
                ctx.fill();
                
                // Inner core flame
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.moveTo(h.x - 6, h.y);
                ctx.lineTo(h.x, h.y - 10);
                ctx.lineTo(h.x + 6, h.y);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = h.type === 'rock' ? '#666' : (h.type === 'tree' ? '#4a3' : '#0ff');
                ctx.fillRect(h.x - 15, h.y - 15, 30, 30);
            }
            ctx.restore();
        }

        // Fighters
        this.drawFighter(ctx, this.p1);
        this.drawFighter(ctx, this.p2);

        // Draw Sparks
        for (const sp of this.sparks) {
            const ratio = sp.timer / sp.maxTimer;
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.strokeStyle = sp.color;
            ctx.shadowColor = sp.color;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 3;
            
            // Draw an exploding cross/starburst
            ctx.beginPath();
            const currentSize = sp.size * (1 - ratio);
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * currentSize, Math.sin(angle) * currentSize);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Floating Combo texts above fighters
        if (this.p1.comboCount >= 2) {
            ctx.save();
            ctx.translate(this.p1.x, this.p1.y - 100);
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 15;
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px monospace';
            ctx.fillText(`${this.p1.comboCount} HIT COMBO!`, 0, 0);
            ctx.restore();
        }
        if (this.p2.comboCount >= 2) {
            ctx.save();
            ctx.translate(this.p2.x, this.p2.y - 100);
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 15;
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px monospace';
            ctx.fillText(`${this.p2.comboCount} HIT COMBO!`, 0, 0);
            ctx.restore();
        }

        // Intro Text
        if (this.phase === 'round_intro') {
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px monospace';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff88';
            ctx.fillText(`ROUND ${this.round}`, this.fieldW / 2, 200);
            ctx.font = 'bold 40px monospace';
            ctx.fillText('FIGHT!', this.fieldW / 2, 260);
            ctx.shadowBlur = 0;
        }

        // Draw pulsing pre-freeze special aura highlight around the charging attacker
        if (this.specialPreFreezeTimer > 0 && this.specialPreFreezeAttacker) {
            const att = this.specialPreFreezeAttacker;
            const color = this.characters[att.charId].color;
            ctx.save();
            ctx.translate(att.x, att.y - 40);
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 30 + Math.sin(Date.now() * 0.02) * 10;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, 45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();

        // HUD
        this.drawHUD(ctx, screenW, oy, r);
        
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Pre-freeze dimming overlay to create a dramatic pause before the special
        if (this.specialPreFreezeTimer > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(0, 0, screenW, screenH);
        }

        // High-energy Screen Flash Overlay
        if (this.screenFlash > 0) {
            ctx.fillStyle = `rgba(${this.screenFlashColor}, ${this.screenFlash})`;
            ctx.fillRect(0, 0, screenW, screenH);
        }
    }

    private drawDragon(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.fieldW / 2, 180);
        
        // Flip based on direction
        if (this.dragonDirection === -1) {
            ctx.scale(-1, 1);
        }

        const float = Math.sin(this.dragonFrame) * 10;
        ctx.translate(0, float);

        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff88';
        
        // Body (Simplified Neon)
        ctx.beginPath();
        ctx.moveTo(-150, 0);
        ctx.bezierCurveTo(-100, -100, 100, 100, 150, -50);
        ctx.stroke();

        // Draw Dragon Head at (150, -50)
        ctx.save();
        ctx.translate(150, -50);
        ctx.rotate(Math.sin(this.dragonFrame * 2) * 0.08); // cool breathing animation rotation!
        
        ctx.fillStyle = '#050010'; // Dark background fill to mask the body curve end
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ff88';
        
        // Draw head silhouette
        ctx.beginPath();
        ctx.moveTo(-15, 10);
        ctx.lineTo(20, 20); // jaw/chin
        ctx.lineTo(40, 12); // snout bottom tip
        ctx.lineTo(30, 4);  // mouth inside bottom
        ctx.lineTo(12, 0);  // deep mouth
        ctx.lineTo(35, -12); // mouth inside top
        ctx.lineTo(52, -22); // snout top
        ctx.lineTo(48, -28); // nose horn
        ctx.lineTo(25, -30); // forehead
        ctx.lineTo(15, -55); // horn 1
        ctx.lineTo(5, -30);  // horn gap
        ctx.lineTo(-5, -48); // horn 2
        ctx.lineTo(-12, -25); // back head
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing eye (Magenta/Violet neon)
        ctx.fillStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(8, -15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Fire
        if (this.dragonFire > 0) {
            ctx.save();
            ctx.translate(150, -50);
            ctx.rotate(Math.sin(this.dragonFrame * 2) * 0.08); // match head rotation!
            
            // Multiple layers for rich visual fire channelling!
            const fireLength = 160 + Math.sin(Date.now() * 0.08) * 35;
            
            // 1. Outer Flare (Deep Magenta/Red)
            ctx.fillStyle = 'rgba(255, 0, 150, 0.3)';
            ctx.shadowColor = '#ff0077';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.moveTo(15, 2);
            ctx.bezierCurveTo(80, -70, 150, -90, fireLength, -35);
            ctx.bezierCurveTo(150, 45, 80, 50, 15, 8);
            ctx.closePath();
            ctx.fill();
            
            // 2. Middle Flame (Neon Orange)
            ctx.fillStyle = 'rgba(255, 100, 0, 0.75)';
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.bezierCurveTo(70, -45, 120, -55, fireLength * 0.75, -15);
            ctx.bezierCurveTo(120, 25, 70, 30, 20, 5);
            ctx.closePath();
            ctx.fill();

            // 3. Inner core (White Hot Yellow)
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(25, -2);
            ctx.bezierCurveTo(55, -25, 90, -30, fireLength * 0.45, -5);
            ctx.bezierCurveTo(90, 15, 55, 15, 25, 2);
            ctx.closePath();
            ctx.fill();
            
            // 4. Spark particles
            ctx.fillStyle = '#ffcc00';
            ctx.shadowBlur = 5;
            for (let i = 0; i < 6; i++) {
                const px = 40 + Math.random() * (fireLength - 50);
                const py = (Math.random() - 0.5) * (px * 0.4);
                ctx.beginPath();
                ctx.arc(px, py, 2 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();
    }

    private drawFighterLegDetails(ctx: CanvasRenderingContext2D, charId: number) {
        ctx.save();
        if (charId === 0) { // FROST
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(-21, -25, 2, 10);
            ctx.fillRect(19, -25, 2, 10);
        } else if (charId === 1) { // VULCAN
            ctx.fillStyle = '#551100'; // heavy magma boots
            ctx.fillRect(-22, -15, 44, 15);
        } else if (charId === 2) { // SHADOW
            ctx.fillStyle = '#220033'; // dark pants shadow
            ctx.fillRect(-20, -35, 40, 5);
        } else if (charId === 3) { // JADE
            ctx.fillStyle = '#00ff88'; // green knee guards
            ctx.fillRect(-21, -20, 3, 6);
            ctx.fillRect(18, -20, 3, 6);
        } else if (charId === 4) { // BEHEMOTH
            ctx.fillStyle = '#888888'; // heavy iron plate boots
            ctx.fillRect(-23, -20, 46, 20);
        } else if (charId === 5) { // VALKOR (BOSS)
            ctx.fillStyle = '#ff0055'; // Glowing crimson armor boots
            ctx.fillRect(-23, -22, 46, 22);
            ctx.fillStyle = '#ffd700'; // Gold ankle trim
            ctx.fillRect(-24, -8, 48, 6);
        }
        ctx.restore();
    }

    private drawFighterUpperDetails(ctx: CanvasRenderingContext2D, charId: number, direction: number) {
        ctx.save();
        if (charId === 0) { // FROST
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.fillRect(direction * 7, -72, 8, 4); // visor
            
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(-5, -80);
            ctx.lineTo(5, -80);
            ctx.lineTo(direction * 12, -92);
            ctx.closePath();
            ctx.fill();
        } 
        else if (charId === 1) { // VULCAN
            ctx.fillStyle = '#ff6600';
            ctx.shadowColor = '#ff3300';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(-15, -75);
            ctx.lineTo(-22, -88);
            ctx.lineTo(-8, -80);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(15, -75);
            ctx.lineTo(22, -88);
            ctx.lineTo(8, -80);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(-10, -60, 20, 15);
        } 
        else if (charId === 2) { // SHADOW
            ctx.fillStyle = '#150025';
            ctx.fillRect(-22, -82, 44, 12);
            
            ctx.fillStyle = '#aa00ff';
            ctx.fillRect(-24, -50, 48, 6);
            
            ctx.beginPath();
            ctx.moveTo(-direction * 20, -48);
            ctx.lineTo(-direction * 45, -35);
            ctx.lineTo(-direction * 20, -42);
            ctx.closePath();
            ctx.fill();
        } 
        else if (charId === 3) { // JADE
            ctx.fillStyle = '#00ff88';
            ctx.fillRect(-22, -74, 44, 4);
            
            ctx.beginPath();
            ctx.moveTo(-direction * 20, -72);
            ctx.lineTo(-direction * 40, -62);
            ctx.lineTo(-direction * 20, -68);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#006633';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-18, -70);
            ctx.lineTo(18, -45);
            ctx.moveTo(18, -70);
            ctx.lineTo(-18, -45);
            ctx.stroke();
        } 
        else if (charId === 4) { // BEHEMOTH
            ctx.fillStyle = '#cccccc';
            ctx.fillRect(-26, -65, 8, 12);
            ctx.fillRect(18, -65, 8, 12);

            ctx.fillStyle = '#ff0033';
            ctx.beginPath();
            ctx.moveTo(-3, -80);
            ctx.lineTo(3, -80);
            ctx.lineTo(0, -96);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#888888';
            ctx.fillRect(-15, -60, 30, 20);
        } else if (charId === 5) { // VALKOR (BOSS)
            // Big golden horns/crown of the supreme Emperor
            ctx.fillStyle = '#ffd700';
            ctx.shadowColor = '#7a00ff';
            ctx.shadowBlur = 18;
            
            // Left horn
            ctx.beginPath();
            ctx.moveTo(-12, -80);
            ctx.lineTo(-26, -100);
            ctx.lineTo(-4, -86);
            ctx.closePath();
            ctx.fill();
            
            // Right horn
            ctx.beginPath();
            ctx.moveTo(12, -80);
            ctx.lineTo(26, -100);
            ctx.lineTo(4, -86);
            ctx.closePath();
            ctx.fill();
            
            // Golden Halo arc above head to feel like a deity
            ctx.save();
            ctx.strokeStyle = '#ffd700';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, -68, 20, Math.PI, 0); // arc above head
            ctx.stroke();
            ctx.restore();

            // Glowing void cyan visor of destruction
            ctx.fillStyle = '#00ffdd';
            ctx.shadowColor = '#00ffdd';
            ctx.shadowBlur = 15;
            ctx.fillRect(-15, -70, 30, 6);
            
            // Dramatic dark shoulder pauldrons
            ctx.fillStyle = '#150025';
            ctx.fillRect(-26, -65, 52, 10);

            // Shimmering Golden shoulder spikes
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-28, -70, 4, 6);
            ctx.fillRect(24, -70, 4, 6);

            // Glowing Core of divine energy on chest (void cyan core with purple glow)
            ctx.fillStyle = '#00ffdd';
            ctx.shadowColor = '#7a00ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, -45, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
        ctx.save();
        ctx.translate(f.x, f.y);
        
        const char = this.characters[f.charId];
        
        // Scale Boss to make him slightly larger (1.25x) and imposing!
        const isBoss = f.charId === 5;
        if (isBoss) {
            ctx.scale(1.25, 1.25);
            
            // Draw a powerful, glowing divine aura behind the boss (mystical void glow)
            ctx.save();
            ctx.shadowBlur = 40 + Math.sin(Date.now() / 150) * 15;
            // Shifting void colors (deep purple and neon indigo/cyan)
            ctx.shadowColor = Math.sin(Date.now() / 300) > 0 ? '#7a00ff' : '#00bfff'; 
            ctx.fillStyle = 'rgba(122, 0, 255, 0.05)'; // Faint purple glow fill
            ctx.beginPath();
            ctx.arc(0, -40, 45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Determine body fill style
        let bodyFill: string | CanvasGradient = char.color;
        if (isBoss) {
            const grad = ctx.createLinearGradient(0, -80, 0, 0);
            const t = Date.now() / 2500;
            const color1 = '#09090e'; // black
            const color2 = '#3a3a45'; // dark slate gray
            const purpleVal = Math.floor(90 + Math.sin(t) * 40);
            const color3 = `rgb(${Math.floor(purpleVal * 0.4)}, 8, ${purpleVal})`; // deep void violet
            
            grad.addColorStop(0, color1);
            grad.addColorStop(0.5, color2);
            grad.addColorStop(1, color3);
            bodyFill = grad;
        }

        ctx.fillStyle = bodyFill;
        ctx.shadowBlur = isBoss ? 25 : 15;
        ctx.shadowColor = char.color;

        if (f.state === 'hit') ctx.translate(Math.sin(Date.now() * 0.1) * 5, 0);
        if (f.state === 'stunned') ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;

        // Draw character body (Normal or Fatality Sliced style)
        if (f.isBisected) {
            const t = f.bisectTimer || 0;
            const pushDir = -f.direction; 
            const slideX = t * 95 * pushDir;
            const slideY = Math.min(45, t * t * 190);
            const rot = pushDir * t * 1.3;

            // Draw Lower Half (Legs staying on the ground)
            ctx.fillStyle = bodyFill;
            ctx.fillRect(-20, -40, 40, 40);
            this.drawFighterLegDetails(ctx, f.charId);

            // Draw Upper Half (Torso, head and eyes, sliding and tilting dynamically)
            ctx.save();
            ctx.translate(slideX, slideY);
            ctx.rotate(rot);
            // Chest & Head
            ctx.fillStyle = bodyFill;
            ctx.fillRect(-20, -80, 40, 40);
            this.drawFighterUpperDetails(ctx, f.charId, f.direction);
            
            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(f.direction * 5, -70, 10, 5);
            ctx.restore();
        } else {
            // Draw character body normally
            ctx.fillRect(-20, -80, 40, 80);
            
            this.drawFighterLegDetails(ctx, f.charId);
            this.drawFighterUpperDetails(ctx, f.charId, f.direction);

            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(f.direction * 5, -70, 10, 5);
        }
        
        // Symmetrical glowing laser swords with arcing trail slash swoosh!
        if (f.state === 'attack') {
            const swordColor = char.color;
            ctx.save();
            
            // Draw a beautiful motion slash arc trailing the sword
            ctx.fillStyle = `rgba(${this.getRGBColor(swordColor)}, 0.25)`;
            ctx.beginPath();
            if (f.direction === 1) {
                ctx.arc(0, -40, 75, -Math.PI / 4, Math.PI / 4);
                ctx.lineTo(0, -40);
            } else {
                ctx.arc(0, -40, 75, Math.PI * 3 / 4, Math.PI * 5 / 4);
                ctx.lineTo(0, -40);
            }
            ctx.closePath();
            ctx.fill();

            // Draw the actual sword
            ctx.shadowColor = swordColor;
            ctx.shadowBlur = 15;
            
            // Set sword orientation
            ctx.translate(f.direction * 15, -45);
            ctx.rotate(f.direction * Math.PI / 6); // slightly tilted strike angle

            // Guard/Hilt (Metallic gray/yellow hilt crossguard)
            ctx.fillStyle = '#888899';
            ctx.fillRect(-3, -15, 6, 30); // crossguard
            ctx.fillStyle = '#ffd700';    // golden pommel
            ctx.fillRect(f.direction === 1 ? -12 : 6, -3, 6, 6); // pommel

            // Blade (Steel body with neon glowing edge)
            ctx.fillStyle = '#e2e2e2'; // steel blade center
            if (f.direction === 1) {
                // Symmetrical blade shape
                ctx.fillRect(0, -5, 45, 10);
                // Glowing edge
                ctx.fillStyle = swordColor;
                ctx.fillRect(5, -6, 38, 2);
                ctx.fillRect(5, 4, 38, 2);
                // Tip of sword
                ctx.beginPath();
                ctx.moveTo(45, -5);
                ctx.lineTo(52, 0);
                ctx.lineTo(45, 5);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillRect(-45, -5, 45, 10);
                ctx.fillStyle = swordColor;
                ctx.fillRect(-43, -6, 38, 2);
                ctx.fillRect(-43, 4, 38, 2);
                ctx.beginPath();
                ctx.moveTo(-45, -5);
                ctx.lineTo(-52, 0);
                ctx.lineTo(-45, 5);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }



        ctx.restore();
    }

    private drawHUD(ctx: CanvasRenderingContext2D, screenW: number, oy: number, _r: (n: number) => number) {
        const barW = 300;
        const barH = 20;
        
        // P1 HP
        ctx.fillStyle = '#333';
        ctx.fillRect(50, oy - 40, barW, barH);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(50, oy - 40, (this.p1.hp / this.p1.maxHp) * barW, barH);
        
        // P2 HP
        ctx.fillStyle = '#333';
        ctx.fillRect(screenW - 50 - barW, oy - 40, barW, barH);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(screenW - 50 - barW + (1 - this.p2.hp / this.p2.maxHp) * barW, oy - 40, (this.p2.hp / this.p2.maxHp) * barW, barH);

        // Stun bars
        ctx.fillStyle = '#550';
        ctx.fillRect(50, oy - 15, (this.p1.stun / this.p1.maxStun) * barW, 5);
        ctx.fillRect(screenW - 50 - barW + (1 - this.p2.stun / this.p2.maxStun) * barW, oy - 15, (this.p2.stun / this.p2.maxStun) * barW, 5);

        // P1 Energy Bar (Titan's Fury)
        ctx.fillStyle = '#220022';
        ctx.fillRect(50, oy - 5, barW, 8);
        const p1EnergyRatio = this.p1.energy / this.p1.maxEnergy;
        ctx.fillStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = this.p1.energy >= 100 ? 12 : 0;
        ctx.fillRect(50, oy - 5, p1EnergyRatio * barW, 8);
        ctx.shadowBlur = 0;
        
        // P2 Energy Bar
        ctx.fillStyle = '#220022';
        ctx.fillRect(screenW - 50 - barW, oy - 5, barW, 8);
        const p2EnergyRatio = this.p2.energy / this.p2.maxEnergy;
        ctx.fillStyle = '#ff00aa';
        ctx.shadowColor = '#ff00aa';
        ctx.shadowBlur = this.p2.energy >= 100 ? 12 : 0;
        ctx.fillRect(screenW - 50 - barW + (1 - p2EnergyRatio) * barW, oy - 5, p2EnergyRatio * barW, 8);
        ctx.shadowBlur = 0;

        // Ready Indicators
        ctx.font = 'bold 11px monospace';
        if (this.p1.energy >= 100) {
            ctx.fillStyle = '#ff00aa';
            ctx.textAlign = 'left';
            ctx.fillText('[E] FURY READY!', 50, oy + 15);
        }
        if (this.p2.energy >= 100) {
            ctx.fillStyle = '#ff00aa';
            ctx.textAlign = 'right';
            ctx.fillText('FURY READY!', screenW - 50, oy + 15);
        }

        // Round wins
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`WINS: ${this.playerWins}`, 50, oy - 50);
        ctx.textAlign = 'right';
        ctx.fillText(`WINS: ${this.enemyWins}`, screenW - 50, oy - 50);
    }
}
