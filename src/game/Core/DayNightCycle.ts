/**
 * DayNightCycle — manages the roguelike night timer.
 * Each "run" starts at dusk and ends at dawn.
 */

export class DayNightCycle {
    /** Total night duration in seconds (game time) */
    public nightDuration: number = 120; // 2 minutes per night
    /** Current time in seconds since dusk */
    public currentTime: number = 0;
    /** 0 = dusk, 0.5 = midnight, 1 = dawn */
    public progress: number = 0;
    /** Whether the night is over */
    public isDawn: boolean = false;

    private callbacks: { event: string; callback: () => void }[] = [];

    public update(dt: number) {
        if (this.isDawn) return;

        this.currentTime += dt;
        this.progress = Math.min(this.currentTime / this.nightDuration, 1.0);

        if (this.progress >= 1.0) {
            this.isDawn = true;
            this.fireEvent('dawn');
        }

        // Midnight event
        if (this.progress >= 0.5 && this.progress - dt / this.nightDuration < 0.5) {
            this.fireEvent('midnight');
        }
    }

    /** Get the ambient darkness level based on time of night */
    public getAmbientDarkness(): number {
        // Much lighter night — playable visibility throughout
        if (this.progress < 0.3) {
            // Dusk → deep night (gentle ramp)
            return 0.30 + this.progress * 0.5; // 0.30 → 0.45
        } else if (this.progress < 0.8) {
            // Deep night — still clearly visible
            return 0.45;
        } else {
            // Approaching dawn — gets much lighter
            return 0.45 - (this.progress - 0.8) * 1.5; // 0.45 → 0.15
        }
    }

    /** Get display time string (e.g. "22:30") */
    public getTimeString(): string {
        // Night goes from 20:00 to 06:00 (10 hours mapped to nightDuration)
        const totalHours = 10;
        const hoursElapsed = this.progress * totalHours;
        const hour = Math.floor(20 + hoursElapsed) % 24;
        const minutes = Math.floor((hoursElapsed % 1) * 60);
        return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /** Get ambient color temperature */
    public getAmbientTint(): string {
        if (this.progress < 0.1) {
            // Dusk: warm purple
            return 'rgba(30, 10, 40, 0.3)';
        } else if (this.progress < 0.8) {
            // Night: deep blue
            return 'rgba(5, 5, 18, 0.1)';
        } else {
            // Pre-dawn: lighter blue
            const t = (this.progress - 0.8) / 0.2;
            const r = Math.floor(5 + t * 20);
            const g = Math.floor(5 + t * 15);
            const b = Math.floor(18 + t * 10);
            return `rgba(${r}, ${g}, ${b}, ${0.1 - t * 0.05})`;
        }
    }

    /** Get the current hour (20..23, 0..6) */
    public getHour(): number {
        const totalHours = 10;
        const hoursElapsed = this.progress * totalHours;
        return Math.floor(20 + hoursElapsed) % 24;
    }

    public reset() {
        this.currentTime = 0;
        this.progress = 0;
        this.isDawn = false;
    }

    public on(event: string, callback: () => void) {
        this.callbacks.push({ event, callback });
    }

    private fireEvent(event: string) {
        for (const cb of this.callbacks) {
            if (cb.event === event) cb.callback();
        }
    }
}
