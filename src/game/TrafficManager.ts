
import { MAP_DATA, TILE_TYPES, MAP_WIDTH, MAP_HEIGHT } from './World/MapData';
import { Vehicle } from './Entities/Vehicle';
import type { VehicleType, VehicleState } from './Entities/Vehicle';
import { TileMap } from './World/TileMap';
import { Camera } from './Core/Camera';
import { drawVehicle } from './Entities/VehicleRenderer';

export interface TrafficLight {
    x: number;
    y: number;
    state: 'red' | 'green';
    timer: number;
    direction: 'h' | 'v'; // Which street it controls
}

export class TrafficManager {
    private static instance: TrafficManager;
    public vehicles: Vehicle[] = [];
    public lights: TrafficLight[] = [];

    private spawnTimer: number = 0;
    private readonly MAX_MOVING_VEHICLES = 12;
    private readonly LIGHT_CYCLE_TIME = 10; // Seconds

    private constructor() {
        this.initializeLights();
        this.spawnParkedVehicles();
    }

    public static getInstance(): TrafficManager {
        if (!TrafficManager.instance) {
            TrafficManager.instance = new TrafficManager();
        }
        return TrafficManager.instance;
    }

    private initializeLights() {
        const mainIntersections = [
            { x: 100, y: 150 }, { x: 40, y: 150 }, { x: 220, y: 150 },
            { x: 100, y: 200 }, { x: 40, y: 200 }, { x: 220, y: 200 },
            { x: 100, y: 80 }, { x: 40, y: 80 }, { x: 220, y: 80 }
        ];

        for (const pos of mainIntersections) {
            this.lights.push({
                x: pos.x, y: pos.y,
                state: 'green',
                timer: Math.random() * this.LIGHT_CYCLE_TIME,
                direction: 'h'
            });
            this.lights.push({
                x: pos.x, y: pos.y,
                state: 'red',
                timer: Math.random() * this.LIGHT_CYCLE_TIME,
                direction: 'v'
            });
        }
    }

    private spawnParkedVehicles() {
        const passengerModels: VehicleType[] = ['sedan', 'hatchback', 'pickup', 'suv'];
        const colors = ['#334455', '#552222', '#225522', '#111111', '#aaaaaa', '#ffffff', '#222255'];

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (MAP_DATA[y][x] === TILE_TYPES.SIDEWALK) {
                    const isResidential = this.isResidential(x, y);
                    const isFavela = this.isFavela(x, y);

                    if (isResidential || isFavela) {
                        if (Math.random() < 0.04) {
                            const type = passengerModels[Math.floor(Math.random() * passengerModels.length)];
                            const color = colors[Math.floor(Math.random() * colors.length)];
                            const state: VehicleState = isFavela ? 'abandoned' : 'parked';
                            const dir = Math.random() > 0.5 ? 'up' : 'left';
                            this.vehicles.push(new Vehicle(x, y, type, dir, state, color));
                        }
                    }
                }
            }
        }
    }

    private isResidential(x: number, y: number): boolean {
        return (x > 165 && x < 215) || (x > 45 && x < 95);
    }

    private isFavela(x: number, y: number): boolean {
        const isFarLeft = x < 40;
        const isFarRight = x > 220;
        const isSouthWestFavela = (x > 45 && x < 215 && y > 200);
        return isFarLeft || isFarRight || isSouthWestFavela;
    }

    public update(dt: number, _tileMap: TileMap) {
        for (const light of this.lights) {
            light.timer -= dt;
            if (light.timer <= 0) {
                light.state = light.state === 'green' ? 'red' : 'green';
                light.timer = this.LIGHT_CYCLE_TIME;
            }
        }

        this.spawnTimer -= dt;
        const movingCount = this.vehicles.filter(v => v.state === 'moving').length;
        if (movingCount < this.MAX_MOVING_VEHICLES && this.spawnTimer <= 0) {
            this.spawnMovingVehicle();
            this.spawnTimer = 5 + Math.random() * 5;
        }

        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            if (v.state !== 'moving') continue;

            let shouldStop = false;
            for (const light of this.lights) {
                if (light.state === 'red') {
                    const dist = Math.sqrt((v.x - light.x) ** 2 + (v.y - light.y) ** 2);
                    if (dist < 2) {
                        const isAtIntersection = (v.direction === 'up' || v.direction === 'down') ? light.direction === 'v' : light.direction === 'h';
                        if (isAtIntersection) {
                            if (v.direction === 'right' && v.x < light.x) shouldStop = true;
                            else if (v.direction === 'left' && v.x > light.x) shouldStop = true;
                            else if (v.direction === 'down' && v.y < light.y) shouldStop = true;
                            else if (v.direction === 'up' && v.y > light.y) shouldStop = true;
                        }
                    }
                }
            }

            for (const other of this.vehicles) {
                if (other === v) continue;
                const dist = Math.sqrt((v.x - other.x) ** 2 + (v.y - other.y) ** 2);
                if (dist < 3) {
                    if (v.direction === 'right' && other.x > v.x && Math.abs(v.y - other.y) < 1) shouldStop = true;
                    if (v.direction === 'left' && other.x < v.x && Math.abs(v.y - other.y) < 1) shouldStop = true;
                    if (v.direction === 'down' && other.y > v.y && Math.abs(v.x - other.x) < 1) shouldStop = true;
                    if (v.direction === 'up' && other.y < v.y && Math.abs(v.x - other.x) < 1) shouldStop = true;
                }
            }

            v.isStopped = shouldStop;
            v.update(dt);

            if (v.x < -10 || v.x > MAP_WIDTH + 10 || v.y < -10 || v.y > MAP_HEIGHT + 10) {
                this.vehicles.splice(i, 1);
            }
        }
    }

    private spawnMovingVehicle() {
        const spawnPoints = [
            { x: 0, y: 149, d: 'right' }, { x: MAP_WIDTH, y: 151, d: 'left' },
            { x: 100, y: 0, d: 'down' }, { x: 100, y: MAP_HEIGHT, d: 'up' },
            { x: 40, y: 0, d: 'down' }, { x: 40, y: MAP_HEIGHT, d: 'up' },
            { x: 220, y: 0, d: 'down' }, { x: 220, y: MAP_HEIGHT, d: 'up' }
        ];

        const pt = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const r = Math.random();
        let type: VehicleType;
        if (r < 0.4) type = 'police';
        else if (r < 0.7) type = 'ambulance';
        else if (r < 0.9) type = 'firetruck';
        else {
            const passengerModels: VehicleType[] = ['sedan', 'hatchback', 'pickup', 'suv'];
            type = passengerModels[Math.floor(Math.random() * passengerModels.length)];
        }

        const colors = ['#334455', '#552222', '#225522', '#111111', '#aaaaaa', '#ffffff', '#222255'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.vehicles.push(new Vehicle(pt.x, pt.y, type, pt.d as any, 'moving', color));
    }

    public draw(ctx: CanvasRenderingContext2D, camera: Camera) {
        for (const v of this.vehicles) {
            const { sx, sy } = camera.worldToScreen(v.x, v.y);
            if (sx > -100 && sx < ctx.canvas.width + 100 && sy > -100 && sy < ctx.canvas.height + 100) {
                drawVehicle(ctx, camera, v);
            }
        }
        for (const l of this.lights) {
            this.drawTrafficLight(ctx, camera, l);
        }
    }

    private drawTrafficLight(ctx: CanvasRenderingContext2D, camera: Camera, light: TrafficLight) {
        const { sx, sy } = camera.worldToScreen(light.x, light.y);
        const z = camera.zoom;
        let ox = 0, oy = 0;
        if (light.direction === 'h') oy = -20 * z; else ox = 20 * z;

        ctx.save();
        ctx.translate(sx + ox, sy + oy);
        ctx.fillStyle = '#222';
        ctx.fillRect(-2 * z, 0, 4 * z, 10 * z);
        ctx.fillStyle = '#111';
        ctx.fillRect(-6 * z, -25 * z, 12 * z, 25 * z);

        const r = 4 * z;
        ctx.fillStyle = light.state === 'red' ? '#ff0000' : '#440000';
        ctx.beginPath(); ctx.arc(0, -20 * z, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = light.state === 'green' ? '#00ff00' : '#004400';
        ctx.beginPath(); ctx.arc(0, -10 * z, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
