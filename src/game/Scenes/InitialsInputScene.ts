/**
 * InitialsInputScene — Classic arcade-style 3-letter initial selector.
 *
 * Controls:
 *   ↑ / ↓        — cycle letter (A→Z→A), with auto-repeat
 *   ← / →        — move cursor between letter slots
 *   Enter / Space — confirm and submit
 *
 * On mobile: joystick maps to arrow keys via InputManager.
 *
 * Callback:
 *   onConfirm(initials: string, breakdown: ScoreBreakdown)
 */

import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { SoundManager } from '../Core/SoundManager';
import type { ScoreBreakdown } from '../Core/ScoreCalculator';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class InitialsInputScene implements Scene {
    public name = 'initials_input';

    private screenW = 0;
    private screenH = 0;
    private time    = 0;

    private letters:     string[] = ['A', 'A', 'A'];
    private cursorIndex: number   = 0;   // 0, 1, or 2
    private position:    number   = 0;   // ranking position to display
    private breakdown:   ScoreBreakdown | null = null;
    private confirmed    = false;

    private input = InputManager.getInstance();

    public onConfirm?: (initials: string, breakdown: ScoreBreakdown) => void;

    // ─────────────────────────────────────────────────
    // Called by GameCanvas before setScene('initials_input')
    // ─────────────────────────────────────────────────

    public setData(position: number, breakdown: ScoreBreakdown): void {
        this.position  = position;
        this.breakdown = breakdown;
    }

    // ─────────────────────────────────────────────────
    // Scene lifecycle
    // ─────────────────────────────────────────────────

    public onEnter(): void {
        this.input.pushContext('menu');
        this.letters     = ['A', 'A', 'A'];
        this.cursorIndex = 0;
        this.confirmed   = false;
        this.time        = 0;
    }

    public onExit(): void {
        this.input.popContext();
    }

    public resize(w: number, h: number): void {
        this.screenW = w;
        this.screenH = h;
    }

    public update(dt: number): void {
        this.time += dt;
        if (this.confirmed) return;

        const inp = this.input;

        // Cycle letter up
        if (inp.wasPressedOrHeld('ArrowUp', dt)) {
            const idx = ALPHABET.indexOf(this.letters[this.cursorIndex]);
            this.letters[this.cursorIndex] = ALPHABET[(idx + 1) % 26];
            SoundManager.getInstance().play('menu_select');
        }

        // Cycle letter down
        if (inp.wasPressedOrHeld('ArrowDown', dt)) {
            const idx = ALPHABET.indexOf(this.letters[this.cursorIndex]);
            this.letters[this.cursorIndex] = ALPHABET[(idx + 25) % 26]; // +25 = -1 mod 26
            SoundManager.getInstance().play('menu_select');
        }

        // Move cursor right
        if (inp.wasPressed('ArrowRight')) {
            if (this.cursorIndex < 2) {
                this.cursorIndex++;
                SoundManager.getInstance().play('menu_confirm');
            }
        }

        // Move cursor left
        if (inp.wasPressed('ArrowLeft')) {
            if (this.cursorIndex > 0) {
                this.cursorIndex--;
                SoundManager.getInstance().play('menu_confirm');
            }
        }

        // Confirm
        if (inp.wasPressed('Enter') || inp.wasPressed('Space')) {
            this.confirm();
        }
    }

    private confirm(): void {
        if (this.confirmed || !this.breakdown || !this.onConfirm) return;
        this.confirmed = true;
        SoundManager.getInstance().play('achievement_unlock');
        this.onConfirm(this.letters.join(''), this.breakdown);
    }

    // ─────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────

    public render(ctx: CanvasRenderingContext2D): void {
        const s      = (v: number) => UIScale.s(v);
        const r      = (v: number) => UIScale.r(v);
        const cx     = this.screenW / 2;
        const cy     = this.screenH / 2;
        const mobile = isMobile();

        ctx.save();
        ctx.textBaseline = 'alphabetic';

        // ── Background ──────────────────────────────────────────────────────
        ctx.fillStyle = '#050208';
        ctx.fillRect(0, 0, this.screenW, this.screenH);

        // Glitch lines
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = `rgba(255,0,0,${Math.random() * 0.04})`;
            ctx.fillRect(Math.random() * this.screenW, Math.random() * this.screenH, Math.random() * s(60), 1);
        }

        // ── Title "NOVO RECORDE!" ────────────────────────────────────────────
        const titlePulse = 0.8 + Math.sin(this.time * 5) * 0.2;
        ctx.save();
        ctx.globalAlpha = titlePulse;
        ctx.shadowBlur  = s(25);
        ctx.shadowColor = '#ffd700';
        ctx.fillStyle   = '#ffd700';
        ctx.font        = `bold ${r(mobile ? 22 : 18)}px "Press Start 2P", monospace`;
        ctx.textAlign   = 'center';
        ctx.fillText('★  NOVO RECORDE!  ★', cx, cy - s(mobile ? 190 : 160));
        ctx.restore();

        // ── Ranking position ────────────────────────────────────────────────
        ctx.save();
        ctx.shadowBlur  = s(15);
        ctx.shadowColor = '#00ddff';
        ctx.fillStyle   = '#00ddff';
        ctx.font        = `bold ${r(mobile ? 18 : 15)}px "Press Start 2P", monospace`;
        ctx.textAlign   = 'center';
        ctx.fillText(`POSIÇÃO #${this.position}`, cx, cy - s(mobile ? 130 : 105));
        ctx.restore();

        // ── Letter boxes ────────────────────────────────────────────────────
        const boxW   = s(mobile ? 90 : 80);
        const boxH   = s(mobile ? 110 : 96);
        const gap    = s(mobile ? 20 : 16);
        const totalW = boxW * 3 + gap * 2;
        const boxY   = cy - s(mobile ? 80 : 68);

        this.letters.forEach((letter, i) => {
            const bx      = cx - totalW / 2 + i * (boxW + gap);
            const isActive = i === this.cursorIndex;

            // Box background
            ctx.fillStyle = isActive ? 'rgba(0, 220, 100, 0.08)' : 'rgba(255,255,255,0.03)';
            ctx.beginPath();
            ctx.roundRect(bx, boxY, boxW, boxH, s(8));
            ctx.fill();

            // Box border (active = bright neon green, inactive = dim)
            const borderPulse = isActive ? 0.7 + Math.sin(this.time * 6) * 0.3 : 0.25;
            ctx.save();
            ctx.globalAlpha = borderPulse;
            ctx.shadowBlur  = isActive ? s(18) : 0;
            ctx.shadowColor = '#00ff64';
            ctx.strokeStyle = isActive ? '#00ff64' : '#448866';
            ctx.lineWidth   = s(isActive ? 3 : 1.5);
            ctx.beginPath();
            ctx.roundRect(bx, boxY, boxW, boxH, s(8));
            ctx.stroke();
            ctx.restore();

            // Letter
            ctx.save();
            if (isActive) {
                ctx.shadowBlur  = s(15);
                ctx.shadowColor = '#00ff64';
            }
            ctx.fillStyle = isActive ? '#00ff64' : '#44aa66';
            ctx.font      = `bold ${r(mobile ? 52 : 44)}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(letter, bx + boxW / 2, boxY + boxH * 0.72);
            ctx.restore();

            // Active arrows ▲ ▼
            if (isActive) {
                const arrowPulse = 0.6 + Math.sin(this.time * 8) * 0.4;
                ctx.save();
                ctx.globalAlpha = arrowPulse;
                ctx.fillStyle   = '#00ff64';
                ctx.font        = `${r(mobile ? 20 : 16)}px monospace`;
                ctx.textAlign   = 'center';
                ctx.fillText('▲', bx + boxW / 2, boxY - s(8));
                ctx.fillText('▼', bx + boxW / 2, boxY + boxH + s(22));
                ctx.restore();
            }
        });

        // ── Instructions ────────────────────────────────────────────────────
        const instrY = cy + s(mobile ? 110 : 90);
        ctx.fillStyle = '#555555';
        ctx.font      = `${r(mobile ? 9 : 8)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';

        if (mobile) {
            ctx.fillText('↑↓ MUDAR LETRA   ←→ MOVER', cx, instrY);
            ctx.fillText('OK / TOQUE EM CONFIRMAR', cx, instrY + s(28));
        } else {
            ctx.fillText('↑↓ MUDAR   ← → MOVER   ENTER CONFIRMAR', cx, instrY);
        }

        // ── Confirm button ──────────────────────────────────────────────────
        const btnY    = this.screenH - s(mobile ? 110 : 80);
        const btnPulse = 0.7 + Math.sin(this.time * 3) * 0.3;
        const btnW    = s(mobile ? 340 : 300);
        const btnH    = s(mobile ? 54 : 46);
        const btnX    = cx - btnW / 2;

        ctx.save();
        ctx.fillStyle   = `rgba(0, 255, 100, ${0.12 * btnPulse})`;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
        ctx.fill();
        ctx.globalAlpha = btnPulse;
        ctx.strokeStyle = '#00ff64';
        ctx.lineWidth   = s(2);
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
        ctx.stroke();
        ctx.fillStyle   = '#ffffff';
        ctx.font        = `bold ${r(mobile ? 12 : 10)}px "Press Start 2P", monospace`;
        ctx.textAlign   = 'center';
        ctx.fillText(
            mobile ? 'TOQUE PARA CONFIRMAR' : '[ ENTER ] CONFIRMAR',
            cx,
            btnY + btnH / 2 + s(5)
        );
        ctx.restore();

        ctx.restore();
    }
}
