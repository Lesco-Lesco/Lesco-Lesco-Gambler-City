/**
 * ScoreBreakdownScene — Shows the player's final score breakdown after END GAME.
 *
 * Flow:
 *   GameOverScene → ScoreBreakdownScene → InitialsInputScene (if top 100)
 *                                       → RankingScene        (if not top 100)
 *
 * Callback:
 *   onContinue(enteredRanking: boolean)
 */

import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { AchievementManager } from '../Core/AchievementManager';
import { ScoreCalculator } from '../Core/ScoreCalculator';
import type { ScoreBreakdown } from '../Core/ScoreCalculator';
import { RankingAPI } from '../Services/RankingAPI';

// Bar colour per pillar
const PILLAR_COLORS = {
    fortuna:    '#ffd700',   // gold
    maestria:   '#00ddff',   // cyan
    progressao: '#44ff88',   // green
    ousadia:    '#ff4422',   // red-orange
};

export class ScoreBreakdownScene implements Scene {
    public name = 'score_breakdown';

    private screenW = 0;
    private screenH = 0;
    private time    = 0;

    /** 0 → 1 — drives bar animation (2 seconds) */
    private animProgress  = 0;
    private canContinue   = false;
    /** Seconds to ignore input after entering scene (prevents Space carry-over from GameOverScene) */
    private inputLockout  = 0.8;
    /** True once checkPosition() has resolved (success or failure) */
    private positionResolved = false;

    private breakdown: ScoreBreakdown | null = null;
    private rankingPosition: number | null   = null;

    private input = InputManager.getInstance();

    /** Called when player presses Continue.  true = entered top 100. */
    public onContinue?: (enteredRanking: boolean) => void;

    // ─────────────────────────────────────────────────
    // Public getters (used by GameCanvas to pass data to next scene)
    // ─────────────────────────────────────────────────

    public getBreakdown(): ScoreBreakdown | null { return this.breakdown; }
    public getRankingPosition(): number | null   { return this.rankingPosition; }

    // ─────────────────────────────────────────────────
    // Scene lifecycle
    // ─────────────────────────────────────────────────

    public onEnter(): void {
        this.time             = 0;
        this.animProgress     = 0;
        this.canContinue      = false;
        this.inputLockout     = 0.8;   // ignore input for 0.8s — prevents Space carry-over
        this.positionResolved = false;
        this.breakdown        = null;
        this.rankingPosition  = null;

        // Fire-and-forget: sync any pending offline scores from previous sessions
        RankingAPI.getInstance().syncPending().catch(() => {});

        // Compute this session's score
        const am    = AchievementManager.getInstance();
        const stats = am.getStats();
        const count = am.getUnlockedCount();
        this.breakdown = ScoreCalculator.calculate(stats, count);

        // Check where this score lands in the global ranking.
        // We WAIT for this to resolve before allowing the player to continue,
        // so we never skip InitialsInput due to a race condition.
        RankingAPI.getInstance()
            .checkPosition(this.breakdown.total)
            .then(pos => {
                this.rankingPosition  = pos;
                this.positionResolved = true;
            })
            .catch(() => {
                // On hard failure, assume they made it (show initials, let submit decide)
                this.rankingPosition  = 1;
                this.positionResolved = true;
            });
    }

    public onExit(): void {}

    public resize(w: number, h: number): void {
        this.screenW = w;
        this.screenH = h;
    }

    public update(dt: number): void {
        this.time += dt;

        // Drain input lockout (ignores any key carry-over from previous scene)
        if (this.inputLockout > 0) {
            this.inputLockout -= dt;
            // Consume any presses during lockout so they don't fire later
            this.input.wasPressed('Space');
            this.input.wasPressed('Enter');
            this.input.wasPressed('MouseLeft');
            return;
        }

        // Animate bars over 2 seconds
        if (this.animProgress < 1) {
            this.animProgress = Math.min(this.animProgress + dt / 2, 1);
        }

        // Allow continue only after animation AND position check are both done
        if (this.animProgress >= 1 && this.positionResolved && !this.canContinue) {
            this.canContinue = true;
        }

        if (this.canContinue) {
            const pressed =
                this.input.wasPressed('Space') ||
                this.input.wasPressed('Enter') ||
                this.input.wasPressed('MouseLeft');

            if (pressed && this.onContinue && this.breakdown) {
                this.onContinue(this.rankingPosition !== null);
            }
        }
    }

    public render(ctx: CanvasRenderingContext2D): void {
        const s  = (v: number) => UIScale.s(v);
        const r  = (v: number) => UIScale.r(v);
        const cx = this.screenW / 2;
        const cy = this.screenH / 2;
        const mobile = isMobile();

        ctx.save();
        ctx.textBaseline = 'alphabetic';

        // ── Background ──────────────────────────────────────────────────────
        ctx.fillStyle = '#050208';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Subtle glitch scanlines
        for (let i = 0; i < 30; i++) {
            const gx = Math.random() * this.screenW;
            const gy = Math.random() * this.screenH;
            ctx.fillStyle = `rgba(255,0,0,${Math.random() * 0.04})`;
            ctx.fillRect(gx, gy, Math.random() * s(80), 1);
        }

        // ── Title ───────────────────────────────────────────────────────────
        ctx.save();
        ctx.shadowBlur  = s(20);
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle   = '#ffffff';
        ctx.font        = `bold ${r(mobile ? 22 : 18)}px "Press Start 2P", monospace`;
        ctx.textAlign   = 'center';
        ctx.fillText('SEUS RESULTADOS', cx, cy - s(mobile ? 220 : 190));
        ctx.restore();

        if (!this.breakdown) {
            ctx.restore();
            return;
        }
        const bd = this.breakdown;

        // ── Bar layout ──────────────────────────────────────────────────────
        const barW      = s(mobile ? 360 : 420);
        const barH      = s(mobile ? 22 : 18);
        const barX      = cx - barW / 2;
        const startY    = cy - s(mobile ? 130 : 110);
        const rowGap    = s(mobile ? 60 : 52);

        const pillars: Array<{
            label:  string;
            icon:   string;
            value:  number;
            max:    number;
            color:  string;
        }> = [
            { label: 'FORTUNA',    icon: '🪙', value: bd.fortuna,    max: 300, color: PILLAR_COLORS.fortuna },
            { label: 'MAESTRIA',   icon: '🎮', value: bd.maestria,   max: 300, color: PILLAR_COLORS.maestria },
            { label: 'PROGRESSÃO', icon: '📈', value: bd.progressao, max: 200, color: PILLAR_COLORS.progressao },
            { label: 'OUSADIA',    icon: '🔥', value: bd.ousadia,    max: 200, color: PILLAR_COLORS.ousadia },
        ];

        pillars.forEach((p, i) => {
            const y = startY + i * rowGap;

            // Label
            ctx.save();
            ctx.fillStyle = '#aaaaaa';
            ctx.font      = `${r(mobile ? 11 : 9)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'right';
            ctx.fillText(`${p.icon} ${p.label}`, barX - s(10), y + barH * 0.7);
            ctx.restore();

            // Bar background
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(barX, y, barW, barH, s(4));
            ctx.fill();

            // Animated bar fill
            const filledW = barW * (p.value / p.max) * this.animProgress;
            if (filledW > 0) {
                ctx.save();
                ctx.shadowBlur  = s(10);
                ctx.shadowColor = p.color;
                ctx.fillStyle   = p.color;
                ctx.beginPath();
                ctx.roundRect(barX, y, filledW, barH, s(4));
                ctx.fill();
                ctx.restore();
            }

            // Value text
            if (this.animProgress > 0.3) {
                const displayVal = Math.floor(p.value * Math.min((this.animProgress - 0.3) / 0.7, 1));
                ctx.fillStyle = '#ffffff';
                ctx.font      = `${r(mobile ? 11 : 9)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'left';
                ctx.fillText(`${displayVal}/${p.max}`, barX + barW + s(10), y + barH * 0.7);
            }
        });

        // ── Total Score ─────────────────────────────────────────────────────
        if (this.animProgress >= 1) {
            const totalY = startY + 4 * rowGap + s(20);

            ctx.save();
            ctx.shadowBlur  = s(25);
            ctx.shadowColor = '#ffd700';
            ctx.fillStyle   = '#ffd700';
            ctx.font        = `bold ${r(mobile ? 14 : 12)}px "Press Start 2P", monospace`;
            ctx.textAlign   = 'center';
            ctx.fillText('★  SCORE TOTAL  ★', cx, totalY);
            ctx.restore();

            ctx.save();
            ctx.shadowBlur  = s(30);
            ctx.shadowColor = '#ffd700';
            ctx.fillStyle   = '#ffd700';
            ctx.font        = `bold ${r(mobile ? 52 : 44)}px "Press Start 2P", monospace`;
            ctx.textAlign   = 'center';
            ctx.fillText(`${bd.total}`, cx, totalY + s(mobile ? 65 : 55));
            ctx.restore();

            // Ranking position
            const posY = totalY + s(mobile ? 95 : 80);
            if (this.rankingPosition !== null) {
                const pulse = 0.75 + Math.sin(this.time * 4) * 0.25;
                ctx.save();
                ctx.globalAlpha = pulse;
                ctx.shadowBlur  = s(15);
                ctx.shadowColor = '#00ddff';
                ctx.fillStyle   = '#00ddff';
                ctx.font        = `bold ${r(mobile ? 13 : 11)}px "Press Start 2P", monospace`;
                ctx.textAlign   = 'center';
                ctx.fillText(`POSIÇÃO #${this.rankingPosition} NO RANKING!`, cx, posY);
                ctx.restore();
            } else {
                ctx.fillStyle = '#555555';
                ctx.font      = `${r(mobile ? 11 : 9)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('CONTINUE TENTANDO!', cx, posY);
            }

            // Continue button — only show when both animation AND position check are ready
            if (this.canContinue) {
                const btnY = this.screenH - s(mobile ? 120 : 90);
                const pulse = 0.7 + Math.sin(this.time * 3) * 0.3;
                const btnLabel = mobile ? 'TOQUE PARA CONTINUAR' : '[ ESPAÇO ] CONTINUAR';
                ctx.save();
                ctx.globalAlpha = pulse;
                ctx.fillStyle   = '#00ff64';
                ctx.font        = `bold ${r(mobile ? 13 : 11)}px "Press Start 2P", monospace`;
                ctx.textAlign   = 'center';
                ctx.fillText(btnLabel, cx, btnY);
                ctx.restore();
            } else if (this.animProgress >= 1 && !this.positionResolved) {
                // Animation done, waiting for network
                ctx.fillStyle = '#444';
                ctx.font      = `${r(mobile ? 9 : 8)}px "Press Start 2P", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText('VERIFICANDO RANKING...', cx, this.screenH - s(mobile ? 120 : 90));
            }
        }

        ctx.restore();
    }
}
