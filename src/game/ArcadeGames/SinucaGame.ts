/**
 * Sinuca Mata Mata — Pool game with authentic rules.
 * 4 balls each (red vs blue). Pocket opponent's balls to win.
 * Layout: 6 pockets (4 corners + 2 middle), cue ball at center.
 * Red balls: 2 clustered left + 1 near each mid-pocket (left side).
 * Blue balls: 2 clustered right + 1 near each mid-pocket (right side).
 *
 * Turn rules:
 * - Pocket opponent's ball → play again
 * - Miss → switch turns
 * - Cue ball pocketed → foul: opponent gets 2 turns
 *   (unless opponent pockets a ball on the 1st turn, cancelling the bonus)
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { SoundManager } from '../Core/SoundManager';

interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    color: string;
    sunk: boolean;
    team: 'player' | 'ai' | 'cue';
}

interface Pocket {
    x: number;
    y: number;
    r: number;
}

export class SinucaGame {
    // Table
    private tableW = 500;
    private tableH = 280;
    private friction = 0.997;

    // Balls
    private balls: Ball[] = [];
    private pockets: Pocket[] = [];
    private cueBall!: Ball;

    // Turns
    public playerTurn = true;
    public playerBallsSunk = 0;
    public aiBallsSunk = 0;
    public phase: 'aiming' | 'moving' | 'ai_thinking' | 'ai_shooting' | 'turn_transition' | 'game_over' = 'aiming';
    public score = 0;
    private gameOverPhrase = '';

    // Foul system
    private bonusTurns = 0;      // Extra guaranteed turns from opponent's foul
    private cueBallSunk = false;
    private pocketedThisShot: Ball[] = []; // Track what was pocketed this shot

    // Slingshot aiming
    private aimAngle = 0;
    private aimPower = 0;
    private maxPower = 450;
    private holdingShot = false;
    private aimHoldTimer = 0;

    // AI
    private aiTimer = 0;
    private aiTargetAngle = 0;
    private aiTargetPower = 0;

    // Turn transition
    private transitionTimer = 0;
    private transitionMessage = '';

    constructor() {
        this.setupGame();
    }

    private setupGame() {
        this.balls = [];
        const R = 8;
        const tw = this.tableW;
        const th = this.tableH;
        const cx = tw / 2;
        const cy = th / 2;

        // Cue ball — center
        this.cueBall = { x: cx, y: cy, vx: 0, vy: 0, r: R, color: '#ffffff', sunk: false, team: 'cue' };
        this.balls.push(this.cueBall);

        // Red balls (player) — left side
        // 2 clustered on left edge
        this.balls.push({ x: 50, y: cy - 20, vx: 0, vy: 0, r: R, color: '#ff3333', sunk: false, team: 'player' });
        this.balls.push({ x: 50, y: cy + 20, vx: 0, vy: 0, r: R, color: '#ff5555', sunk: false, team: 'player' });
        // 1 near top-middle pocket (left of it)
        this.balls.push({ x: cx - 55, y: 22, vx: 0, vy: 0, r: R, color: '#ff4444', sunk: false, team: 'player' });
        // 1 near bottom-middle pocket (left of it)
        this.balls.push({ x: cx - 55, y: th - 22, vx: 0, vy: 0, r: R, color: '#ff6666', sunk: false, team: 'player' });

        // Blue balls (AI) — right side
        // 2 clustered on right edge
        this.balls.push({ x: tw - 50, y: cy - 20, vx: 0, vy: 0, r: R, color: '#3333ff', sunk: false, team: 'ai' });
        this.balls.push({ x: tw - 50, y: cy + 20, vx: 0, vy: 0, r: R, color: '#5555ff', sunk: false, team: 'ai' });
        // 1 near top-middle pocket (right of it)
        this.balls.push({ x: cx + 55, y: 22, vx: 0, vy: 0, r: R, color: '#4444ff', sunk: false, team: 'ai' });
        // 1 near bottom-middle pocket (right of it)
        this.balls.push({ x: cx + 55, y: th - 22, vx: 0, vy: 0, r: R, color: '#6666ff', sunk: false, team: 'ai' });

        // 6 Pockets: 4 corners + 2 middle
        const pR = 14;
        const m = 6;
        this.pockets = [
            { x: m, y: m, r: pR },     // top-left
            { x: cx, y: m - 2, r: pR },     // top-center
            { x: tw - m, y: m, r: pR },     // top-right
            { x: m, y: th - m, r: pR },     // bottom-left
            { x: cx, y: th - m + 2, r: pR },   // bottom-center
            { x: tw - m, y: th - m, r: pR },     // bottom-right
        ];

        // Random first player
        this.playerTurn = Math.random() > 0.5;
        this.phase = this.playerTurn ? 'aiming' : 'ai_thinking';
        this.playerBallsSunk = 0;
        this.aiBallsSunk = 0;
        this.cueBallSunk = false;
        this.bonusTurns = 0;
        this.pocketedThisShot = [];
        this.aimAngle = this.playerTurn ? 0 : Math.PI;
        this.aimPower = 0;
        this.holdingShot = false;
        this.aimHoldTimer = 0;
        this.score = 0;
        this.gameOverPhrase = '';
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();

        if (this.phase === 'turn_transition') {
            this.transitionTimer -= dt;
            if (this.transitionTimer <= 0) {
                this.phase = this.playerTurn ? 'aiming' : 'ai_thinking';
            }
            return;
        }

        if (this.phase === 'aiming') {
            const jv = input.getJoystickVector();
            let isAiming = false;
            
            if (jv.x !== 0 || input.isDown('ArrowLeft') || input.isDown('ArrowRight')) {
                isAiming = true;
            }

            if (isAiming) {
                this.aimHoldTimer += dt;
            } else {
                this.aimHoldTimer = 0;
            }

            // Sensibilidade leve inicial (0.4) para ajuste fino, sobe até 2.5 se segurar
            let aimSpeed = 0.4;
            if (this.aimHoldTimer > 0.4) {
                aimSpeed = Math.min(2.5, 0.4 + (this.aimHoldTimer - 0.4) * 4);
            }

            if (jv.x !== 0) {
                this.aimAngle += jv.x * aimSpeed * dt;
            } else {
                if (input.isDown('ArrowLeft')) this.aimAngle -= aimSpeed * dt;
                if (input.isDown('ArrowRight')) this.aimAngle += aimSpeed * dt;
            }

            if (input.isDown('Space')) {
                this.holdingShot = true;
                this.aimPower = Math.min(this.maxPower, this.aimPower + 300 * dt);
            } else if (this.holdingShot) {
                this.holdingShot = false;
                if (this.aimPower > 10) {
                    this.shoot(this.aimAngle, this.aimPower);
                }
                this.aimPower = 0;
            }
        } else if (this.phase === 'ai_thinking') {
            this.aiTimer += dt;
            if (this.aiTimer > 1.2) {
                this.aiTimer = 0;
                this.planAiShot();
                this.phase = 'ai_shooting';
            }
        } else if (this.phase === 'ai_shooting') {
            this.aiTimer += dt;
            if (this.aiTimer > 0.5) {
                this.shoot(this.aiTargetAngle, this.aiTargetPower);
                this.aiTimer = 0;
            }
        } else if (this.phase === 'moving') {
            this.physicsTick(dt);

            // Check if all balls stopped
            const allStopped = this.balls.every(b => b.sunk || (Math.abs(b.vx) < 2 && Math.abs(b.vy) < 2));
            if (allStopped) {
                for (const b of this.balls) { b.vx = 0; b.vy = 0; }
                this.resolveShot();
            }
        }
    }

    private shoot(angle: number, power: number) {
        this.cueBall.vx = Math.cos(angle) * power;
        this.cueBall.vy = Math.sin(angle) * power;
        this.phase = 'moving';
        this.pocketedThisShot = [];
        this.cueBallSunk = false;
        SoundManager.getInstance().play('arcade_bounce');
    }

    private resolveShot() {
        const opponentTeam = this.playerTurn ? 'ai' : 'player';

        // Count what was pocketed this shot
        const pocketedOpponent = this.pocketedThisShot.filter(b => b.team === opponentTeam).length;
        const pocketedOwn = this.pocketedThisShot.filter(b => b.team !== 'cue' && b.team !== opponentTeam).length;

        // Handle cue ball sunk (foul)
        if (this.cueBallSunk) {
            this.cueBall.sunk = false;
            this.cueBall.x = this.tableW / 2;
            this.cueBall.y = this.tableH / 2;
            this.cueBall.vx = 0;
            this.cueBall.vy = 0;
            this.cueBallSunk = false;

            // Make sure cue ball doesn't overlap with other balls
            this.nudgeCueBallClear();

            // Foul: switch turns, opponent gets 2 turns (1 normal + 1 bonus)
            this.playerTurn = !this.playerTurn;
            this.bonusTurns = 1;
            this.showTransition(this.playerTurn ? 'FOUL! Sua vez (2 jogadas)' : 'FOUL! Vez da IA (2 jogadas)');

            // Check win conditions after pocketing
            if (this.checkWin()) return;
            return;
        }

        // Check win conditions
        if (this.checkWin()) return;

        // Determine next turn
        if (pocketedOpponent > 0) {
            // Pocketed opponent ball(s) → play again, cancel any bonus
            this.bonusTurns = 0;
            if (this.playerTurn) {
                this.score += pocketedOpponent * 100;
            }
            this.showTransition(this.playerTurn ? 'Encaçapou! Joga de novo!' : 'IA encaçapou! Joga de novo!');
        } else if (pocketedOwn > 0 && pocketedOpponent === 0) {
            // Pocketed own ball but NOT opponent → lose turn
            this.playerTurn = !this.playerTurn;
            this.bonusTurns = 0;
            this.showTransition(this.playerTurn ? 'Sua vez!' : 'Vez da IA!');
        } else {
            // Didn't pocket anything
            if (this.bonusTurns > 0) {
                // Use a bonus turn — stay on same player
                this.bonusTurns--;
                this.showTransition(this.playerTurn ? 'Jogada bônus!' : 'IA: jogada bônus!');
            } else {
                // Normal miss → switch turns
                this.playerTurn = !this.playerTurn;
                this.showTransition(this.playerTurn ? 'Sua vez!' : 'Vez da IA!');
            }
        }
    }

    private showTransition(msg: string) {
        this.transitionMessage = msg;
        this.transitionTimer = 1.2;
        this.phase = 'turn_transition';
    }

    private nudgeCueBallClear() {
        // Push cue ball away from overlapping balls
        for (let attempt = 0; attempt < 20; attempt++) {
            let overlapping = false;
            for (const b of this.balls) {
                if (b === this.cueBall || b.sunk) continue;
                const dx = this.cueBall.x - b.x;
                const dy = this.cueBall.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.cueBall.r + b.r + 2) {
                    overlapping = true;
                    this.cueBall.y += 20;
                    if (this.cueBall.y > this.tableH - this.cueBall.r) {
                        this.cueBall.y = this.cueBall.r + 20;
                    }
                    break;
                }
            }
            if (!overlapping) break;
        }
    }

    private checkWin(): boolean {
        const playerAlive = this.balls.filter(b => b.team === 'player' && !b.sunk).length;
        const aiAlive = this.balls.filter(b => b.team === 'ai' && !b.sunk).length;

        this.playerBallsSunk = 4 - playerAlive;
        this.aiBallsSunk = 4 - aiAlive;

        if (aiAlive === 0) {
            // All AI balls pocketed → player wins!
            this.score += 500;
            this.phase = 'game_over';
            this.gameOverPhrase = 'Campeão da mesa! Mandou muito bem!';
            SoundManager.getInstance().play('win_small');
            return true;
        }
        if (playerAlive === 0) {
            // All player balls pocketed → AI wins
            this.phase = 'game_over';
            this.gameOverPhrase = getMotivationalPhrase();
            SoundManager.getInstance().play('lose');
            return true;
        }
        return false;
    }

    private physicsTick(dt: number) {
        const subSteps = 4;
        const subDt = dt / subSteps;

        for (let step = 0; step < subSteps; step++) {
            for (const b of this.balls) {
                if (b.sunk) continue;

                b.x += b.vx * subDt;
                b.y += b.vy * subDt;
                b.vx *= this.friction;
                b.vy *= this.friction;

                // Wall bounce
                if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.9; SoundManager.getInstance().play('arcade_bounce', { volume: 0.3 }); }
                if (b.x + b.r > this.tableW) { b.x = this.tableW - b.r; b.vx = -Math.abs(b.vx) * 0.9; SoundManager.getInstance().play('arcade_bounce', { volume: 0.3 }); }
                if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.9; SoundManager.getInstance().play('arcade_bounce', { volume: 0.3 }); }
                if (b.y + b.r > this.tableH) { b.y = this.tableH - b.r; b.vy = -Math.abs(b.vy) * 0.9; SoundManager.getInstance().play('arcade_bounce', { volume: 0.3 }); }
            }

            // Ball-ball collisions
            for (let i = 0; i < this.balls.length; i++) {
                const a = this.balls[i];
                if (a.sunk) continue;
                for (let j = i + 1; j < this.balls.length; j++) {
                    const b = this.balls[j];
                    if (b.sunk) continue;

                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = a.r + b.r;

                    if (dist < minDist && dist > 0) {
                        const overlap = (minDist - dist) / 2;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        a.x -= nx * overlap;
                        a.y -= ny * overlap;
                        b.x += nx * overlap;
                        b.y += ny * overlap;

                        const dvx = a.vx - b.vx;
                        const dvy = a.vy - b.vy;
                        const dot = dvx * nx + dvy * ny;

                        if (dot > 0) {
                            a.vx -= dot * nx;
                            a.vy -= dot * ny;
                            b.vx += dot * nx;
                            b.vy += dot * ny;
                            SoundManager.getInstance().play('arcade_bounce', { volume: 0.4 });
                        }
                    }
                }
            }

            // Pocket check
            for (const b of this.balls) {
                if (b.sunk) continue;
                for (const p of this.pockets) {
                    const dx = b.x - p.x;
                    const dy = b.y - p.y;
                    if (dx * dx + dy * dy < (p.r * 0.8) * (p.r * 0.8)) {
                        b.sunk = true;
                        b.vx = 0;
                        b.vy = 0;

                        if (b.team === 'cue') {
                            this.cueBallSunk = true;
                        } else {
                            this.pocketedThisShot.push(b);
                        }
                        SoundManager.getInstance().play('arcade_hit');
                    }
                }
            }
        }
    }

    private planAiShot() {
        // AI targets opponent (player) balls
        let bestTarget: Ball | null = null;
        let bestDist = Infinity;

        for (const b of this.balls) {
            if (b.sunk || b.team !== 'player') continue;
            const dx = b.x - this.cueBall.x;
            const dy = b.y - this.cueBall.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestTarget = b;
            }
        }

        if (bestTarget) {
            // Find nearest pocket to target ball
            let bestPocket = this.pockets[0];
            let bestPocketDist = Infinity;
            for (const p of this.pockets) {
                const dx = p.x - bestTarget.x;
                const dy = p.y - bestTarget.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestPocketDist) {
                    bestPocketDist = dist;
                    bestPocket = p;
                }
            }

            // Aim through target toward pocket
            const tpx = bestPocket.x - bestTarget.x;
            const tpy = bestPocket.y - bestTarget.y;
            const tpDist = Math.sqrt(tpx * tpx + tpy * tpy) || 1;

            const aimX = bestTarget.x - (tpx / tpDist) * bestTarget.r * 2;
            const aimY = bestTarget.y - (tpy / tpDist) * bestTarget.r * 2;

            this.aiTargetAngle = Math.atan2(aimY - this.cueBall.y, aimX - this.cueBall.x);
            this.aiTargetPower = Math.min(this.maxPower * 0.75, bestDist * 1.5 + 80);

            // Inaccuracy
            this.aiTargetAngle += (Math.random() - 0.5) * 0.18;
        } else {
            this.aiTargetAngle = Math.random() * Math.PI * 2;
            this.aiTargetPower = this.maxPower * 0.4;
        }
    }

    public reset() {
        this.score = 0;
        this.setupGame();
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, screenW, screenH);

        const mobile = isMobile();
        const scaleX = (screenW * (mobile ? 0.95 : 0.85)) / this.tableW;
        const scaleY = (screenH * (mobile ? 0.75 : 0.6)) / this.tableH;
        const scale = Math.min(scaleX, scaleY);
        const ox = (screenW - this.tableW * scale) / 2;
        const oy = (screenH - this.tableH * scale) / 2 + (mobile ? s(15) : s(25));

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);

        // Table border (wood)
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-12, -12, this.tableW + 24, this.tableH + 24);

        // Inner rail
        ctx.fillStyle = '#4a2a0a';
        ctx.fillRect(-6, -6, this.tableW + 12, this.tableH + 12);

        // Table felt
        ctx.fillStyle = '#1a6a2a';
        ctx.fillRect(0, 0, this.tableW, this.tableH);

        // Felt texture lines
        ctx.fillStyle = 'rgba(0, 50, 0, 0.2)';
        for (let i = 0; i < this.tableW; i += 18) {
            ctx.fillRect(i, 0, 1, this.tableH);
        }

        // Center dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(this.tableW / 2, this.tableH / 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Pockets
        for (const p of this.pockets) {
            // Pocket hole
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            // Pocket rim
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Balls
        for (const b of this.balls) {
            if (b.sunk) continue;

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(b.x + 2, b.y + 2, b.r, 0, Math.PI * 2);
            ctx.fill();

            // Ball body
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
            ctx.fill();

            // Edge ring
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Aiming line
        if (this.phase === 'aiming' && !this.cueBall.sunk) {
            const lineLen = 60 + this.aimPower * 0.3;
            const endX = this.cueBall.x + Math.cos(this.aimAngle) * lineLen;
            const endY = this.cueBall.y + Math.sin(this.aimAngle) * lineLen;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(this.cueBall.x, this.cueBall.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot at end of aim
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(endX, endY, 3, 0, Math.PI * 2);
            ctx.fill();

            // Power bar
            if (this.holdingShot) {
                const pct = this.aimPower / this.maxPower;
                const barW = 30;
                const barH = 4;
                const bx = this.cueBall.x - barW / 2;
                const by = this.cueBall.y - this.cueBall.r - 12;
                ctx.fillStyle = pct > 0.7 ? '#ff4444' : (pct > 0.4 ? '#ffaa00' : '#44ff44');
                ctx.fillRect(bx, by, barW * pct, barH);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(bx, by, barW, barH);
            }
        }

        // AI thinking indicator
        if (this.phase === 'ai_thinking' || this.phase === 'ai_shooting') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            const dots = '.'.repeat(1 + Math.floor((Date.now() / 400) % 3));
            ctx.fillText('IA pensando' + dots, this.tableW / 2, this.tableH / 2 + 4);
        }

        ctx.restore();

        // --- HUD ---
        const hudY = mobile ? Math.max(s(20), oy - s(10)) : oy - s(12);
        const titleY = mobile ? hudY - s(20) : oy - s(35);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc00';
        ctx.font = `bold ${r(mobile ? 18 : 22)}px monospace`;
        ctx.fillText('SINUCA MATA MATA', cx, titleY);

        // Turn indicator
        ctx.fillStyle = this.playerTurn ? '#44ff44' : '#4444ff';
        ctx.font = `bold ${r(mobile ? 12 : 14)}px monospace`;
        const turnText = this.phase === 'turn_transition'
            ? this.transitionMessage
            : (this.playerTurn ? 'SUA VEZ' : 'VEZ DA IA');
        ctx.fillText(turnText, cx, hudY);

        // Bonus turn indicator
        if (this.bonusTurns > 0) {
            ctx.fillStyle = '#ff8800';
            ctx.font = `${r(11)}px monospace`;
            ctx.fillText(`+${this.bonusTurns} jogada(s) bônus`, cx, oy - s(1));
        }

        // Ball counts
        const playerAlive = 4 - this.playerBallsSunk;
        const aiAlive = 4 - this.aiBallsSunk;
        const ballY = oy + this.tableH * scale + s(mobile ? 18 : 22);

        ctx.font = `${mobile ? r(11) : r(13)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`Suas: ${'●'.repeat(playerAlive)}${'○'.repeat(4 - playerAlive)}`, ox + s(5), ballY);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#4444ff';
        ctx.fillText(`IA: ${'●'.repeat(aiAlive)}${'○'.repeat(4 - aiAlive)}`, ox + this.tableW * scale - s(5), ballY);

        // Score
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc00';
        ctx.font = `${mobile ? r(10) : r(12)}px monospace`;
        ctx.fillText(`PONTOS: ${this.score}`, cx, ballY + s(mobile ? 14 : 18));

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Controls
        if (this.phase === 'aiming' && !isMobile()) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#555';
            ctx.font = `${r(11)}px monospace`;
            ctx.fillText('[←→] Mirar  |  Segure [ESPAÇO] + solte p/ tacar  |  [ESC] Sair', cx, screenH - s(15));
        }
    }
}
