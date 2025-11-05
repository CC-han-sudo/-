// ==========================================
// ORE SYSTEM MODULE
// ==========================================
// 矿石系统的所有逻辑集中管理

// ==========================================
// 矿石配置
// ==========================================
export const ORE_TYPES = {
  copper: { name: '铜矿', color: '#d97706', rarity: 0.4 },
  tin: { name: '锡矿', color: '#94a3b8', rarity: 0.3 },
  iron: { name: '铁矿', color: '#78716c', rarity: 0.15 },
  silver: { name: '银矿', color: '#e5e7eb', rarity: 0.08 },
  gold: { name: '金矿', color: '#fbbf24', rarity: 0.05 },
  darkGold: { name: '黑金矿', color: '#a16207', rarity: 0.015 },
  diamond: { name: '钻石', color: '#06b6d4', rarity: 0.005 }
};

export const ORE_CONFIG = {
  MINE_TIME: 6.0,           // 挖矿时间（秒）
  MINE_RANGE: 24,           // 挖矿范围（像素）
  SPAWN_CHANCE: 0.3,        // 30% 石头会生成矿石
  DROP_MIN: 1,
  DROP_MAX: 2,
  REQUIRES_PICKAXE: true    // 需要装备镐子
};

// ==========================================
// 矿石生成
// ==========================================

/**
 * 根据稀有度随机选择矿石类型
 * @param {Function} random - 随机数生成函数 (0-1)
 * @returns {string} 矿石类型
 */
export function selectOreType(random) {
  const roll = random();
  let cumulative = 0;
  
  for (const [type, config] of Object.entries(ORE_TYPES)) {
    cumulative += config.rarity;
    if (roll <= cumulative) {
      return type;
    }
  }
  
  return 'copper'; // 默认返回铜矿
}

/**
 * 为石头生成矿石
 * @param {Object} rock - 石头对象 {x, y, id}
 * @param {Function} random - 随机数生成函数
 * @param {number} oreSeq - 矿石序列号
 * @returns {Object|null} 矿石对象或null
 */
export function spawnOreAtRock(rock, random, oreSeq) {
  if (random() > ORE_CONFIG.SPAWN_CHANCE) {
    return null; // 30%概率生成矿石
  }
  
  const type = selectOreType(random);
  
  return {
    id: oreSeq,
    x: rock.x,
    y: rock.y,
    type: type
  };
}

/**
 * 批量生成矿石
 * @param {Array} rocks - 石头数组
 * @param {Function} random - 随机数生成函数
 * @returns {Array} 矿石数组
 */
export function generateOres(rocks, random) {
  const ores = [];
  let oreSeq = 0;
  
  for (const rock of rocks) {
    const ore = spawnOreAtRock(rock, random, oreSeq);
    if (ore) {
      ores.push(ore);
      oreSeq++;
    }
  }
  
  return ores;
}

// ==========================================
// 矿石交互
// ==========================================

/**
 * 检查是否可以挖掘矿石
 * @param {Object} player - 玩家对象
 * @returns {boolean}
 */
export function canMineOre(player) {
  return player.equipped === 'pickaxe';
}

/**
 * 获取挖矿提示文本
 * @returns {string}
 */
export function getMineOreHint() {
  return '需要装备石镐才能挖掘矿石';
}

/**
 * 计算矿石掉落数量
 * @param {string} oreType - 矿石类型
 * @param {Function} random - 随机数生成函数
 * @returns {number}
 */
export function calculateOreDrop(oreType, random) {
  return Math.floor(ORE_CONFIG.DROP_MIN + random() * (ORE_CONFIG.DROP_MAX - ORE_CONFIG.DROP_MIN + 1));
}

/**
 * 移除已挖掘的矿石
 * @param {Array} ores - 矿石数组
 * @param {number} oreId - 要移除的矿石ID
 * @returns {Object|null} 被移除的矿石对象
 */
export function removeOre(ores, oreId) {
  const index = ores.findIndex(ore => ore.id === oreId);
  if (index === -1) return null;
  
  const removed = ores[index];
  ores.splice(index, 1);
  return removed;
}

// ==========================================
// 矿石碰撞检测
// ==========================================

/**
 * 检测点与矿石的碰撞
 * @param {number} x - 点的X坐标
 * @param {number} y - 点的Y坐标
 * @param {Array} ores - 矿石数组
 * @param {number} radius - 碰撞半径
 * @returns {boolean}
 */
export function collidesWithOre(x, y, ores, radius = 10) {
  for (const ore of ores) {
    const dist = Math.hypot(ore.x - x, ore.y - y);
    if (dist < radius) return true;
  }
  return false;
}

/**
 * 查找距离最近的矿石
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {Array} ores - 矿石数组
 * @param {number} maxDistance - 最大距离
 * @returns {Object|null} 矿石对象或null
 */
export function findNearestOre(x, y, ores, maxDistance = Infinity) {
  let nearest = null;
  let minDist = maxDistance;
  
  for (const ore of ores) {
    const dist = Math.hypot(ore.x - x, ore.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = ore;
    }
  }
  
  return nearest;
}

// ==========================================
// 矿石渲染辅助
// ==========================================

/**
 * 获取矿石的拾取文本信息
 * @param {string} oreType - 矿石类型
 * @param {number} amount - 数量
 * @returns {Object} {text, color}
 */
export function getOrePickupText(oreType, amount) {
  const config = ORE_TYPES[oreType];
  if (!config) {
    return { text: `未知矿石 +${amount}`, color: '#ffffff' };
  }
  
  return {
    text: `${config.name} +${amount}`,
    color: config.color
  };
}

/**
 * 绘制矿石进度条
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} cx - 中心X坐标
 * @param {number} cy - 中心Y坐标
 * @param {number} progress - 进度 (0-1)
 * @param {number} width - 进度条宽度
 * @param {number} height - 进度条高度
 */
export function drawOreProgress(ctx, cx, cy, progress, width = 30, height = 6) {
  const x = cx - (width >> 1);
  const y = cy + 12;
  
  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  
  // 进度条底色
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, width, height);
  
  // 进度
  ctx.fillStyle = '#06b6d4'; // 青色（钻石色）
  ctx.fillRect(x, y, Math.floor(width * progress), height);
}

// ==========================================
// 示例使用
// ==========================================

/**
 * 示例：完整的矿石挖掘流程
 * 
 * // 1. 生成矿石
 * const ores = generateOres(rocks, Math.random);
 * 
 * // 2. 检查能否挖掘
 * if (!canMineOre(player)) {
 *   showHint(getMineOreHint());
 *   return;
 * }
 * 
 * // 3. 查找目标矿石
 * const targetOre = findNearestOre(player.x, player.y, ores, 50);
 * 
 * // 4. 开始挖掘（6秒）
 * startMining(targetOre, ORE_CONFIG.MINE_TIME);
 * 
 * // 5. 完成后获得矿石
 * const amount = calculateOreDrop(targetOre.type, Math.random);
 * inventory[targetOre.type] += amount;
 * 
 * // 6. 显示拾取文本
 * const pickupInfo = getOrePickupText(targetOre.type, amount);
 * showPickupText(pickupInfo.text, pickupInfo.color);
 * 
 * // 7. 移除矿石
 * removeOre(ores, targetOre.id);
 */
