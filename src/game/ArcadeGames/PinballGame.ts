/**
 * Pinball Neon — Synthwave Casino Edition.
 * Features 4 flippers, launcher lane, and complex neon geometry.
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { SoundManager } from '../Core/SoundManager';

interface Vec2 { x: number; y: number; }

interface Bumper {
    x: number;
    y: number;
    radius: number;
    color: string;
    active: number; 
    points: number;
}

interface Wall {
    p1: Vec2;
    p2: Vec2;
    color: string;
    isBouncy?: boolean;
}

interface Flipper {
    pivot: Vec2;
    angle: number;
    length: number;
    isLeft: boolean; 
    targetAngle: number;
    restAngle: number;
    color: string;
    key: string[]; 
    isActuating?: boolean;
}

export class PinballGame {
    private fieldW = 360;
    private fieldH = 600;

    private ballPos: Vec2 = { x: 332, y: 550 };
    private ballVel: Vec2 = { x: 0, y: 0 };
    private ballRadius = 9; // Larger ball
    private gravity = 1200; // Even lighter to increase "tempo da bola" (hang time)
    private friction = 0.992; // More friction for natural slowdown
    private subSteps = 8; 

    private launcherPower = 0;
    private isCharging = false;
    private ballInLauncher = true;
    private launchCooldown = 0.8;
    private plungerVisualY = 575; 
    private plungerTargetY = 575;  

    private flippers: Flipper[] = [];
    private flipperSpeed = 24; 

    private walls: Wall[] = [];
    private bumpers: Bumper[] = [];
    
    public score = 0;
    public phase: 'playing' | 'game_over' = 'playing';
    private gameOverPhrase: string = '';
    public ballsLeft = 2;
    private ballSavedTimer = 0;
    private isBallSavedActive = false;
    
    private trail: { x: number; y: number; alpha: number }[] = [];
    private particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
    private flash = 0;

    constructor() {
        this.initGeometry();
        this.reset();
    }

    private initGeometry() {
        const wallColor = '#00e5ff'; // Cyan
        const slingColor = '#ff00aa'; // Hot Pink
        const flipperColor = '#ffaa00'; // Gold

        this.flippers = [
            {
                pivot: { x: 85, y: 540 }, // Closer to center
                angle: 0.4,
                length: 65,
                isLeft: true,
                restAngle: 0.4,
                targetAngle: -0.5,
                color: flipperColor,
                key: ['ArrowLeft', 'KeyA'],
                isActuating: false
            },
            {
                pivot: { x: 240, y: 540 }, // Closer to center
                angle: Math.PI - 0.4,
                length: 65,
                isLeft: false,
                restAngle: Math.PI - 0.4,
                targetAngle: Math.PI + 0.5,
                color: flipperColor,
                key: ['ArrowRight', 'KeyD'],
                isActuating: false
            },
            {
                pivot: { x: 40, y: 280 },
                angle: 0.5,
                length: 45,
                isLeft: true,
                restAngle: 0.5,
                targetAngle: -0.4,
                color: flipperColor,
                key: ['ArrowLeft', 'KeyA']
            },
            {
                pivot: { x: 285, y: 250 },
                angle: Math.PI - 0.5,
                length: 45,
                isLeft: false,
                restAngle: Math.PI - 0.5,
                targetAngle: Math.PI + 0.4,
                color: flipperColor,
                key: ['ArrowRight', 'KeyD']
            }
        ];

        this.walls = [
            // Left outer boundary
            { p1: { x: 10, y: 100 }, p2: { x: 10, y: 600 }, color: wallColor }, 
            
            // Left inner walls
            { p1: { x: 35, y: 400 }, p2: { x: 35, y: 490 }, color: wallColor },
            { p1: { x: 35, y: 490 }, p2: { x: 85, y: 540 }, color: wallColor }, 
            
            // Left outlane BLOCKER (diverts ball into the inlane)
            { p1: { x: 10, y: 380 }, p2: { x: 35, y: 400 }, color: '#ffaa00' }, 
            
            // Right launcher outer and inner walls
            { p1: { x: 350, y: 100 }, p2: { x: 350, y: 600 }, color: wallColor }, 
            { p1: { x: 315, y: 595 }, p2: { x: 350, y: 595 }, color: wallColor }, 
            { p1: { x: 315, y: 120 }, p2: { x: 315, y: 600 }, color: wallColor }, 

            // Right inner walls (Right outlane is OPEN from the top)
            { p1: { x: 290, y: 400 }, p2: { x: 290, y: 490 }, color: wallColor },
            { p1: { x: 290, y: 490 }, p2: { x: 240, y: 540 }, color: wallColor }, 
            
            // Top curves (reverted to original symmetry)
            { p1: { x: 350, y: 100 }, p2: { x: 350, y: 50 }, color: wallColor }, 
            { p1: { x: 350, y: 50 }, p2: { x: 330, y: 15 }, color: wallColor },
            { p1: { x: 330, y: 15 }, p2: { x: 280, y: 5 }, color: wallColor },
            { p1: { x: 280, y: 5 }, p2: { x: 160, y: 5 }, color: wallColor },
            { p1: { x: 160, y: 5 }, p2: { x: 60, y: 15 }, color: wallColor },
            { p1: { x: 60, y: 15 }, p2: { x: 10, y: 100 }, color: wallColor },
            
            // Left Slingshot
            { p1: { x: 60, y: 400 }, p2: { x: 75, y: 480 }, color: slingColor, isBouncy: true },
            { p1: { x: 60, y: 400 }, p2: { x: 75, y: 380 }, color: slingColor },

            // Right Slingshot
            { p1: { x: 265, y: 400 }, p2: { x: 250, y: 480 }, color: slingColor, isBouncy: true },
            { p1: { x: 265, y: 400 }, p2: { x: 250, y: 380 }, color: slingColor },
        ];

        this.bumpers = [
            { x: 160, y: 130, radius: 24, color: '#ff00aa', active: 0, points: 2 },
            { x: 105, y: 180, radius: 18, color: '#00e5ff', active: 0, points: 1 },
            { x: 215, y: 180, radius: 18, color: '#00e5ff', active: 0, points: 1 },
            { x: 160, y: 240, radius: 15, color: '#ffaa00', active: 0, points: 2 },
            
            { x: 60, y: 350, radius: 12, color: '#bc00ff', active: 0, points: 1 },
            { x: 260, y: 320, radius: 12, color: '#bc00ff', active: 0, points: 1 },
        ];
    }

    public reset() {
        this.ballPos = { x: 332, y: 550 };
        this.ballVel = { x: 0, y: 0 };
        this.score = 0;
        this.ballsLeft = 2;
        this.ballSavedTimer = 0;
        this.isBallSavedActive = false;
        this.phase = 'playing';
        this.trail = [];
        this.particles = [];
        this.flash = 0;
        this.launcherPower = 0;
        this.ballInLauncher = true;
        this.isCharging = false;
        this.launchCooldown = 0.8;
        this.plungerVisualY = 575;
        this.plungerTargetY = 575;
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();
        const mobile = isMobile();

        if (this.launchCooldown > 0) {
            this.launchCooldown -= dt;
        }

        if (this.ballSavedTimer > 0) {
            this.ballSavedTimer -= dt;
            if (this.ballSavedTimer <= 0) {
                this.isBallSavedActive = false;
            }
        }

        if (this.ballInLauncher) {
            this.ballPos.x = 332;
            this.ballPos.y = 560;
            this.ballVel.x = 0;
            this.ballVel.y = 0;

            if (this.launchCooldown <= 0) {
                const chargeDown = input.isDown('Space') || input.isDown('Enter') || (mobile && input.getJoystickVector().y > 0.5);
                
                if (chargeDown) {
                    this.isCharging = true;
                    this.launcherPower = Math.min(this.launcherPower + dt * 1800, 2800);
                    this.plungerTargetY = 575 + (this.launcherPower / 2800) * 20;
                } else if (this.isCharging) {
                    if (this.launcherPower > 300) {
                        this.ballVel.y = -this.launcherPower;
                        this.ballInLauncher = false;
                        SoundManager.getInstance().play('arcade_bounce');
                        this.plungerTargetY = 545;
                        setTimeout(() => this.plungerTargetY = 575, 100);
                        
                        // 13% chance to trigger Ball Saved
                        if (Math.random() <= 0.13) {
                            this.isBallSavedActive = true;
                            this.ballSavedTimer = 4.0;
                        }
                    } else {
                        this.plungerTargetY = 575;
                    }
                    this.launcherPower = 0;
                    this.isCharging = false;
                }
            }
            this.plungerVisualY += (this.plungerTargetY - this.plungerVisualY) * 20 * dt;
            this.updateVisuals(dt);
            return;
        }
        
        this.plungerTargetY = 575;
        this.plungerVisualY += (this.plungerTargetY - this.plungerVisualY) * 10 * dt;

        const subDt = dt / this.subSteps;
        for (let i = 0; i < this.subSteps; i++) {
            this.stepPhysics(subDt);
        }

        if (this.ballPos.y > this.fieldH + 20) {
            if (this.isBallSavedActive) {
                this.isBallSavedActive = false;
                this.ballSavedTimer = 0;
                this.ballInLauncher = true;
                this.flash = 0.5;
                SoundManager.getInstance().play('arcade_hit');
            } else {
                this.ballsLeft--;
                if (this.ballsLeft > 0) {
                    this.ballInLauncher = true;
                    this.flash = 0.2;
                    SoundManager.getInstance().play('lose');
                } else {
                    this.phase = 'game_over';
                    this.gameOverPhrase = getMotivationalPhrase();
                    SoundManager.getInstance().play('lose');
                }
            }
        }

        this.updateVisuals(dt);
    }

    private stepPhysics(dt: number) {
        const input = InputManager.getInstance();
        const mobile = isMobile();

        for (const f of this.flippers) {
            const isDown = f.key.some(k => input.isDown(k)) || 
                           (mobile && f.isLeft && input.getJoystickVector().x < -0.3) ||
                           (mobile && !f.isLeft && input.getJoystickVector().x > 0.3);
            
            const target = isDown ? f.targetAngle : f.restAngle;
            const diff = target - f.angle;
            f.angle += diff * this.flipperSpeed * dt;
            f.isActuating = isDown && Math.abs(diff) > 0.1;
        }

        this.ballVel.y += this.gravity * dt;
        this.ballVel.x *= Math.pow(this.friction, dt * 60);
        this.ballVel.y *= Math.pow(this.friction, dt * 60);

        const speedSq = this.ballVel.x * this.ballVel.x + this.ballVel.y * this.ballVel.y;
        const maxSpeed = 1600; // Lowered maximum cap
        if (speedSq > maxSpeed * maxSpeed) {
            const speed = Math.sqrt(speedSq);
            this.ballVel.x = (this.ballVel.x / speed) * maxSpeed;
            this.ballVel.y = (this.ballVel.y / speed) * maxSpeed;
        }

        this.ballPos.x += this.ballVel.x * dt;
        this.ballPos.y += this.ballVel.y * dt;

        for (const w of this.walls) {
            this.checkWallCollision(w);
        }

        for (const b of this.bumpers) {
            const dx = this.ballPos.x - b.x;
            const dy = this.ballPos.y - b.y;
            const distSq = dx * dx + dy * dy;
            const minDist = b.radius + this.ballRadius;
            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                
                const dot = this.ballVel.x * nx + this.ballVel.y * ny;
                if (dot < 0) {
                    this.ballVel.x -= (1 + 0.6) * dot * nx; // Reduced bounce energy
                    this.ballVel.y -= (1 + 0.6) * dot * ny;
                }
                
                const pushForce = 400; // Softer bumper push
                this.ballVel.x += nx * pushForce;
                this.ballVel.y += ny * pushForce;
                
                b.active = 0.2;
                this.score += b.points;
                this.flash = 0.1;
                this.spawnParticles(b.x, b.y, b.color, 6);
                SoundManager.getInstance().play('arcade_hit');
                this.ballPos.x = b.x + nx * minDist;
                this.ballPos.y = b.y + ny * minDist;
            }
            if (b.active > 0) b.active -= dt;
        }

        for (const f of this.flippers) {
            this.checkFlipperCollision(f);
        }

        if (!this.ballInLauncher && this.ballPos.x > 300 && this.ballPos.y < 150 && this.ballVel.y > 0) {
            this.ballVel.x -= 1500 * dt; // Strong one-way gate to prevent falling back into launcher
        }

        if (!this.ballInLauncher && this.ballPos.x > 320 && this.ballPos.y > 300 && this.ballVel.y > 0) {
            this.ballInLauncher = true;
            this.ballVel.x = 0;
            this.ballVel.y = 0;
        }
    }

    private checkWallCollision(w: Wall) {
        const x1 = w.p1.x, y1 = w.p1.y, x2 = w.p2.x, y2 = w.p2.y;
        const dx = x2 - x1, dy = y2 - y1;
        const l2 = dx * dx + dy * dy;
        if (l2 === 0) return;

        let t = ((this.ballPos.x - x1) * dx + (this.ballPos.y - y1) * dy) / l2;
        t = Math.max(0, Math.min(1, t));

        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;

        const distDx = this.ballPos.x - closestX;
        const distDy = this.ballPos.y - closestY;
        const distSq = distDx * distDx + distDy * distDy;

        if (distSq < this.ballRadius * this.ballRadius) {
            const dist = Math.sqrt(distSq);
            const nx = distDx / dist;
            const ny = distDy / dist;

            const dot = this.ballVel.x * nx + this.ballVel.y * ny;
            if (dot < 0) {
                const restitution = w.isBouncy ? 1.15 : 0.35; // Softer slingshots
                this.ballVel.x -= (1 + restitution) * dot * nx;
                this.ballVel.y -= (1 + restitution) * dot * ny;
                
                // Very slight friction to avoid losing momentum when sliding
                this.ballVel.x *= 0.995;
                this.ballVel.y *= 0.995;
            }

            this.ballPos.x = closestX + nx * (this.ballRadius + 1);
            this.ballPos.y = closestY + ny * (this.ballRadius + 1);

            SoundManager.getInstance().play('arcade_bounce');
            if (w.isBouncy) {
                this.score += 1;
                this.flash = 0.05;
                this.spawnParticles(closestX, closestY, w.color, 3);
            }
        }
    }

    private checkFlipperCollision(f: Flipper) {
        const pivotX = f.pivot.x;
        const pivotY = f.pivot.y;
        const angle = f.angle;
        const length = f.length;

        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        const vbx = this.ballPos.x - pivotX;
        const vby = this.ballPos.y - pivotY;

        const projection = vbx * dirX + vby * dirY;

        if (projection > -8 && projection < length + 8) {
            const clampedProj = Math.max(0, Math.min(length, projection));
            const pX = pivotX + dirX * clampedProj;
            const pY = pivotY + dirY * clampedProj;

            const distDx = this.ballPos.x - pX;
            const distDy = this.ballPos.y - pY;
            const distSq = distDx * distDx + distDy * distDy;

            const collisionRadius = this.ballRadius + 8;
            if (distSq < collisionRadius * collisionRadius) {
                const dist = Math.sqrt(distSq);
                const nx = distDx / dist;
                const ny = distDy / dist;

                const dot = this.ballVel.x * nx + this.ballVel.y * ny;
                if (dot < 0) {
                    this.ballVel.x -= (1 + 0.3) * dot * nx;
                    this.ballVel.y -= (1 + 0.3) * dot * ny;
                }

                if (f.isActuating) {
                    const distFromPivot = Math.sqrt(vbx * vbx + vby * vby);
                    const tipFactor = Math.max(0.2, Math.min(1.0, distFromPivot / f.length));
                    const targetKickVel = 400 + 1000 * tipFactor; // Faster at the tip (up to 1400)
                    
                    const currentNormalVel = this.ballVel.x * nx + this.ballVel.y * ny;
                    if (currentNormalVel < targetKickVel) {
                        const kickAmount = targetKickVel - Math.max(0, currentNormalVel);
                        this.ballVel.x += nx * kickAmount;
                        this.ballVel.y += ny * kickAmount;
                    }
                }

                this.ballPos.x = pX + nx * (collisionRadius + 1);
                this.ballPos.y = pY + ny * (collisionRadius + 1);

                SoundManager.getInstance().play('arcade_hit');
                this.spawnParticles(this.ballPos.x, this.ballPos.y, '#ffffff', 3);
            }
        }
    }

    private updateVisuals(dt: number) {
        this.trail.push({ x: this.ballPos.x, y: this.ballPos.y, alpha: 1.0 });
        if (this.trail.length > 30) this.trail.shift();
        for (const t of this.trail) t.alpha -= dt * 2.5;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.flash > 0) this.flash -= dt;
    }

    private spawnParticles(x: number, y: number, color: string, count: number) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 120;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.4,
                color
            });
        }
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);

        // Dark Synthwave Background
        ctx.fillStyle = '#050014';
        ctx.fillRect(0, 0, screenW, screenH);

        const mobile = isMobile();
        const scale = Math.min(screenW * 0.95 / this.fieldW, screenH * 0.85 / this.fieldH);
        const ox = (screenW - this.fieldW * scale) / 2;
        const oy = (screenH - this.fieldH * scale) / 2 + s(10);

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // --- Synthwave Sun Background ---
        ctx.save();
        const sunX = 160;
        const sunY = 160;
        const sunR = 120;
        
        const grad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
        grad.addColorStop(0, '#ff00aa');
        grad.addColorStop(0.6, '#ffaa00');
        grad.addColorStop(1, '#ff00aa');
        
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#ff00aa';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        ctx.fill();
        
        // Sun Grid Cuts
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        for (let i = 0; i < 6; i++) {
            const h = 4 + i * 2.5;
            const y = sunY + 15 + i * 16;
            ctx.fillRect(sunX - sunR, y, sunR * 2, h);
        }
        ctx.restore();


        // --- Grid ---
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)'; // Cyan grid
        ctx.lineWidth = 1;
        for(let x=0; x<this.fieldW; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.fieldH); ctx.stroke(); }
        for(let y=0; y<this.fieldH; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.fieldW,y); ctx.stroke(); }

        // --- Playfield Border ---
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, this.fieldW, this.fieldH);

        // --- Plastics / Caixonetes ---
        ctx.fillStyle = 'rgba(10, 5, 25, 0.7)'; // Dark acrylic for slingshots
        
        // Left slingshot plastic
        ctx.beginPath();
        ctx.moveTo(35, 400); ctx.lineTo(60, 400); ctx.lineTo(75, 480); ctx.lineTo(35, 490);
        ctx.fill();
        
        // Right slingshot plastic
        ctx.beginPath();
        ctx.moveTo(290, 400); ctx.lineTo(265, 400); ctx.lineTo(250, 480); ctx.lineTo(290, 490);
        ctx.fill();
        
        // Left outlane blocker plastic (fills the dead space)
        ctx.fillStyle = 'rgba(255, 0, 170, 0.15)'; // Pinkish tint
        ctx.beginPath();
        ctx.moveTo(10, 380); ctx.lineTo(35, 400); ctx.lineTo(35, 600); ctx.lineTo(10, 600);
        ctx.fill();

        // Right outlane path highlight
        ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
        ctx.fillRect(290, 400, 25, 200);

        // Walls (Double stroke for Neon Tube effect)
        ctx.lineCap = 'round';
        for (const w of this.walls) {
            ctx.shadowBlur = w.isBouncy ? 20 : 10;
            ctx.shadowColor = w.color;
            
            // Outer glow
            ctx.strokeStyle = w.color;
            ctx.lineWidth = w.isBouncy ? 6 : 4;
            ctx.beginPath();
            ctx.moveTo(w.p1.x, w.p1.y);
            ctx.lineTo(w.p2.x, w.p2.y);
            ctx.stroke();
            
            // Inner core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = w.isBouncy ? 2 : 1;
            ctx.shadowBlur = 0;
            ctx.stroke();
        }

        // Bumpers (Casino Chip / Gem style)
        for (const b of this.bumpers) {
            ctx.save();
            ctx.translate(b.x, b.y);
            
            ctx.shadowBlur = b.active > 0 ? 30 : 15;
            ctx.shadowColor = b.color;
            
            // Outer ring
            ctx.fillStyle = b.active > 0 ? '#fff' : '#111';
            ctx.beginPath();
            ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner glowing core
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(0, 0, b.radius * 0.65, 0, Math.PI * 2);
            ctx.fill();
            
            // Decorative tech lines
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(b.radius * 0.3, 0);
                ctx.lineTo(b.radius * 0.8, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Trail
        for (const t of this.trail) {
            if (t.alpha <= 0) continue;
            ctx.fillStyle = `rgba(0, 229, 255, ${t.alpha * 0.4})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.ballRadius * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1;

        // Flippers (Mechanical with Neon Core)
        for (const f of this.flippers) {
            ctx.save();
            ctx.translate(f.pivot.x, f.pivot.y);
            ctx.rotate(f.angle);
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = f.color;
            
            // Outer casing
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(f.length, 0);
            ctx.stroke();

            // Inner neon light
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(f.length - 4, 0);
            ctx.stroke();
            
            // Metallic pivot
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ddd';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        }

        // Launcher Plunger
        const plungerX = 332;
        const plungerW = 24;
        ctx.fillStyle = '#111';
        ctx.fillRect(plungerX - plungerW/2, 575, plungerW, 20);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle = '#00e5ff'; // Match cyan theme
        ctx.fillRect(plungerX - plungerW/2, this.plungerVisualY, plungerW, 6);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plungerX, this.plungerVisualY + 6);
        ctx.lineTo(plungerX, 600);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Ball (Energy Orb)
        ctx.save();
        ctx.translate(this.ballPos.x, this.ballPos.y);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00e5ff';
        
        const ballGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, this.ballRadius);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.4, '#00e5ff');
        ballGrad.addColorStop(1, '#0055aa');
        
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(0, 0, this.ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();

        // HUD - LED Matrix Style Logo
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        
        // "SUNSET"
        ctx.font = `bold italic ${r(mobile ? 24 : 32)}px 'Arial Black', sans-serif`;
        ctx.shadowColor = '#ff00aa';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('SUNSET', screenW / 2, oy - s(32));
        
        // "PARADISE"
        ctx.font = `bold italic ${r(mobile ? 18 : 24)}px 'Georgia', serif`;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('PARADISE', screenW / 2, oy - s(5));
        
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.font = `bold ${r(mobile ? 18 : 24)}px monospace`;
        ctx.fillText(`SCORE: ${this.score}`, screenW / 2, oy + this.fieldH * scale + s(30));
        
        ctx.font = `bold ${r(mobile ? 14 : 18)}px monospace`;
        ctx.fillText(`BALLS: ${this.ballsLeft}`, screenW / 2, oy + this.fieldH * scale + s(55));

        if (this.isBallSavedActive && Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.shadowColor = '#ffaa00';
            ctx.fillText(`BALL SAVED ACTIVE`, screenW / 2, oy + this.fieldH * scale + s(80));
        }
        
        ctx.shadowBlur = 0;

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }
    }
}
