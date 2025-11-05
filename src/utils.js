// ==========================================
// UTILITY FUNCTIONS
// ==========================================
// 通用工具函数，用于减少代码重复

// ==========================================
// UI 渲染工具
// ==========================================

/**
 * 绘制矿石图标（灰色石头底座 + 3个彩色点）
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} color - 矿石颜色（十六进制）
 */
export function drawOreIcon(ctx, x, y, color) {
  // 绘制灰色石头底座
  ctx.fillStyle = '#6b6b73';
  ctx.fillRect(x, y, 8, 8);
  
  // 绘制3个彩色点
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, 2, 2);  // 右上点
  ctx.fillRect(x + 5, y + 3, 2, 2);  // 右下点
  ctx.fillRect(x + 1, y + 5, 2, 2);  // 左下点
}

/**
 * 绘制工具图标
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} type - 工具类型 ('pickaxe'|'stoneAxe'|'stoneSword')
 */
export function drawToolIcon(ctx, x, y, type) {
  switch(type) {
    case 'pickaxe':
      // 石镐：T型设计
      ctx.fillStyle = '#78716c'; // 手柄
      ctx.fillRect(x + 8, y + 8, 4, 12);
      ctx.fillStyle = '#6b6b73'; // 镐头
      ctx.fillRect(x + 6, y + 10, 8, 4);
      break;
      
    case 'stoneAxe':
      // 石斧：横向斧头
      ctx.fillStyle = '#78716c'; // 手柄
      ctx.fillRect(x + 8, y + 8, 4, 12);
      ctx.fillStyle = '#6b6b73'; // 斧头
      ctx.fillRect(x + 4, y + 10, 10, 6);
      break;
      
    case 'stoneSword':
      // 石剑：竖直长剑
      ctx.fillStyle = '#6b6b73'; // 剑身
      ctx.fillRect(x + 9, y + 8, 2, 14);
      ctx.fillStyle = '#78716c'; // 剑柄
      ctx.fillRect(x + 7, y + 20, 6, 4);
      break;
  }
}

/**
 * 绘制资源图标
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} type - 资源类型
 */
export function drawResourceIcon(ctx, x, y, type) {
  switch(type) {
    case 'gem':
      ctx.fillStyle = '#f5e663';
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 8);
      ctx.lineTo(x, y + 20);
      ctx.lineTo(x + 8, y + 32);
      ctx.lineTo(x + 16, y + 20);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'wood':
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(x, y + 10, 20, 10);
      ctx.fillStyle = '#a87945';
      ctx.fillRect(x, y + 14, 20, 4);
      break;
      
    case 'stone':
      ctx.fillStyle = '#6b6b73';
      ctx.fillRect(x + 2, y + 10, 16, 14);
      ctx.fillStyle = '#8a8a94';
      ctx.fillRect(x + 3, y + 11, 10, 8);
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(x + 8, y + 16, 8, 6);
      break;
      
    case 'plank':
      ctx.fillStyle = '#e0d4a3';
      ctx.fillRect(x, y + 10, 20, 10);
      ctx.fillStyle = '#b9a77c';
      ctx.fillRect(x, y + 14, 20, 4);
      break;
      
    case 'stick':
      ctx.fillStyle = '#c8aa7a';
      ctx.fillRect(x, y + 10, 20, 3);
      ctx.fillRect(x + 4, y + 16, 20, 3);
      break;
      
    case 'apple':
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + 10, y + 16, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.fillRect(x + 8, y + 8, 3, 4);
      break;
  }
}

// ==========================================
// 库存管理工具
// ==========================================

/**
 * 增加物品到库存
 * @param {Object} inventory - 库存对象
 * @param {string} type - 物品类型
 * @param {number} amount - 数量（默认1）
 */
export function addItem(inventory, type, amount = 1) {
  if (!inventory[type]) inventory[type] = 0;
  inventory[type] += amount;
}

/**
 * 从库存移除物品
 * @param {Object} inventory - 库存对象
 * @param {string} type - 物品类型
 * @param {number} amount - 数量（默认1）
 * @returns {boolean} 是否成功移除
 */
export function removeItem(inventory, type, amount = 1) {
  if (!inventory[type] || inventory[type] < amount) return false;
  inventory[type] -= amount;
  return true;
}

/**
 * 检查是否有足够的物品
 * @param {Object} inventory - 库存对象
 * @param {Object} requirements - 所需物品 {type: amount}
 * @returns {boolean} 是否满足条件
 */
export function hasItems(inventory, requirements) {
  return Object.entries(requirements).every(([type, count]) => 
    (inventory[type] || 0) >= count
  );
}

/**
 * 消耗物品（批量）
 * @param {Object} inventory - 库存对象
 * @param {Object} requirements - 所需物品 {type: amount}
 * @returns {boolean} 是否成功消耗
 */
export function consumeItems(inventory, requirements) {
  if (!hasItems(inventory, requirements)) return false;
  
  Object.entries(requirements).forEach(([type, count]) => {
    inventory[type] -= count;
  });
  
  return true;
}

// ==========================================
// 数学工具
// ==========================================

/**
 * 计算两点距离
 * @param {number} x1 - 点1的X坐标
 * @param {number} y1 - 点1的Y坐标
 * @param {number} x2 - 点2的X坐标
 * @param {number} y2 - 点2的Y坐标
 * @returns {number} 距离
 */
export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * 将值限制在范围内
 * @param {number} value - 值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 * @param {number} a - 起始值
 * @param {number} b - 结束值
 * @param {number} t - 插值因子（0-1）
 * @returns {number} 插值结果
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ==========================================
// 颜色工具
// ==========================================

/**
 * 十六进制转RGB
 * @param {string} hex - 十六进制颜色（#RRGGBB）
 * @returns {Object} {r, g, b}
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * RGB转十六进制
 * @param {number} r - 红色（0-255）
 * @param {number} g - 绿色（0-255）
 * @param {number} b - 蓝色（0-255）
 * @returns {string} 十六进制颜色
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * 使颜色变暗
 * @param {string} hex - 十六进制颜色
 * @param {number} factor - 变暗因子（0-1）
 * @returns {string} 变暗后的颜色
 */
export function darken(hex, factor) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return rgbToHex(
    clamp(Math.round(c.r * factor), 0, 255),
    clamp(Math.round(c.g * factor), 0, 255),
    clamp(Math.round(c.b * factor), 0, 255)
  );
}

// ==========================================
// 时间工具
// ==========================================

/**
 * 格式化时间为 HH:MM
 * @param {number} hours - 小时（可以是小数）
 * @returns {string} 格式化的时间
 */
export function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ==========================================
// 碰撞检测工具
// ==========================================

/**
 * 圆形碰撞检测
 * @param {number} x1 - 圆1的X坐标
 * @param {number} y1 - 圆1的Y坐标
 * @param {number} r1 - 圆1的半径
 * @param {number} x2 - 圆2的X坐标
 * @param {number} y2 - 圆2的Y坐标
 * @param {number} r2 - 圆2的半径
 * @returns {boolean} 是否碰撞
 */
export function circleCollision(x1, y1, r1, x2, y2, r2) {
  return distance(x1, y1, x2, y2) < (r1 + r2);
}

/**
 * 矩形碰撞检测
 * @param {Object} rect1 - {x, y, w, h}
 * @param {Object} rect2 - {x, y, w, h}
 * @returns {boolean} 是否碰撞
 */
export function rectCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.w &&
         rect1.x + rect1.w > rect2.x &&
         rect1.y < rect2.y + rect2.h &&
         rect1.y + rect1.h > rect2.y;
}

// ==========================================
// 日志工具
// ==========================================

/**
 * 简单的日志记录器
 */
export const Logger = {
  debug: (msg, data) => {
    if (window.DEBUG_MODE) {
      console.log(`[DEBUG] ${msg}`, data || '');
    }
  },
  
  info: (msg) => {
    console.log(`[INFO] ${msg}`);
  },
  
  warn: (msg) => {
    console.warn(`[WARN] ${msg}`);
  },
  
  error: (msg, error) => {
    console.error(`[ERROR] ${msg}`, error || '');
  }
};
