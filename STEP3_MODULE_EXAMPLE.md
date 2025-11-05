# 第3步：模块化示例 - 矿石系统

## ✅ 已完成的工作

### 1. 创建了独立的矿石系统模块
文件：`src/ore-system.js`

包含完整的矿石系统逻辑：
- ✅ 矿石配置（7种矿石类型、稀有度）
- ✅ 矿石生成算法
- ✅ 矿石交互逻辑
- ✅ 碰撞检测
- ✅ 渲染辅助函数

### 2. 模块化前后对比

#### 之前（在 sandbox.js 中散落各处）
```javascript
// 硬编码在不同位置
const oreColors = { copper: '#d97706', ... }; // 第205行
const MINE_TIME = 6.0;                       // 第XX行
// 生成逻辑散落在第1100-1200行
// 碰撞检测在第1250行
// 渲染在第3150行
```

#### 之后（集中管理）
```javascript
// 只需一行导入
import * as OreSystem from './ore-system.js';

// 使用清晰明了
const ores = OreSystem.generateOres(rocks, Math.random);
const canMine = OreSystem.canMineOre(player);
```

---

## 📖 如何使用矿石系统模块

### 方法1：在 sandbox.js 中使用（完整集成）

#### Step 1: 启用导入
```javascript
// sandbox.js 顶部
import * as OreSystem from './ore-system.js';
```

#### Step 2: 替换硬编码配置
```javascript
// 旧代码
const ORE_COLORS = {
  copper: '#d97706',
  tin: '#94a3b8',
  // ...
};

// 新代码
const ORE_COLORS = {};
for (const [type, config] of Object.entries(OreSystem.ORE_TYPES)) {
  ORE_COLORS[type] = config.color;
}
```

#### Step 3: 使用模块函数
```javascript
// 1. 生成矿石（在regenerateTrees函数中）
function regenerateTrees() {
  // ... 生成rocks之后
  ores.length = 0;
  const newOres = OreSystem.generateOres(rocks, world.rng.float.bind(world.rng));
  ores.push(...newOres);
  ORE_SEQ = ores.length;
}

// 2. 检查能否挖掘（在点击事件处理中）
if (clickedOre) {
  if (!OreSystem.canMineOre(player)) {
    centerHints.push({ 
      txt: OreSystem.getMineOreHint(), 
      until: performance.now() + 1200 
    });
    return;
  }
  // 开始挖掘...
}

// 3. 获得矿石（挖掘完成后）
const amount = OreSystem.calculateOreDrop(oreMine.oreType, Math.random);
inventory[oreMine.oreType] += amount;

const pickupInfo = OreSystem.getOrePickupText(oreMine.oreType, amount);
pickupTexts.push({
  x: player.x, 
  y: player.y - 10,
  txt: pickupInfo.text,
  color: pickupInfo.color,
  a: 1,
  vy: -28
});

// 4. 移除矿石
OreSystem.removeOre(ores, oreMine.oreId);

// 5. 碰撞检测
if (OreSystem.collidesWithOre(nx, player.y, ores, 10)) {
  // 阻止移动
}
```

---

### 方法2：独立测试（不修改主文件）

创建测试文件 `ore-system-test.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <title>矿石系统测试</title>
  <style>
    body { 
      font-family: monospace; 
      padding: 20px;
      background: #1a1a1a;
      color: #e6e6e6;
    }
    button { 
      padding: 10px 20px; 
      margin: 10px; 
      font-size: 16px;
      cursor: pointer;
    }
    #output {
      margin-top: 20px;
      padding: 15px;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      max-height: 500px;
      overflow-y: auto;
    }
    .ore-item {
      padding: 8px;
      margin: 5px 0;
      background: #333;
      border-left: 4px solid;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>🪨 矿石系统模块测试</h1>
  
  <button onclick="testGeneration()">生成矿石</button>
  <button onclick="testRarity()">测试稀有度</button>
  <button onclick="testMining()">模拟挖矿</button>
  <button onclick="testCollision()">碰撞检测</button>
  
  <div id="output"></div>

  <script type="module">
    import * as OreSystem from './src/ore-system.js';
    
    window.OreSystem = OreSystem; // 使全局可访问
    
    // 测试1：生成矿石
    window.testGeneration = function() {
      const rocks = [
        { x: 100, y: 100, id: 0 },
        { x: 200, y: 150, id: 1 },
        { x: 300, y: 200, id: 2 },
        { x: 400, y: 250, id: 3 },
        { x: 500, y: 300, id: 4 }
      ];
      
      const ores = OreSystem.generateOres(rocks, Math.random);
      
      const output = document.getElementById('output');
      output.innerHTML = `
        <h3>生成结果：</h3>
        <p>石头数量：${rocks.length}</p>
        <p>矿石数量：${ores.length}</p>
        <div>
          ${ores.map(ore => {
            const config = OreSystem.ORE_TYPES[ore.type];
            return `<div class="ore-item" style="border-color: ${config.color}">
              <strong>${config.name}</strong> (${ore.type}) - 位置: (${ore.x}, ${ore.y})
            </div>`;
          }).join('')}
        </div>
      `;
    };
    
    // 测试2：稀有度统计
    window.testRarity = function() {
      const samples = 10000;
      const counts = {};
      
      for (let i = 0; i < samples; i++) {
        const type = OreSystem.selectOreType(Math.random);
        counts[type] = (counts[type] || 0) + 1;
      }
      
      const output = document.getElementById('output');
      output.innerHTML = `
        <h3>稀有度统计（${samples}次采样）：</h3>
        <div>
          ${Object.entries(counts).map(([type, count]) => {
            const config = OreSystem.ORE_TYPES[type];
            const percentage = (count / samples * 100).toFixed(2);
            const expected = (config.rarity * 100).toFixed(2);
            return `<div class="ore-item" style="border-color: ${config.color}">
              <strong>${config.name}</strong>: ${count} 次 (${percentage}%)
              <br>期望概率: ${expected}%
            </div>`;
          }).join('')}
        </div>
      `;
    };
    
    // 测试3：模拟挖矿
    window.testMining = function() {
      const player = { equipped: 'pickaxe' };
      const canMine = OreSystem.canMineOre(player);
      
      const oreType = 'diamond';
      const drops = [];
      for (let i = 0; i < 10; i++) {
        drops.push(OreSystem.calculateOreDrop(oreType, Math.random));
      }
      
      const pickupInfo = OreSystem.getOrePickupText(oreType, 2);
      
      const output = document.getElementById('output');
      output.innerHTML = `
        <h3>挖矿模拟：</h3>
        <p>装备检查：${canMine ? '✅ 可以挖矿' : '❌ ' + OreSystem.getMineOreHint()}</p>
        <p>拾取文本：<span style="color: ${pickupInfo.color}">${pickupInfo.text}</span></p>
        <p>10次掉落测试：${drops.join(', ')} (平均: ${(drops.reduce((a,b)=>a+b,0)/drops.length).toFixed(2)})</p>
      `;
    };
    
    // 测试4：碰撞检测
    window.testCollision = function() {
      const ores = [
        { x: 100, y: 100, type: 'copper' },
        { x: 200, y: 200, type: 'gold' },
        { x: 300, y: 300, type: 'diamond' }
      ];
      
      const testPoints = [
        { x: 100, y: 100, desc: '矿石中心' },
        { x: 105, y: 105, desc: '靠近矿石' },
        { x: 150, y: 150, desc: '两矿石之间' },
        { x: 500, y: 500, desc: '远离矿石' }
      ];
      
      const output = document.getElementById('output');
      output.innerHTML = `
        <h3>碰撞检测：</h3>
        <div>
          ${testPoints.map(pt => {
            const collides = OreSystem.collidesWithOre(pt.x, pt.y, ores);
            const nearest = OreSystem.findNearestOre(pt.x, pt.y, ores);
            const dist = nearest ? Math.hypot(pt.x - nearest.x, pt.y - nearest.y).toFixed(1) : 'N/A';
            return `<div class="ore-item" style="border-color: ${collides ? '#ff4444' : '#44ff44'}">
              <strong>${pt.desc}</strong> (${pt.x}, ${pt.y})
              <br>碰撞：${collides ? '是' : '否'}
              <br>最近矿石距离：${dist}px
              ${nearest ? `(${OreSystem.ORE_TYPES[nearest.type].name})` : ''}
            </div>`;
          }).join('')}
        </div>
      `;
    };
  </script>
</body>
</html>
```

保存后在浏览器中打开即可测试！

---

## 📊 模块化收益

### 代码行数对比
| 项目 | 模块化前 | 模块化后 | 减少 |
|------|---------|---------|------|
| 矿石逻辑散落在主文件 | ~200行 | ~50行调用 | **-75%** |
| 配置管理 | 多处硬编码 | 集中在config | **统一** |
| 可测试性 | ❌ 困难 | ✅ 简单 | **大幅提升** |

### 开发效率提升
- 修改矿石颜色：1处 vs 3处
- 添加新矿石：1个配置 vs 修改7-8处代码
- 调整掉落率：1个常量 vs 搜索所有相关代码
- 单元测试：可以独立测试 vs 需要运行整个游戏

---

## 🎯 下一步建议

### 短期（本周）
- ✅ 已完成：提取矿石系统
- 🔜 提取工具系统（Tools System）
- 🔜 提取合成系统（Crafting System）

### 中期（下周）
- 🔜 提取UI渲染（UI Rendering）
- 🔜 提取战斗系统（Combat System）
- 🔜 提取世界生成（World Generation）

### 长期（下个月）
- 🔜 完全模块化所有系统
- 🔜 添加单元测试
- 🔜 使用构建工具优化

---

## 💡 使用建议

1. **渐进式迁移**：不要一次性替换所有代码，先让新旧代码并存
2. **保留旧代码作为注释**：方便对比和回退
3. **测试每个模块**：确保功能正确后再集成
4. **文档化**：为每个模块写清楚的使用说明

需要帮助集成矿石系统模块吗？我可以：
- 帮你修改 sandbox.js 使用模块
- 创建其他系统的模块
- 编写单元测试
