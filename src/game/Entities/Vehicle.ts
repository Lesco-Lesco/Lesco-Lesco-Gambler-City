
export type VehicleType = 'ambulance' | 'firetruck' | 'police' | 'sedan' | 'hatchback' | 'pickup' | 'suv';
export type VehicleState = 'moving' | 'parked' | 'abandoned';

export interface VehicleAppearance {
    model: VehicleType;
    color: string;
    isEmergency: boolean;
}

export class Vehicle {
    public x: number;
    public y: number;
    public type: VehicleType;
    public state: VehicleState;
    public direction: 'up' | 'down' | 'left' | 'right';
    public appearance: VehicleAppearance;

    public width: number = 0.9;
    public height: number = 1.6; // Vertical length default

    private speed: number = 0;
    private targetSpeed: number = 1.5; // Slow movement as requested

    // For stoplights and yielding
    public isStopped: boolean = false;

    constructor(x: number, y: number, type: VehicleType, direction: 'up' | 'down' | 'left' | 'right', state: VehicleState = 'moving', color?: string) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.direction = direction;
        this.state = state;

        const isEmergency = ['ambulance', 'firetruck', 'police'].includes(type);
        this.appearance = {
            model: type,
            color: color || '#888',
            isEmergency
        };

        if (state === 'moving') {
            this.speed = this.targetSpeed;
        }

        // Adjust collider based on orientation
        if (direction === 'left' || direction === 'right') {
            this.width = 1.6;
            this.height = 0.9;
        } else {
            this.width = 0.9;
            this.height = 1.6;
        }
    }

    public update(dt: number) {
        if (this.state !== 'moving') return;

        // Simple forward movement
        let moveX = 0;
        let moveY = 0;

        if (!this.isStopped) {
            if (this.direction === 'up') moveY = -this.speed * dt;
            else if (this.direction === 'down') moveY = this.speed * dt;
            else if (this.direction === 'left') moveX = -this.speed * dt;
            else if (this.direction === 'right') moveX = this.speed * dt;
        }

        // Apply movement
        this.x += moveX;
        this.y += moveY;
    }

    public getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            w: this.width,
            h: this.height
        };
    }
}
