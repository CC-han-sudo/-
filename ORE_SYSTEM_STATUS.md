# 矿石系统实现状态

## ✅ 已完成功能

### 1. 碎石模型优化
- ✅ 石头精灵图简化为只保留下半部分（两块大石头+一块小碎石）
- ✅ 更简洁美观的视觉效果

### 2. 矿石精灵图生成
- ✅ 7种矿石类型：铜、锡、铁、银、金、黑金、钻石
- ✅ 基于碎石模型添加彩色矿点
- ✅ 矿石颜色配置：
  - 铜矿 `#d97706` (橙棕色)
  - 锡矿 `#94a3b8` (灰蓝色)
  - 铁矿 `#78716c` (棕灰色)
  - 银矿 `#e5e7eb` (浅灰色)
  - 金矿 `#fbbf24` (黄色)
  - 黑金矿 `#a16207` (深金色)
  - 钻石 `#06b6d4` (青色)

### 3. 矿石世界生成
- ✅ 矿石生成概率：15% of tree probability (比岩石更稀有)
- ✅ 稀有度分配：
  - 铜矿 30% (常见)
  - 锡矿 25% (常见)
  - 铁矿 20% (不常见)
  - 银矿 13% (稀有)
  - 金矿 8% (稀有)
  - 黑金矿 3% (非常稀有)
  - 钻石 1% (传说)
- ✅ 矿石避开树木、岩石、其他矿石（2×cell间距）

### 4. 镐子制作系统
- ✅ 镐子配方：3石块 + 2木棍 → 1镐子
- ✅ 在工作台合成系统中添加
- ✅ 开局背包给16个镐子

### 5. 矿石采集系统
- ✅ 需要装备镐子才能挖掘矿石
- ✅ 点击矿石时检测镐子装备状态
- ✅ 未装备镐子时显示提示："需要装备镐子才能挖掘矿石"
- ✅ 挖掘时间：6秒
- ✅ 自动寻路到矿石位置
- ✅ 挖掘完成后掉落1-2个对应矿石

### 6. 库存系统完善
- ✅ 添加所有矿石类型到inventory
- ✅ 添加pickaxe到inventory  
- ✅ invCount支持所有新物品
- ✅ invDec支持所有新物品
- ✅ clearInventory清理所有新物品
- ✅ resetInventoryToStarter初始化所有物品为16

### 7. 拾取系统
- ✅ 所有矿石类型的拾取逻辑
- ✅ 中文浮动文字：铜矿、锡矿、铁矿、银矿、金矿、黑金矿、钻石
- ✅ 对应颜色的拾取提示

### 8. 交互取消
- ✅ cancelTreeInteraction包含矿石挖掘取消
- ✅ 手动移动时取消所有交互

### 9. 世界重置
- ✅ regenerateTrees清理ores数组

---

## 🚧 待完成功能

### 1. 矿石渲染 (CRITICAL)
- ❌ drawOres()函数：渲染矿石精灵
- ❌ 选中矿石时显示指示箭头
- ❌ 在主渲染循环中调用drawOres()

### 2. 矿石挖掘进度条
- ❌ drawOreMineProgress()函数
- ❌ 显示6秒挖掘进度（青色进度条）
- ❌ 在主渲染循环中调用

### 3. 矿石碰撞检测
- ❌ collidesOre(x, y, rad)函数
- ❌ 玩家移动时检测矿石碰撞
- ❌ 敌人移动时检测矿石碰撞
- ❌ 放置物品时检测矿石碰撞

### 4. 矿石掉落物渲染
- ❌ drawDrops()中添加7种矿石的渲染
- ❌ 每种矿石使用对应颜色的圆形+描边

### 5. UI显示（背包/箱子/工作台）
- ❌ 添加镐子到列表显示
- ❌ 添加所有矿石到列表显示
- ❌ 设计镐子图标
- ❌ 设计矿石图标（带颜色的小方块）

---

## 📋 实现清单

### 需要添加的函数

```javascript
// 1. 矿石渲染
function drawOres(){
  if(STYLE==='pixlake' && tiles.ready){
    for(const ore of ores){
      const cx = Math.round(ore.x - camera.x);
      const cy = Math.round(ore.y - camera.y);
      const s = 2.8;
      // 阴影
      ctx.save(); 
      ctx.globalAlpha=0.28; 
      ctx.fillStyle='#000'; 
      ctx.beginPath(); 
      ctx.ellipse(cx, cy + Math.round(3*s), Math.round(6*s), Math.round(3*s), 0, 0, Math.PI*2); 
      ctx.fill(); 
      ctx.restore();
      // 绘制矿石精灵
      ctx.drawImage(tiles.ores[ore.type], cx - 8*s, cy - 8*s, 16*s, 16*s);
      // 选中指示
      if(selectedOreId === ore.id){
        const ax = cx, ay = cy - 16;
        ctx.save();
        ctx.fillStyle='#06b6d4'; 
        ctx.strokeStyle='#0891b2'; 
        ctx.lineWidth=1.5;
        ctx.beginPath(); 
        ctx.moveTo(ax, ay); 
        ctx.lineTo(ax-7, ay-10); 
        ctx.lineTo(ax+7, ay-10); 
        ctx.closePath(); 
        ctx.fill(); 
        ctx.stroke(); 
        ctx.restore();
      }
    }
    return;
  }
  // fallback
  for(const ore of ores){
    const cx = Math.round(ore.x - camera.x);
    const cy = Math.round(ore.y - camera.y);
    // 使用矿石颜色
    const colors = {
      copper: '#d97706', tin: '#94a3b8', iron: '#78716c',
      silver: '#e5e7eb', gold: '#fbbf24', darkGold: '#a16207', diamond: '#06b6d4'
    };
    ctx.fillStyle = colors[ore.type] || '#6b6b73';
    ctx.beginPath(); 
    ctx.arc(cx, cy, 10, 0, Math.PI*2); 
    ctx.fill();
    ctx.strokeStyle = '#4a4a52'; 
    ctx.lineWidth = 2; 
    ctx.stroke();
    if(selectedOreId === ore.id){
      const ax = cx, ay = cy - 16;
      ctx.save();
      ctx.fillStyle='#06b6d4'; 
      ctx.strokeStyle='#0891b2'; 
      ctx.lineWidth=1.5;
      ctx.beginPath(); 
      ctx.moveTo(ax, ay); 
      ctx.lineTo(ax-7, ay-10); 
      ctx.lineTo(ax+7, ay-10); 
      ctx.closePath(); 
      ctx.fill(); 
      ctx.stroke(); 
      ctx.restore();
    }
  }
}

// 2. 矿石挖掘进度条
function drawOreMineProgress(){
  if(!oreMine.active || oreMine.total<=0) return;
  const ore = ores.find(o=>o.id===oreMine.oreId);
  if(!ore) return;
  const pct = Math.max(0, Math.min(1, (oreMine.total - oreMine.time)/oreMine.total));
  const cx = Math.round(ore.x - camera.x);
  const cy = Math.round(ore.y - camera.y);
  const w = 30, h = 6, x = cx - (w>>1), y = cy + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; 
  ctx.fillRect(x-1, y-1, w+2, h+2);
  ctx.fillStyle = '#222'; 
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#06b6d4'; // 青色进度
  ctx.fillRect(x, y, Math.floor(w*pct), h);
}

// 3. 矿石碰撞检测
function collidesOre(x,y,rad){
  const r = (rad||8) + 8;
  const r2 = r*r;
  for(const ore of ores){ 
    const dx=ore.x-x, dy=ore.y-y; 
    if(dx*dx+dy*dy <= r2) return true; 
  }
  return false;
}
```

### 需要添加的渲染调用

在主渲染循环中（约3160行附近）：
```javascript
drawTrees();
drawRocks();
drawOres();        // ← 添加这里
drawChopProgress();
drawMineProgress();
drawOreMineProgress();  // ← 添加这里
drawPlayer();
```

### 需要更新的碰撞检测

```javascript
// 玩家移动 (约2482行)
if(!isWater(nx, player.y) && !collidesTree(nx, player.y, 10) && !collidesRock(nx, player.y, 10) && !collidesOre(nx, player.y, 10) && !collidesWall(nx, player.y, 6)) player.x = nx;
if(!isWater(player.x, ny) && !collidesTree(player.x, ny, 10) && !collidesRock(player.x, ny, 10) && !collidesOre(player.x, ny, 10) && !collidesWall(player.x, ny, 6)) player.y = ny;

// 敌人移动 (约2718行)
if(!isWater(ex, e.y) && !collidesTree(ex, e.y, e.r) && !collidesRock(ex, e.y, e.r) && !collidesOre(ex, e.y, e.r) && !blockedX) e.x = ex;
if(!isWater(e.x, ey) && !collidesTree(e.x, ey, e.r) && !collidesRock(e.x, ey, e.r) && !collidesOre(e.x, ey, e.r) && !blockedY) e.y = ey;

// 放置物品 (约674行, 1936行, 1945行, 1953行)
const valid = !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2));
```

---

## 🎮 使用指南

### 如何挖掘矿石
1. 在工作台用3石块+2木棍制作镐子
2. 装备镐子（将镐子移动到装备栏）
3. 探索世界寻找带彩色点的碎石
4. 点击矿石开始挖掘（6秒）
5. 获得对应的矿石

### 矿石稀有度
- **常见**：铜矿、锡矿（容易找到）
- **不常见**：铁矿（需要一些运气）
- **稀有**：银矿、金矿（较难找到）
- **非常稀有**：黑金矿（很难找到）
- **传说**：钻石（极其稀有，1%概率）

---

## 🔧 快速修复步骤

要完成剩余功能，按以下顺序：

1. **添加drawOres函数** - 复制drawRocks样式
2. **添加drawOreMineProgress函数** - 复制drawMineProgress样式
3. **添加collidesOre函数** - 复制collidesRock样式
4. **更新主渲染循环** - 添加drawOres()和drawOreMineProgress()调用
5. **更新所有碰撞检测** - 添加collidesOre检查

完成后矿石系统将完全可用！🎉
