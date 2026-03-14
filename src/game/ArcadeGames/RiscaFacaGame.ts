/**
 * Risca Faca — Nordestino Knife Duel.
 * Rhythm game: an oscillating marker moves back and forth.
 * Press at the right time (when marker is in the green zone) to strike.
 * Miss the timing and you get slashed. 3 lives. Score per win.
 */
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { getMotivationalPhrase, renderArcadeGameOver } from './ArcadeGameOver';
import { MINIGAME_THEMES } from '../Core/MinigameThemes';
import { SoundManager } from '../Core/SoundManager';
export class RiscaFacaGame {
    public lives = 3;
    public score = 0;
    public round = 0;
    public phase: 'ready' | 'timing' | 'result' | 'game_over' = 'ready';
    private gameOverPhrase: string = '';

    // Timing bar
    private markerPos = 0; // 0..1
    private markerSpeed = 1.5; // Speed of oscillation
    private markerDir = 1;
    private sweetSpotCenter = 0.5;
    private sweetSpotSize = 0.15; // Half-width of green zone

    private resultTimer = 0;
    private readyTimer = 0;
    private roundWon = false;
    private playerTiming = -1;

    // Enemy names
    private enemyNames = [
        'Zé do Facão', 'Lampião', 'Corisco',
        'Virgulino', 'Volta Seca', 'Cabeleira',
        'Antônio Silvino', 'Gato Bravo', 'Jararaca'
    ];
    private currentEnemy = '';

    // Visual
    private shakeTimer = 0;

    constructor() {
        this.startRound();
    }

    private startRound() {
        this.phase = 'ready';
        this.readyTimer = 1.5;
        this.markerPos = 0;
        this.markerDir = 1;
        this.roundWon = false;
        this.playerTiming = -1;
        this.currentEnemy = this.enemyNames[Math.floor(Math.random() * this.enemyNames.length)];

        // Harder each round
        this.markerSpeed = 1.5 + this.round * 0.15;
        this.sweetSpotSize = Math.max(0.06, 0.15 - this.round * 0.008);
        this.sweetSpotCenter = 0.3 + Math.random() * 0.4;
    }

    public update(dt: number) {
        if (this.phase === 'game_over') return;

        const input = InputManager.getInstance();
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);

        if (this.phase === 'ready') {
            this.readyTimer -= dt;
            if (this.readyTimer <= 0) {
                this.phase = 'timing';
            }
        } else if (this.phase === 'timing') {
            // Oscillate marker
            this.markerPos += this.markerSpeed * this.markerDir * dt;
            if (this.markerPos >= 1) { this.markerPos = 1; this.markerDir = -1; }
            if (this.markerPos <= 0) { this.markerPos = 0; this.markerDir = 1; }

            if (input.wasPressed('Space') || input.wasPressed('KeyE')) {
                this.playerTiming = this.markerPos;
                this.resolveRound();
                SoundManager.getInstance().play('arcade_hit');
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
        const dist = Math.abs(this.playerTiming - this.sweetSpotCenter);
        if (dist <= this.sweetSpotSize) {
            this.roundWon = true;
            const accuracy = 1 - (dist / this.sweetSpotSize);
            this.score += 20 + Math.floor(accuracy * 60);
        } else {
            this.roundWon = false;
            this.lives--;
            this.shakeTimer = 0.5;
            this.gameOverPhrase = getMotivationalPhrase();
            SoundManager.getInstance().play('lose');
        }
        this.phase = 'result';
        this.resultTimer = 2.0;
        if (this.roundWon) {
            SoundManager.getInstance().play('win_small');
        }
    }

    public reset() {
        this.lives = 3;
        this.score = 0;
        this.round = 0;
        this.shakeTimer = 0;
        this.gameOverPhrase = '';
        this.startRound();
    }

    public draw(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
        const theme = MINIGAME_THEMES.riscafaca;
        const s = UIScale.s.bind(UIScale);
        const r = UIScale.r.bind(UIScale);
        const cx = screenW / 2;
        const cy = screenH / 2;

        // Shake effect
        let shakeX = 0, shakeY = 0;
        if (this.shakeTimer > 0) {
            shakeX = (Math.random() - 0.5) * 10;
            shakeY = (Math.random() - 0.5) * 10;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Background — dry sertão
        const grad = ctx.createLinearGradient(0, 0, 0, screenH);
        grad.addColorStop(0, '#331a00');
        grad.addColorStop(0.3, '#553311');
        grad.addColorStop(0.6, '#664422');
        grad.addColorStop(1, '#221100');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, screenW, screenH);

        // Cactus silhouettes
        ctx.fillStyle = '#1a0a00';
        ctx.fillRect(s(50), cy + s(20), s(8), s(60));
        ctx.fillRect(s(42), cy + s(30), s(24), s(8));
        ctx.fillRect(screenW - s(80), cy + s(10), s(8), s(70));
        ctx.fillRect(screenW - s(90), cy + s(25), s(28), s(8));

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.accent;
        ctx.font = `${r(28)}px ${theme.titleFont}`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#000000';
        ctx.fillText(theme.name, cx, s(40));
        ctx.shadowBlur = 0;

        const mobile = isMobile();
        const playerX = cx - s(mobile ? 80 : 100);
        const aiX = cx + s(mobile ? 80 : 100);
        const bodyY = (screenH * 0.65) - s(20); // Feet on the horizon

        this.drawNordestino(ctx, playerX, bodyY, s, theme.accent, this.phase === 'result' && this.roundWon, 1);
        this.drawNordestino(ctx, aiX, bodyY, s, theme.accentAlt, this.phase === 'result' && !this.roundWon, -1);

        // Names
        ctx.fillStyle = theme.text;
        ctx.font = `bold ${r(16)}px ${theme.bodyFont}`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000000';
        ctx.fillText('VOCÊ', playerX, bodyY - s(90));
        ctx.fillText(this.currentEnemy, aiX, bodyY - s(90));
        ctx.shadowBlur = 0;

        // Timing Bar
        if (this.phase === 'timing' || this.phase === 'result') {
            const barW = s(350);
            const barH = s(30);
            const barX = cx - barW / 2;
            const barY = cy - s(130); // Raised up higher to stop overlapping characters

            // Background
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barW, barH);

            // Danger zones (red)
            ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
            ctx.fillRect(barX, barY, barW, barH);

            // Sweet spot (green)
            const ssLeft = barX + (this.sweetSpotCenter - this.sweetSpotSize) * barW;
            const ssWidth = this.sweetSpotSize * 2 * barW;
            ctx.fillStyle = 'rgba(50, 255, 50, 0.6)';
            ctx.fillRect(ssLeft, barY, ssWidth, barH);
            ctx.strokeStyle = '#44ff44';
            ctx.lineWidth = 2;
            ctx.strokeRect(ssLeft, barY, ssWidth, barH);

            // Marker
            const markerX = barX + this.markerPos * barW;
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffffff';
            ctx.fillRect(markerX - s(3), barY - s(5), s(6), barH + s(10));
            ctx.shadowBlur = 0;

            // Labels
            ctx.fillStyle = '#44ff44';
            ctx.font = `bold ${r(12)}px ${theme.bodyFont}`;
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#000000';
            ctx.fillText('ZONA CERTA', cx, barY - s(10));
            ctx.shadowBlur = 0;
        }

        // Phase messages
        if (this.phase === 'ready') {
            ctx.fillStyle = theme.accent;
            ctx.font = `${r(36)}px ${theme.titleFont}`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000000';
            ctx.fillText('PREPARE-SE...', cx, cy - s(100));
            ctx.shadowBlur = 0;
        } else if (this.phase === 'timing') {
            ctx.fillStyle = '#ff3b3b';
            ctx.font = `bold ${r(mobile ? 32 : 28)}px ${theme.titleFont}`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000000';
            const timingHint = isMobile() ? 'TOQUE NO OK!' : '[ESPAÇO] NA HORA CERTA!';
            ctx.fillText(timingHint, cx, cy - s(50));
            ctx.shadowBlur = 0;
        } else if (this.phase === 'result') {
            const msg = this.roundWon ? 'ACERTOU A FACADA!' : 'LEVOU UMA FACADA!';
            ctx.fillStyle = this.roundWon ? '#44ff88' : '#ff3b3b';
            ctx.font = `${r(36)}px ${theme.titleFont}`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#000000';
            ctx.fillText(msg, cx, cy - s(100));
            ctx.shadowBlur = 0;
        }

        // HUD
        ctx.fillStyle = '#ff3b3b';
        ctx.font = `${r(16)}px ${theme.titleFont}`;
        ctx.textAlign = 'left';
        ctx.fillText(`VIDAS:${'♥'.repeat(this.lives)}`, s(20), s(30));
        
        ctx.textAlign = 'right';
        ctx.fillStyle = theme.accent;
        ctx.fillText(`PONTOS:${this.score}`, screenW - s(20), s(30));
        
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.textMuted;
        ctx.font = `${r(12)}px ${theme.bodyFont}`;
        ctx.fillText(`ROUND ${this.round + 1}`, cx, s(70));

        ctx.restore();

        // Game Over
        if (this.phase === 'game_over') {
            renderArcadeGameOver(ctx, screenW, screenH, this.score, this.gameOverPhrase);
        }

        // Controls
        if (this.phase !== 'game_over' && !isMobile()) {
            ctx.fillStyle = theme.textMuted;
            ctx.font = `${r(11)}px ${theme.bodyFont}`;
            ctx.textAlign = 'center';
            ctx.fillText('[ESPAÇO] Atacar  |  [ESC] Sair', cx, screenH - s(15));
        }
    }

    private drawNordestino(ctx: CanvasRenderingContext2D, x: number, y: number, s: (v: number) => number, color: string, attacking: boolean, dir: 1 | -1) {
        ctx.save();
        ctx.translate(x, y);

        // Shadow on the ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, s(20), s(16), s(5), 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.scale(dir, 1);
        ctx.fillStyle = color;

        // Chapéu de cangaceiro (half-moon hat)
        ctx.beginPath();
        ctx.arc(0, -s(50), s(12), Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-s(14), -s(50), s(28), s(5));

        // Head
        ctx.beginPath();
        ctx.arc(0, -s(38), s(7), 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(-s(7), -s(30), s(14), s(28));

        // Legs
        ctx.fillRect(-s(6), -s(2), s(4), s(18));
        ctx.fillRect(s(2), -s(2), s(4), s(18));

        // Arm with knife (facão)
        if (attacking) {
            // Extended attack
            ctx.save();
            ctx.translate(s(5), -s(22));
            ctx.rotate(-0.2);
            
            // Arm
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, s(12), s(4));
            
            // Handle
            ctx.fillStyle = '#6b4423';
            ctx.fillRect(s(12), -s(1), s(6), s(6));
            
            // Blade
            ctx.fillStyle = '#dcdcdc';
            ctx.beginPath();
            ctx.moveTo(s(18), 0);
            ctx.lineTo(s(32), -s(2)); // curved back
            ctx.lineTo(s(36), s(2));  // pointy tip
            ctx.lineTo(s(32), s(4));  // sharp edge
            ctx.lineTo(s(18), s(4));  // base of blade
            ctx.fill();

            // Slash effect
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            // Since we scaled by dir, the arc also needs to work correctly.
            // Using standard arc drawn outward works fine because scale maps it.
            ctx.arc(0, 0, s(32), -0.6, 0.4);
            ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.restore();
        } else {
            // At rest (holding facão angled up)
            ctx.save();
            ctx.translate(s(5), -s(20));
            
            // Arm segment extending forward
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, s(8), s(4)); 
            
            // Rotate at the hand to point weapon up and forward
            ctx.translate(s(8), s(2));
            ctx.rotate(-1.0); 
            
            // Handle
            ctx.fillStyle = '#6b4423';
            ctx.fillRect(-s(3), -s(3), s(6), s(6));
            
            // Blade
            ctx.fillStyle = '#dcdcdc';
            ctx.beginPath();
            ctx.moveTo(s(3), -s(2));
            ctx.lineTo(s(16), -s(4)); // back of blade
            ctx.lineTo(s(22), 0);     // tip
            ctx.lineTo(s(16), s(2));  // sharp edge
            ctx.lineTo(s(3), s(2));   // base
            ctx.fill();
            
            ctx.restore();
        }

        ctx.restore();
    }
}
