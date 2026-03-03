/**
 * Faroeste — Western Quick-Draw Duel.
 * Rhythm game: wait for the signal, press at the right moment.
 * Whoever draws faster wins. 3 lives. Score per win.
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';

export class FaroesteGame {
    public lives = 3;
    public score = 0;
    public round = 0;
    public phase: 'waiting' | 'ready' | 'draw' | 'result' | 'game_over' = 'waiting';
    private gameOverPhrase: string = '';

    private waitTimer = 0;
    private drawWindow = 0;
    private drawTimer = 0;
    private maxDrawTime = 1.0;
    private resultTimer = 0;
    private playerDrew = false;
    private playerDrawTime = -1;
    private aiDrawTime = -1;
    private roundWon = false;

    // Visual
    private sunAngle = 0;
    private tumbleweedX = -50;

    // Enemy names
    private enemyNames = [
        'Billy the Kid', 'Jesse James', 'Doc Holliday',
        'Wyatt Earp', 'Butch Cassidy', 'Sundance Kid',
        'Calamity Jane', 'Pat Garrett', 'Black Bart'
    ];
    private currentEnemy = '';

    constructor() {
        this.startRound();
    }

    private startRound() {
        this.phase = 'waiting';
        this.waitTimer = 2.0 + Math.random() * 3.0; // Random wait
        this.playerDrew = false;
        this.playerDrawTime = -1;
        this.roundWon = false;
        this.currentEnemy = this.enemyNames[Math.floor(Math.random() * this.enemyNames.length)];
        // AI gets harder each round
        this.maxDrawTime = Math.max(0.25, 1.0 - this.round * 0.05);
        this.aiDrawTime = 0.15 + Math.random() * this.maxDrawTime;
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();
        this.sunAngle += dt * 0.2;
        this.tumbleweedX += dt * 40;
        if (this.tumbleweedX > 700) this.tumbleweedX = -50;

        if (this.phase === 'waiting') {
            this.waitTimer -= dt;
            // If player presses too early, they lose a life
            if (input.wasPressed('Space') || input.wasPressed('KeyE')) {
                this.roundWon = false;
                this.lives--;
                this.phase = 'result';
                this.resultTimer = 2.0;
                this.gameOverPhrase = getMotivationalPhrase();
                return;
            }
            if (this.waitTimer <= 0) {
                this.phase = 'draw';
                this.drawTimer = 0;
                this.drawWindow = 0;
            }
        } else if (this.phase === 'draw') {
            this.drawTimer += dt;
            this.drawWindow += dt;

            if (!this.playerDrew && (input.wasPressed('Space') || input.wasPressed('KeyE'))) {
                this.playerDrew = true;
                this.playerDrawTime = this.drawTimer;
            }

            // Check if draw window expired
            if (this.drawTimer > 2.0) {
                // Player didn't draw in time
                if (!this.playerDrew) {
                    this.playerDrawTime = 999;
                }
                this.resolveRound();
            } else if (this.playerDrew) {
                // Both drew — resolve
                this.resolveRound();
            }
        } else if (this.phase === 'result') {
            this.resultTimer -= dt;
            if (this.resultTimer <= 0) {
                if (this.lives <= 0) {
                    this.phase = 'game_over';
                    this.gameOverPhrase = getMotivationalPhrase();
                } else {
                    this.round++;
                    this.startRound();
                }
            }
        }
    }

    private resolveRound() {
        if (this.playerDrawTime <= this.aiDrawTime) {
            this.roundWon = true;
            this.score += 200 + Math.floor(Math.max(0, (1 - this.playerDrawTime) * 300));
        } else {
            this.roundWon = false;
            this.lives--;
            this.gameOverPhrase = getMotivationalPhrase();
        }
        this.phase = 'result';
        this.resultTimer = 2.5;
    }

    public reset() {
        this.lives = 3;
        this.score = 0;
        this.round = 0;
        this.phase = 'waiting';
        this.gameOverPhrase = '';
        this.tumbleweedX = -50;
        this.startRound();
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;
        const cy = screenH / 2;

        // Desert sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, screenH);
        grad.addColorStop(0, '#ff6633');
        grad.addColorStop(0.4, '#ffaa44');
        grad.addColorStop(0.7, '#cc8833');
        grad.addColorStop(1, '#442211');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, screenW, screenH);

        // Sun
        ctx.fillStyle = '#ffdd44';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.arc(screenW * 0.8, screenH * 0.2, s(30), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Ground
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(0, screenH * 0.65, screenW, screenH * 0.35);

        // Tumbleweed
        ctx.strokeStyle = '#aa8833';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.tumbleweedX, screenH * 0.63, s(8), 0, Math.PI * 2);
        ctx.stroke();

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(28)}px serif`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000';
        ctx.fillText('FAROESTE', cx, s(40));
        ctx.shadowBlur = 0;

        // Duelists
        const playerX = cx - s(120);
        const aiX = cx + s(120);
        const bodyY = cy + s(40);

        // Player silhouette (left)
        this.drawCowboy(ctx, playerX, bodyY, s, '#44aa44', this.phase === 'result' && this.roundWon);

        // AI silhouette (right)
        this.drawCowboy(ctx, aiX, bodyY, s, '#aa4444', this.phase === 'result' && !this.roundWon);

        // Enemy name
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r(16)}px serif`;
        ctx.fillText(this.currentEnemy, aiX, bodyY - s(70));

        ctx.fillText('VOCÊ', playerX, bodyY - s(70));

        // Phase-specific UI
        ctx.textAlign = 'center';

        if (this.phase === 'waiting') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = `bold ${r(30)}px serif`;
            ctx.fillText('ESPERE...', cx, cy - s(60));
            ctx.fillStyle = '#aaa';
            ctx.font = `${r(14)}px monospace`;
            ctx.fillText('NÃO aperte antes da hora!', cx, cy - s(30));
        } else if (this.phase === 'draw') {
            ctx.fillStyle = '#ff0000';
            ctx.font = `bold ${r(50)}px serif`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
            ctx.fillText('SAQUE!', cx, cy - s(50));
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${r(16)}px monospace`;
            ctx.fillText('[ESPAÇO] AGORA!', cx, cy - s(15));
        } else if (this.phase === 'result') {
            const msg = this.roundWon ? 'ACERTOU!' : (this.playerDrawTime < 0 ? 'SACOU CEDO DEMAIS!' : 'LEVOU TIRO!');
            ctx.fillStyle = this.roundWon ? '#44ff44' : '#ff4444';
            ctx.font = `bold ${r(36)}px serif`;
            ctx.fillText(msg, cx, cy - s(60));

            if (this.playerDrawTime > 0 && this.playerDrawTime < 100) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = `${r(16)}px monospace`;
                ctx.fillText(`Seu tempo: ${this.playerDrawTime.toFixed(3)}s | Inimigo: ${this.aiDrawTime.toFixed(3)}s`, cx, cy - s(25));
            }
        }

        // HUD
        ctx.fillStyle = '#ff4444';
        ctx.font = `${r(16)}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`VIDAS: ${'♥'.repeat(this.lives)}`, s(20), s(25));
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(`PONTOS: ${this.score}`, screenW - s(20), s(25));
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.font = `${r(12)}px monospace`;
        ctx.fillText(`ROUND ${this.round + 1}`, cx, s(25));

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Controls
        if (this.phase !== 'game_over') {
            ctx.fillStyle = '#555';
            ctx.font = `${r(11)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('[ESPAÇO] Sacar  |  [ESC] Sair', cx, screenH - s(15));
        }
    }

    private drawCowboy(ctx: CanvasRenderingContext2D, x: number, y: number, s: (v: number) => number, color: string, shooting: boolean) {
        ctx.save();
        ctx.fillStyle = color;

        // Hat
        ctx.fillRect(x - s(15), y - s(55), s(30), s(8));
        ctx.fillRect(x - s(10), y - s(63), s(20), s(10));

        // Head
        ctx.beginPath();
        ctx.arc(x, y - s(40), s(8), 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(x - s(8), y - s(30), s(16), s(30));

        // Legs
        ctx.fillRect(x - s(7), y, s(5), s(20));
        ctx.fillRect(x + s(2), y, s(5), s(20));

        // Arm/Gun
        if (shooting) {
            // Arm extended with gun
            ctx.fillStyle = '#333';
            ctx.fillRect(x + s(8), y - s(25), s(20), s(4));
            // Gun flash
            ctx.fillStyle = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            ctx.beginPath();
            ctx.arc(x + s(30), y - s(23), s(5), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Arm at side
            ctx.fillStyle = color;
            ctx.fillRect(x + s(8), y - s(25), s(4), s(18));
        }

        ctx.restore();
    }
}
