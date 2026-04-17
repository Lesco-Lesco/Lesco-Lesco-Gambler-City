/**
 * RankingScene — Scrollable global top-100 leaderboard.
 *
 * Navigation:
 *   ↑ / ↓           — scroll rows (with auto-repeat)
 *   Space / Enter    — restart the game
 *
 * Local history:
 *   Shows the player's personal best from localStorage at the bottom.
 *
 * Callback:
 *   onRestart()
 */

import type { Scene } from '../Core/Loop';
import { InputManager } from '../Core/InputManager';
import { UIScale } from '../Core/UIScale';
import { isMobile } from '../Core/MobileDetect';
import { SoundManager } from '../Core/SoundManager';
import { RankingAPI } from '../Services/RankingAPI';
import type { RankingEntry } from '../Services/RankingAPI';

export class RankingScene implements Scene {
    public name = 'ranking';

    private screenW = 0;
    private screenH = 0;
    private time    = 0;

    private ranking:        RankingEntry[]      = [];
    private playerPosition: number | null       = null;

    private scrollOffset    = 0;
    private visibleRows     = 8;
    private loading         = true;

    private input = InputManager.getInstance();

    public onRestart?: () => void;

    // ─────────────────────────────────────────────────
    // Called by GameCanvas before setScene('ranking')
    // ─────────────────────────────────────────────────

    public setData(ranking: RankingEntry[], playerPosition: number | null): void {
        this.ranking        = ranking;
        this.playerPosition = playerPosition;
        this.loading        = false;
        this.autoScroll();
    }

    // ─────────────────────────────────────────────────
    // Scene lifecycle
    // ─────────────────────────────────────────────────

    public onEnter(): void {
        this.time = 0;

        // If ranking wasn't pre-set, fetch from API (uses local cache if offline)
        if (this.loading || this.ranking.length === 0) {
            this.loading = true;
            RankingAPI.getInstance().getRanking()
                .then(r  => { this.ranking = r; this.loading = false; this.autoScroll(); })
                .catch(() => { this.loading = false; });
        }
    }

    public onExit(): void {}

    public resize(w: number, h: number): void {
        this.screenW = w;
        this.screenH = h;
        this.recalcVisibleRows();
    }

    public update(dt: number): void {
        this.time += dt;

        const inp = this.input;

        if (inp.wasPressedOrHeld('ArrowUp', dt) && this.scrollOffset > 0) {
            this.scrollOffset--;
        }
        if (inp.wasPressedOrHeld('ArrowDown', dt)) {
            const max = Math.max(0, this.ranking.length - this.visibleRows);
            if (this.scrollOffset < max) this.scrollOffset++;
        }
        if (inp.wasPressed('Space') || inp.wasPressed('Enter')) {
            SoundManager.getInstance().play('game_start');
            if (this.onRestart) this.onRestart();
        }
    }

    // ─────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────

    public render(ctx: CanvasRenderingContext2D): void {
        const s      = (v: number) => UIScale.s(v);
        const r      = (v: number) => UIScale.r(v);
        const W      = this.screenW;
        const H      = this.screenH;
        const mobile = isMobile();

        ctx.save();
        ctx.textBaseline = 'middle';

        // ── Background ──────────────────────────────────────────────────────
        ctx.fillStyle = '#050208';
        ctx.fillRect(0, 0, W, H);

        // Subtle radial vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        // ── Layout constants ─────────────────────────────────────────────────
        // Centered panel with horizontal padding
        const panelW  = Math.min(s(mobile ? 600 : 760), W - s(mobile ? 32 : 60));
        const panelX  = (W - panelW) / 2;

        // Vertical zones (fixed anchors)
        const titleCY  = s(mobile ? 40 : 36);          // title center Y
        const headerY  = titleCY + s(mobile ? 38 : 34); // column labels
        const sepY     = headerY + s(mobile ? 18 : 16); // separator line
        const rowsTop  = sepY + s(mobile ? 10 : 8);     // first row center

        const btnH     = s(mobile ? 50 : 44);
        const btnY     = H - s(mobile ? 18 : 16) - btnH;
        const bestY    = btnY - s(mobile ? 20 : 18);    // personal best line

        const tableBot = bestY - s(8);
        const availH   = tableBot - rowsTop;
        const rowH     = Math.min(s(mobile ? 42 : 38), availH / Math.max(this.visibleRows, 1));

        // ── Title ───────────────────────────────────────────────────────────
        ctx.save();
        ctx.shadowBlur  = s(24);
        ctx.shadowColor = '#ff2244';
        ctx.fillStyle   = '#ff2244';
        ctx.font        = `bold ${r(mobile ? 20 : 18)}px "Press Start 2P", monospace`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏆  RANKING GLOBAL  🏆', W / 2, titleCY);
        ctx.restore();

        // Title underline
        ctx.strokeStyle = 'rgba(255,34,68,0.3)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(panelX, titleCY + s(mobile ? 20 : 18));
        ctx.lineTo(panelX + panelW, titleCY + s(mobile ? 20 : 18));
        ctx.stroke();

        // ── Loading / Empty ──────────────────────────────────────────────────
        if (this.loading) {
            ctx.fillStyle    = '#555';
            ctx.font         = `${r(10)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('CARREGANDO...', W / 2, H / 2);
            this.renderFooter(ctx, s, r, W, btnY, btnH, panelW, mobile);
            ctx.restore();
            return;
        }

        if (this.ranking.length === 0) {
            ctx.fillStyle    = '#555';
            ctx.font         = `${r(mobile ? 10 : 9)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NENHUM RECORDE AINDA.', W / 2, H / 2 - s(18));
            ctx.fillText('SEJA O PRIMEIRO!',      W / 2, H / 2 + s(18));
            this.renderFooter(ctx, s, r, W, btnY, btnH, panelW, mobile);
            ctx.restore();
            return;
        }

        // ── Column layout (inside panel) ─────────────────────────────────────
        //  [#]  [NOME]  [SCORE]  [DATA]
        const colPosW  = s(mobile ? 40 : 52);
        const colNameW = s(mobile ? 80 : 100);

        const cPos   = panelX + colPosW / 2;                    // center aligned
        const cName  = panelX + colPosW + s(12);                // left aligned
        const cScore = panelX + colPosW + colNameW + s(20);     // left aligned
        const cDate  = panelX + panelW;                          // right aligned

        // Column headers
        ctx.fillStyle    = 'rgba(255,255,255,0.4)';
        ctx.font         = `${r(mobile ? 9 : 8)}px "Press Start 2P", monospace`;
        ctx.textBaseline = 'middle';

        ctx.textAlign = 'center'; ctx.fillText('#',     cPos,   headerY);
        ctx.textAlign = 'left';   ctx.fillText('NOME',  cName,  headerY);
        ctx.textAlign = 'left';   ctx.fillText('SCORE', cScore, headerY);
        ctx.textAlign = 'right';  ctx.fillText('DATA',  cDate,  headerY);

        // Header separator
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(panelX, sepY);
        ctx.lineTo(panelX + panelW, sepY);
        ctx.stroke();

        // ── Rows ─────────────────────────────────────────────────────────────
        const visible = this.ranking.slice(this.scrollOffset, this.scrollOffset + this.visibleRows);

        visible.forEach((entry, idx) => {
            const rowCY    = rowsTop + idx * rowH + rowH * 0.5;
            const isPlayer = entry.position === this.playerPosition;

            const posColor = entry.position === 1 ? '#ffd700'
                           : entry.position === 2 ? '#c0c0c0'
                           : entry.position === 3 ? '#cd7f32'
                           : '#888888';

            // Player highlight
            if (isPlayer) {
                ctx.save();
                ctx.fillStyle   = 'rgba(0,220,180,0.09)';
                ctx.strokeStyle = 'rgba(0,200,160,0.35)';
                ctx.lineWidth   = 1;
                ctx.beginPath();
                ctx.roundRect(panelX - s(6), rowCY - rowH * 0.44, panelW + s(12), rowH * 0.88, s(5));
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                // Side arrows
                const ap = 0.5 + Math.sin(this.time * 5) * 0.5;
                ctx.save();
                ctx.globalAlpha  = ap;
                ctx.fillStyle    = '#00ddff';
                ctx.font         = `${r(mobile ? 14 : 12)}px monospace`;
                ctx.textBaseline = 'middle';
                ctx.textAlign    = 'right';
                ctx.fillText('◂', panelX - s(8), rowCY);
                ctx.textAlign    = 'left';
                ctx.fillText('▸', panelX + panelW + s(8), rowCY);
                ctx.restore();
            }

            // Position number
            ctx.save();
            if (entry.position <= 3) { ctx.shadowBlur = s(10); ctx.shadowColor = posColor; }
            ctx.fillStyle    = posColor;
            ctx.font         = `bold ${r(mobile ? 13 : 12)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${entry.position}`, cPos, rowCY);
            ctx.restore();

            // Initials — largest text in the row
            const nameColor = isPlayer ? '#00ddff' : (entry.position <= 3 ? posColor : '#dddddd');
            ctx.save();
            if (isPlayer || entry.position <= 3) { ctx.shadowBlur = s(6); ctx.shadowColor = nameColor; }
            ctx.fillStyle    = nameColor;
            ctx.font         = `bold ${r(mobile ? 16 : 15)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(entry.initials, cName, rowCY);
            ctx.restore();

            // Score — gold
            ctx.save();
            ctx.fillStyle    = '#ffd700';
            ctx.font         = `bold ${r(mobile ? 13 : 12)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${entry.score}`, cScore, rowCY);
            ctx.restore();

            // Date — very dim, small
            const d    = new Date(entry.timestamp);
            const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            ctx.fillStyle    = '#4a4a4a';
            ctx.font         = `${r(mobile ? 8 : 7)}px "Press Start 2P", monospace`;
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(date, cDate, rowCY);

            // Row separator
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(panelX, rowCY + rowH * 0.46);
            ctx.lineTo(panelX + panelW, rowCY + rowH * 0.46);
            ctx.stroke();
        });

        // ── Scroll indicators ────────────────────────────────────────────────
        if (this.scrollOffset > 0) {
            const ap = 0.5 + Math.sin(this.time * 4) * 0.5;
            ctx.save();
            ctx.globalAlpha  = ap;
            ctx.fillStyle    = '#777';
            ctx.font         = `${r(13)}px monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▲', W / 2, rowsTop - s(6));
            ctx.restore();
        }
        if (this.scrollOffset + this.visibleRows < this.ranking.length) {
            const lastRowBot = rowsTop + Math.min(visible.length, this.visibleRows) * rowH;
            const ap = 0.5 + Math.sin(this.time * 4 + Math.PI) * 0.5;
            ctx.save();
            ctx.globalAlpha  = ap;
            ctx.fillStyle    = '#777';
            ctx.font         = `${r(13)}px monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('▼', W / 2, lastRowBot + s(6));
            ctx.restore();
        }

        // ── Footer ───────────────────────────────────────────────────────────
        this.renderFooter(ctx, s, r, W, btnY, btnH, panelW, mobile);

        ctx.restore();
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────

    private renderFooter(
        ctx: CanvasRenderingContext2D,
        s: (v: number) => number,
        r: (v: number) => number,
        W: number,
        btnY: number,
        btnH: number,
        panelW: number,
        mobile: boolean
    ): void {
        // Restart button
        const btnW = Math.min(s(mobile ? 360 : 310), panelW);
        const btnX = (W - btnW) / 2;
        const pulse = 0.75 + Math.sin(this.time * 3) * 0.25;

        ctx.save();
        ctx.fillStyle   = `rgba(0,255,100,${0.10 * pulse})`;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
        ctx.fill();

        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#00ff64';
        ctx.lineWidth   = s(2);
        ctx.shadowBlur  = s(12);
        ctx.shadowColor = '#00ff64';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, s(8));
        ctx.stroke();

        ctx.shadowBlur   = 0;
        ctx.fillStyle    = '#ffffff';
        ctx.font         = `bold ${r(mobile ? 11 : 10)}px "Press Start 2P", monospace`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            mobile ? 'TOQUE PARA JOGAR DE NOVO' : '[ ESPAÇO ] JOGAR DE NOVO',
            W / 2, btnY + btnH / 2
        );
        ctx.restore();
    }

    private recalcVisibleRows(): void {
        const s      = (v: number) => UIScale.s(v);
        const mobile = isMobile();

        const titleCY  = s(mobile ? 40 : 36);
        const headerY  = titleCY + s(mobile ? 38 : 34);
        const sepY     = headerY + s(mobile ? 18 : 16);
        const rowsTop  = sepY + s(mobile ? 10 : 8);

        const btnH  = s(mobile ? 50 : 44);
        const btnY  = this.screenH - s(mobile ? 18 : 16) - btnH;
        const bestY = btnY - s(mobile ? 20 : 18);
        const tableBot = bestY - s(8);

        const rowH = s(mobile ? 42 : 38);
        this.visibleRows = Math.max(3, Math.floor((tableBot - rowsTop) / rowH));
    }

    private autoScroll(): void {
        if (this.playerPosition === null) { this.scrollOffset = 0; return; }
        const target = this.playerPosition - 1;
        const half   = Math.floor(this.visibleRows / 2);
        const max    = Math.max(0, this.ranking.length - this.visibleRows);
        this.scrollOffset = Math.min(max, Math.max(0, target - half));
    }
}
