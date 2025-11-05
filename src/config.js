// ==========================================
// GAME CONFIGURATION FILE
// ==========================================
// 将所有游戏常量集中管理，便于调整和维护

// ==========================================
// UI 布局常量
// ==========================================
export const UI_CONFIG = {
  BACKPACK: {
    WIDTH: 520,
    HEIGHT: 320,
    LIST_X_OFFSET: 20,
    LIST_Y_OFFSET: 56,
    ROW_HEIGHT: 40,
    LIST_VIEWPORT_HEIGHT: 200
  },
  
  BENCH: {
    WIDTH: 520,
    HEIGHT: 320,
    LIST_X_OFFSET: 20,
    LIST_Y_OFFSET: 56,
    ROW_HEIGHT: 40
  },
  
  CHEST: {
    WIDTH: 520,
    HEIGHT: 340,
    LIST_X_OFFSET: 20,
    LIST_Y_OFFSET: 56,
    ROW_HEIGHT: 40,
    GRID_COLS: 4,
    GRID_ROWS: 3,
    CELL_SIZE: 60,
    CELL_GAP: 8
  },
  
  BUTTON: {
    WIDTH: 56,
    HEIGHT: 24,
    PADDING: 6
  },
  
  CRAFTING_GRID: {
    COLS: 2,
    ROWS: 2,
    CELL_SIZE: 72,
    GAP: 12
  }
};

// ==========================================
// 战斗系统常量
// ==========================================
export const COMBAT_CONFIG = {
  MELEE: {
    RANGE: 48,
    ANGLE_HALF: Math.PI / 5,
    BASE_DAMAGE: 7,           // 基础伤害（原28的1/4）
    COOLDOWN: 0.45,
    FX_DURATION_MS: 110,
    KNOCKBACK: 140,
    
    // 武器伤害倍数
    STONE_SWORD_MULTIPLIER: 2  // 石剑伤害翻倍
  },
  
  BOW: {
    RANGE: 600,
    MIN_DAMAGE_MULT: 0.2,     // 最远距离伤害衰减到20%
    CHARGE_TIME: 1.0,          // 蓄力时间
    ARROW_SPEED: 400
  },
  
  ENEMY: {
    AGGRO_RANGE: 180,
    CHASE_SPEED: 70,
    ATTACK_RANGE: 32
  }
};

// ==========================================
// 采集系统常量
// ==========================================
export const GATHERING_CONFIG = {
  CHOP: {
    RANGE: 24,
    BASE_TIME: 2.0,            // 基础砍树时间
    STONE_AXE_TIME: 1.0,       // 石斧砍树时间（2倍速）
    DROP_MIN: 1,
    DROP_MAX: 3
  },
  
  MINE_ROCK: {
    RANGE: 24,
    BASE_TIME: 4.0,            // 基础挖石时间
    PICKAXE_TIME: 2.0,         // 石镐挖石时间（2倍速）
    DROP_MIN: 1,
    DROP_MAX: 2
  },
  
  MINE_ORE: {
    RANGE: 24,
    TIME: 6.0,                 // 挖矿石固定时间
    REQUIRES_PICKAXE: true,
    DROP_MIN: 1,
    DROP_MAX: 2
  }
};

// ==========================================
// 矿石配置
// ==========================================
export const ORE_CONFIG = {
  copper: {
    name: '铜矿',
    color: '#d97706',
    rarity: 0.4,              // 40% 出现率
    spawnChance: 0.4
  },
  tin: {
    name: '锡矿',
    color: '#94a3b8',
    rarity: 0.3,
    spawnChance: 0.3
  },
  iron: {
    name: '铁矿',
    color: '#78716c',
    rarity: 0.15,
    spawnChance: 0.15
  },
  silver: {
    name: '银矿',
    color: '#e5e7eb',
    rarity: 0.08,
    spawnChance: 0.08
  },
  gold: {
    name: '金矿',
    color: '#fbbf24',
    rarity: 0.05,
    spawnChance: 0.05
  },
  darkGold: {
    name: '黑金矿',
    color: '#a16207',
    rarity: 0.015,
    spawnChance: 0.015
  },
  diamond: {
    name: '钻石',
    color: '#06b6d4',
    rarity: 0.005,
    spawnChance: 0.005
  }
};

// ==========================================
// 合成配方
// ==========================================
export const CRAFTING_RECIPES = {
  plank: {
    label: '木板 ×4',
    materials: { wood: 2 },
    output: { plank: 4 }
  },
  stick: {
    label: '木棍 ×4',
    materials: { plank: 2 },
    output: { stick: 4 }
  },
  bow: {
    label: '弓 ×1',
    materials: { stick: 3 },
    output: { bow: 1 }
  },
  pickaxe: {
    label: '石镐 ×1',
    materials: { stick: 2, stone: 3 },
    output: { pickaxe: 1 }
  },
  stoneAxe: {
    label: '石斧 ×1',
    materials: { stick: 2, stone: 2 },
    output: { stoneAxe: 1 }
  },
  stoneSword: {
    label: '石剑 ×1',
    materials: { stick: 1, stone: 2 },
    output: { stoneSword: 1 }
  },
  workbench: {
    label: '工作台 ×1',
    materials: { plank: 4 },
    output: { workbench: 1 }
  },
  chest: {
    label: '箱子 ×1',
    materials: { plank: 8 },
    output: { chest: 1 }
  },
  wall: {
    label: '木墙 ×1',
    materials: { plank: 1 },
    output: { wall: 1 }
  }
};

// ==========================================
// 工具效果配置
// ==========================================
export const TOOL_EFFECTS = {
  stoneAxe: {
    chopSpeedMultiplier: 2.0,   // 砍树速度翻倍
    mineSpeedMultiplier: 1.0    // 挖石不加速
  },
  pickaxe: {
    chopSpeedMultiplier: 1.0,   // 砍树不加速
    mineSpeedMultiplier: 2.0,   // 挖石速度翻倍
    canMineOre: true            // 可以挖矿石
  },
  stoneSword: {
    damageMultiplier: 2.0       // 近战伤害翻倍
  },
  bow: {
    // 弓的配置在 COMBAT_CONFIG.BOW 中
  }
};

// ==========================================
// 世界生成配置
// ==========================================
export const WORLD_CONFIG = {
  CHUNK_SIZE: 800,
  TREE_COUNT: 50,
  ROCK_COUNT: 30,
  ORE_SPAWN_CHANCE: 0.3,        // 30% 石头会生成矿石
  
  PLAYER_START: {
    x: 400,
    y: 400,
    hp: 100,
    maxHp: 100,
    food: 100,
    maxFood: 100,
    stamina: 100,
    maxStamina: 100
  }
};

// ==========================================
// 渲染配置
// ==========================================
export const RENDER_CONFIG = {
  TREE_SCALE: 3.6,
  ROCK_SCALE: 2.24,            // 80% of 2.8
  ORE_SCALE: 2.24,             // 80% of 2.8
  PLAYER_SIZE: 12,
  
  MINIMAP: {
    SIZE: 140,
    PADDING: 10,
    SCALE: 0.15
  }
};

// ==========================================
// 颜色配置
// ==========================================
export const COLORS = {
  UI: {
    BACKGROUND: 'rgba(20,20,24,0.94)',
    HEADER: '#1f2937',
    BORDER: '#374151',
    TEXT: '#e6e6e6',
    BUTTON_PRIMARY: '#2e7d32',
    BUTTON_PRIMARY_BORDER: '#1b5e20'
  },
  
  PARTICLES: {
    DAMAGE: '#ff1f1f',
    SHIELD: '#ffffff',
    HEALTH_GAIN: '#4ade80'
  }
};

// ==========================================
// 音效配置
// ==========================================
export const AUDIO_CONFIG = {
  ENABLED: true,
  MASTER_VOLUME: 0.3,
  
  SFX: {
    HIT: { frequency: 150, duration: 0.05 },
    PICKUP: { frequency: 600, duration: 0.1 },
    CRAFT: { frequency: 800, duration: 0.15 },
    SLASH: { frequency: 200, duration: 0.08 }
  }
};

// ==========================================
// 提示文本
// ==========================================
export const HINTS = {
  NEED_PICKAXE: '需要装备石镐才能挖掘矿石',
  UNEQUIP_FIRST: '请先卸下手上的工具',
  LOW_STAMINA: '体力不足，无法近战',
  HUNGRY: '饥饿无法近战',
  CANCEL_CHARGE: '按F取消蓄力'
};

// ==========================================
// 开发者配置
// ==========================================
export const DEV_CONFIG = {
  DEBUG_MODE: false,
  SHOW_COLLISION: false,
  SHOW_FPS: false,
  GOD_MODE: false,
  
  // 初始物品数量（调试用）
  INITIAL_INVENTORY: {
    gem: 16,
    wood: 16,
    plank: 16,
    stick: 16,
    workbench: 16,
    bow: 16,
    apple: 16,
    stone: 16,
    chest: 16,
    stoneAxe: 16,
    stoneWall: 16,
    stoneSword: 16,
    furnace: 16,
    pickaxe: 16,
    copper: 16,
    tin: 16,
    iron: 16,
    silver: 16,
    gold: 16,
    darkGold: 16,
    diamond: 16
  }
};
