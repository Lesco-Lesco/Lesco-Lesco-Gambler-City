/**
 * EventEmitter — Lightweight typed pub/sub system for game-wide events.
 * Decouples systems like Police, Minigames, Economy, and UI.
 */

/** All game event types */
export type GameEventType =
    | 'MONEY_CHANGED'
    | 'MINIGAME_STARTED'
    | 'MINIGAME_ENDED'
    | 'RAID_STARTED'
    | 'RAID_ENDED'
    | 'GAME_OVER'
    | 'NOTIFICATION';

export interface GameEventData {
    MONEY_CHANGED: { amount: number; delta: number };
    MINIGAME_STARTED: { type: string };
    MINIGAME_ENDED: { type: string; moneyChange: number };
    RAID_STARTED: Record<string, never>;
    RAID_ENDED: { confiscated: number };
    GAME_OVER: Record<string, never>;
    NOTIFICATION: { message: string; duration: number };
}

type EventCallback<T extends GameEventType> = (data: GameEventData[T]) => void;

export class GameEventEmitter {
    private static instance: GameEventEmitter;
    private listeners: Map<GameEventType, Set<EventCallback<any>>> = new Map();

    private constructor() { }

    public static getInstance(): GameEventEmitter {
        if (!GameEventEmitter.instance) {
            GameEventEmitter.instance = new GameEventEmitter();
        }
        return GameEventEmitter.instance;
    }

    /** Subscribe to an event */
    public on<T extends GameEventType>(event: T, callback: EventCallback<T>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    /** Unsubscribe from an event */
    public off<T extends GameEventType>(event: T, callback: EventCallback<T>): void {
        this.listeners.get(event)?.delete(callback);
    }

    /** Emit an event to all subscribers */
    public emit<T extends GameEventType>(event: T, data: GameEventData[T]): void {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }

    /** Remove all listeners (useful for testing/reset) */
    public clear(): void {
        this.listeners.clear();
    }
}
