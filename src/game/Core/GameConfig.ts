/**
 * GameConfig — Centralized game constants.
 * All magic numbers and tuning values live here.
 */

export const GameConfig = {
    // --- Economy ---
    STARTING_MONEY: 100,
    MONEY_UNIT: 10,            // All money rounded to multiples of this

    // --- Bet Limits ---
    BET_MIN_BASE: 10,
    BET_MAX_BASE: 100,
    BET_MIN_BONUS_RATE: 0.01,  // 1% of max wealth
    BET_MAX_BONUS_RATE: 0.25,  // 25% of max wealth
    BET_MIN_CAP: 99990,
    BET_MAX_CAP: 999990,

    // --- Player Movement ---
    WALK_SPEED: 3.5,           // Tiles per second
    RUN_SPEED: 6.0,            // Tiles per second
    PLAYER_WIDTH: 0.4,
    PLAYER_HEIGHT: 0.4,

    // --- Stamina ---
    MAX_STAMINA: 300,
    STAMINA_DRAIN: 20,
    STAMINA_REGEN: 40,

    // --- Police ---
    POLICE_BANCA_COST: 150,
    POLICE_BANCA_REWARD: 300,  // 150 bet + 150 profit
    POLICE_CONTRIBUTION_COST: 10,
    RAID_COOLDOWN: 60,         // Seconds between raids
    RAID_CHECK_INTERVAL: 5,    // Check every N seconds

    // --- Raid Chances (per check) ---
    RAID_CHANCE_NORMAL: 0.02,
    RAID_CHANCE_PERIPHERY: 0.08,
    RAID_CHANCE_NEAR_SHOP: 0.005,
    RAID_MIN_MONEY: 10,        // Min money to trigger raid

    // --- Bicho ---
    BICHO_RESULT_DELAY_MINUTES: 10,
    BICHO_EXACT_MATCH_MULTIPLIER: 18,
    BICHO_GROUP_MATCH_PAYOUT: 50,

    // --- NPC ---
    NPC_INTERACTION_RADIUS: 1.5,
    NPC_BROKE_REFILL_MIN: 50,
    NPC_BROKE_REFILL_RANGE: 50,

    // --- Camera ---
    CAMERA_ZOOM_MIN: 0.5,
    CAMERA_ZOOM_MAX: 3.0,
    CAMERA_ZOOM_STEP: 0.25,

    // --- Animation ---
    WALK_ANIM_FRAMES: 4,
    WALK_ANIM_SPEED: 0.15,     // Seconds per frame

    // --- Periphery Zones ---
    PERIPHERY_LEFT_THRESHOLD: 40,
    PERIPHERY_RIGHT_THRESHOLD: 220,
    PERIPHERY_SOUTH_X_MIN: 45,
    PERIPHERY_SOUTH_X_MAX: 215,
    PERIPHERY_SOUTH_Y_MIN: 200,

    // --- Shopping Location ---
    SHOP_X: 130,
    SHOP_Y: 125,
    SHOP_RADIUS: 40,
} as const;

export type GameConfigType = typeof GameConfig;
