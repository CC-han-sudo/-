# 背包配置说明

## 📦 当前配置

### 开局物品数量：每种16个

所有物品在游戏开始时都会给玩家16个，方便测试和体验。

### 当前物品列表

```javascript
const inventory = {
  gem: 16,          // 宝石
  wood: 16,         // 木材
  plank: 16,        // 木板
  stick: 16,        // 木棍
  workbench: 16,    // 工作台
  bow: 16,          // 弓
  apple: 16,        // 苹果
  stone: 16,        // 石块
  chest: 16,        // 箱子
  stoneAxe: 16,     // 石斧
  stoneWall: 16,    // 石墙
  stoneSword: 16,   // 石剑
  furnace: 16       // 熔炉
};
```

---

## 🔧 添加新物品时的步骤

当你想添加新物品时，需要在以下**4个位置**都添加：

### 1. 初始库存定义（第1430行）
```javascript
const inventory = { 
  gem: 16, wood: 16, ..., 
  newItem: 16  // ← 添加这里
};
```

### 2. clearInventory 函数（第336行）
```javascript
function clearInventory(){
  if(!inventory) return;
  inventory.gem=0; inventory.wood=0; ...; 
  inventory.newItem=0;  // ← 添加这里
}
```

### 3. resetInventoryToStarter 函数（第340行）
```javascript
function resetInventoryToStarter(){
  if(!inventory) return;
  inventory.gem=16; inventory.wood=16; ...; 
  inventory.newItem=16;  // ← 添加这里
}
```

### 4. invCount 函数（第1506行）
```javascript
function invCount(t){
  if(t==='gem') return inventory.gem;
  ...
  if(t==='newItem') return inventory.newItem;  // ← 添加这里
  return 0;
}
```

### 5. invDec 函数（第1522行）
```javascript
function invDec(t){
  if(t==='gem' && inventory.gem>0){ inventory.gem--; return true; }
  ...
  if(t==='newItem' && inventory.newItem>0){ inventory.newItem--; return true; }  // ← 添加这里
  return false;
}
```

### 6. UI显示（多处）

#### Chest UI（第156行）
```javascript
const rawEntries=[
  ...(inventory.gem>0? [{type:'gem', label:`宝石: ${inventory.gem}`}] : []),
  ...
  ...(inventory.newItem>0? [{type:'newItem', label:`新物品: ${inventory.newItem}`}] : []),  // ← 添加这里
];
```

#### Bench UI（第433行）
```javascript
const rawEntries=[
  ...(inventory.gem>0? [{type:'gem', label:`宝石: ${inventory.gem}`}] : []),
  ...
  ...(inventory.newItem>0? [{type:'newItem', label:`新物品: ${inventory.newItem}`}] : []),  // ← 添加这里
];
```

#### Backpack UI（第779行）
```javascript
const entries = [];
if(inventory.gem>0) entries.push({type:'gem', label:`宝石: ${inventory.gem}`});
...
if(inventory.newItem>0) entries.push({type:'newItem', label:`新物品: ${inventory.newItem}`});  // ← 添加这里
```

### 7. UI图标渲染（多处）

在chest、bench、backpack的渲染循环中添加：
```javascript
} else if(ent.type==='newItem'){
  // 绘制新物品图标
  ctx.fillStyle='#yourColor'; 
  ctx.fillRect(listX, curY+10, 20, 10);
}
```

---

## 🪨 石头模型更新

石头精灵图已从**圆形整块**改为**碎石堆**样式：

### 旧样式
- 一个大的不规则多边形
- 看起来像一整块岩石

### 新样式（碎石）
- 4个大小不等的石块（左上、右上、左下、右下）
- 3个小散落碎片
- 更自然的碎石堆效果

### 碎石布局
```
+----------------+
|  ▪▪▪    ▪▪▪   |  ← 上层：两块石头
|   ▪    ▪   ▪  |  ← 中层：小碎片
| ▪▪▪▪  ▪▪▪▪▪  |  ← 下层：两块较大石头
|  ▪▪    ▪▪▪    |
+----------------+
```

---

## ✅ 检查清单

添加新物品时，请确认：
- [ ] inventory 初始定义中添加（值为16）
- [ ] clearInventory 中添加（值为0）
- [ ] resetInventoryToStarter 中添加（值为16）
- [ ] invCount 中添加
- [ ] invDec 中添加
- [ ] Chest UI rawEntries 中添加
- [ ] Bench UI rawEntries 中添加
- [ ] Backpack UI entries 中添加
- [ ] Chest 列表渲染中添加图标
- [ ] Bench 列表渲染中添加图标
- [ ] Backpack 列表渲染中添加图标
- [ ] Chest grid slots 渲染中添加
- [ ] Bench grid slots 渲染中添加
- [ ] Backpack crafting slots 渲染中添加
- [ ] 拖拽图标渲染中添加
- [ ] 地面掉落物渲染中添加（如需要）

---

## 🎮 当前游戏状态

- ✅ 开局所有物品×16
- ✅ 石头改为碎石样式
- ✅ 完整的石头采集系统
- ✅ 4个石块合成配方
- ✅ 完整UI支持

享受游戏！🎉
