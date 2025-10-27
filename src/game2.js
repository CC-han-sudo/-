(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const TILE = 40; // 24x16 on 960x640
  const COLS = (canvas.width / TILE)|0;
  const ROWS = (canvas.height / TILE)|0;

// 自检：检测功能是否已加载
function featureSelfCheck() {
  return {
    preview: typeof drawPreview === 'function',       // 放置预览与射程圈
    enemies: typeof EnemyTypes === 'object'           // 多敌人类型与配表
  };
}

function drawSelfCheckOverlay() {
  const flags = featureSelfCheck();
  ctx.save();
  ctx.font = '12px Segoe UI, Microsoft YaHei';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // 背板
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#000';
  ctx.fillRect(8, 8, 180, 44);
  ctx.globalAlpha = 1;

  // 预览圈状态
  ctx.fillStyle = flags.preview ? '#27c93f' : '#ff5f56';
  ctx.beginPath(); ctx.arc(20, 20, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.fillText('预览圈', 34, 20);

  // 彩色敌人状态
  ctx.fillStyle = flags.enemies ? '#27c93f' : '#ff5f56';
  ctx.beginPath(); ctx.arc(20, 40, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#eee';
  ctx.fillText('彩色敌人', 34, 40);

  ctx.restore();
}

  // Greeting
  function getTimeGreeting(){const h=new Date().getHours();return h<11?'早上好':h<14?'中午好':h<18?'下午好':'晚上好'}
  function ensurePlayerName(){ let n=localStorage.getItem('td_player'); if(!n){ n=prompt('请输入你的昵称：')||'指挥官'; localStorage.setItem('td_player',n)} return n }
  function renderGreeting(){ const el=document.getElementById('greeting'); if(!el) return; el.textContent = `${getTimeGreeting()}，${ensurePlayerName()}！欢迎回来。`; }
  renderGreeting();

  // Maps
  const maps = {
    map1: [{x:0,y:8},{x:10,y:8},{x:10,y:3},{x:18,y:3},{x:18,y:13},{x:23,y:13}],
    map2: [{x:0,y:2},{x:6,y:2},{x:6,y:12},{x:14,y:12},{x:14,y:4},{x:23,y:4}],
    map3: [{x:0,y:10},{x:7,y:10},{x:7,y:6},{x:16,y:6},{x:16,y:10},{x:23,y:10}]
  };
  // 每张地图的主题色与透明度
  const MapThemes = {
    // 经典绿地 + 深棕道路
    map1: { path:'#232428', grid:'#1f1f24', pathAlpha: 0.18,
      pal:{
        grassBase:'#2e6a36', grassDark:'#275a2d', grassLight:'#357a3f', grassBlade:'#3e8a49',
        dirtBase:'#7a5a3a',  dirtDark:'#6b4d32',  dirtLight:'#8a6948',  track:'#000', trackAlpha:0.08
      }
    },
    // 偏冷青绿 + 冷灰道路
    map2: { path:'#2b354f', grid:'#1f273a', pathAlpha: 0.18,
      pal:{
        grassBase:'#245e54', grassDark:'#1f4e46', grassLight:'#2f7267', grassBlade:'#3a8f84',
        dirtBase:'#5c5664',  dirtDark:'#4d4856',  dirtLight:'#6d6776',  track:'#000', trackAlpha:0.07
      }
    },
    // 暖土黄草 + 红褐道路
    map3: { path:'#3a2f2b', grid:'#251f1d', pathAlpha: 0.18,
      pal:{
        grassBase:'#6a6e2e', grassDark:'#585b27', grassLight:'#7a7f35', grassBlade:'#90963f',
        dirtBase:'#8a5a48',  dirtDark:'#72483b',  dirtLight:'#a06c58',  track:'#000', trackAlpha:0.09
      }
    },
    clear:{ path:null,      grid:'#6c7380', pathAlpha: 0 } // 透明地图：不绘制路径
  };
  function currentTheme(){ return MapThemes[state.mapKey] || MapThemes.map1; }

  // 敌人种类（用于彩色敌人与波次配表）
  const EnemyTypes = {
    normal:     { name:'普通', color:'#c33',  hp: 60,  speed: 60,  reward: 10, immuneSlow: false },
    runner:     { name:'快跑', color:'#e88300', hp: 45,  speed: 95,  reward: 10, immuneSlow: false },
    tank:       { name:'坦克', color:'#8a5cff', hp: 140, speed: 45,  reward: 15, immuneSlow: false },
    immuneSlow: { name:'免减', color:'#33c38e', hp: 70,  speed: 70,  reward: 12, immuneSlow: true }
  };

  // State
  const state = {
    lives: 20, gold: 100, score: 0, wave: 1,
    inWave: false, spawnTimer: 0, enemiesToSpawn: 0,
    enemies: [], towers: [], bullets: [],
    selectedType: null, selectedTower: null,
    speed: 1, mapKey: 'map1', gridBlocked: new Set(), slows: new Map(),
    hoverGX: -1, hoverGY: -1,
    hoverTower: null,
    spawnQueue: []
  };

  function resetGridBlocked() {
    state.gridBlocked.clear();
    const wps = maps[state.mapKey];
    if (!wps) { return; }
    function lineTiles(a,b){const t=[]; let x=a.x,y=a.y; while(x!==b.x||y!==b.y){ t.push({x,y}); if(x<b.x)x++; else if(x>b.x)x--; else if(y<b.y)y++; else if(y>b.y)y--; } t.push({x:b.x,y:b.y}); return t }
    for (let i=0;i<wps.length-1;i++) for (const tt of lineTiles(wps[i], wps[i+1])) state.gridBlocked.add(`${tt.x},${tt.y}`);
  }
  function drawSelectedRange(){
    const t = state.selectedTower; if(!t) return;
    const cx = t.x, cy = t.y;
    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,6]);
    ctx.beginPath();
    ctx.arc(cx, cy, t.range, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  resetGridBlocked();

  // DOM
  const livesEl = document.getElementById('lives');
  const goldEl  = document.getElementById('gold');
  const scoreEl = document.getElementById('score');
  const waveEl  = document.getElementById('wave');
  const startBtn= document.getElementById('startBtn');
  const mapSelect = document.getElementById('mapSelect');
  const shopBtns = Array.from(document.querySelectorAll('.shop-item'));
  const spdBtns = Array.from(document.querySelectorAll('.spd'));

  const panel = document.getElementById('towerPanel');
  const panelName = document.getElementById('panelName');
  const panelLevel = document.getElementById('panelLevel');
  const panelDmg = document.getElementById('panelDmg');
  const panelRps = document.getElementById('panelRps');
  const panelRange = document.getElementById('panelRange');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const sellBtn = document.getElementById('sellBtn');
  const closePanelBtn = document.getElementById('closePanelBtn');

  // Towers config
  const TowerTypes = {
    basic:  { name:'基础塔',  price:25,  damage:22, range:120, rps:0.6,  maxLv:3, scale:{dmg:1.3, range:1.1, rps:1.15}, sellRate:0.6 },
    sniper: { name:'高伤塔',  price:45,  damage:45, range:110, rps:0.35, maxLv:3, scale:{dmg:1.35,range:1.05, rps:1.12}, sellRate:0.6 },
    slow:   { name:'减速塔',  price:35,  damage:10, range:130, rps:0.8,  maxLv:3, scale:{dmg:1.25,range:1.1,  rps:1.15}, sellRate:0.6, slow:{factor:0.65, secs:1.5} },
    splash: { name:'溅射塔',  price:50,  damage:18, range:115, rps:0.5,  maxLv:3, scale:{dmg:1.28,range:1.08, rps:1.12}, sellRate:0.6, splashRadius:50 }
  };

  // 同步商店按钮文案为动态价格
  function refreshShopLabels(){
    shopBtns.forEach(btn=>{
      const key = btn.dataset.type;
      const cfg = TowerTypes[key];
      if (cfg) btn.textContent = `${cfg.name}(${cfg.price})`;
    });
  }

  // Entities
  let ENEMY_SEQ = 0;
  class Enemy {
    constructor(typeKey) {
      this.id = ++ENEMY_SEQ;
      const tp = EnemyTypes[typeKey] || EnemyTypes.normal;
      const waveScale = 1 + (state.wave-1)*0.12;
      this.typeKey = typeKey;
      this.size = 22;
      this.baseSpeed = Math.round(tp.speed * (1 + (state.wave-1)*0.02));
      this.maxHp = Math.round(tp.hp * waveScale);
      this.hp = this.maxHp;
      this.reward = tp.reward + Math.floor(state.wave/3);
      this.immuneSlow = tp.immuneSlow;
      this.color = tp.color;
      const wp0 = maps[state.mapKey][0];
      this.pos = { x: wp0.x*TILE + TILE/2, y: wp0.y*TILE + TILE/2 };
      this.wpIndex = 1; this.alive = true;
    }
    getSpeed() {
      const slow = state.slows.get(this.id);
      if (!slow || this.immuneSlow) return this.baseSpeed;
      if (performance.now() > slow.until) { state.slows.delete(this.id); return this.baseSpeed; }
      return this.baseSpeed * slow.factor;
    }
    update(dt) {
      const wps = maps[state.mapKey]; const target = wps[this.wpIndex]; if (!target) return;
      const tx = target.x*TILE + TILE/2, ty = target.y*TILE + TILE/2;
      const dx = tx - this.pos.x, dy = ty - this.pos.y; const dist = Math.hypot(dx,dy)||1;
      const step = this.getSpeed() * dt;
      if (step >= dist) { this.pos.x = tx; this.pos.y = ty; this.wpIndex++; if (this.wpIndex >= wps.length) { this.alive = false; state.lives -= 1; updateHUD(); } }
      else { this.pos.x += dx/dist*step; this.pos.y += dy/dist*step; }
    }
    draw() {
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.pos.x,this.pos.y,this.size/2,0,Math.PI*2); ctx.fill();
      const pct = Math.max(0,this.hp)/this.maxHp; ctx.fillStyle='#222'; ctx.fillRect(this.pos.x-16,this.pos.y-20,32,5); ctx.fillStyle='#3c3'; ctx.fillRect(this.pos.x-16,this.pos.y-20,32*pct,5);
    }
  }

  class Tower {
    constructor(typeKey, gx, gy) {
      this.typeKey = typeKey; this.cfg = {...TowerTypes[typeKey]};
      this.level = 1; this.gx=gx; this.gy=gy; this.x=gx*TILE+TILE/2; this.y=gy*TILE+TILE/2; this.cooldown=0;
    }
    get name(){ return this.cfg.name }
    get range(){ return this.cfg.range }
    get rps(){ return this.cfg.rps }
    get damage(){ return this.cfg.damage }
    get price(){ return this.cfg.price }
    upgradeCost(){ return Math.floor(this.cfg.price * (0.7 + this.level*0.5)) }
    sellValue(){
      let val = this.cfg.price;
      for(let i=2;i<=this.level;i++){ val += Math.floor(this.cfg.price*(0.7+(i-1)*0.5)); }
      return Math.floor(val * 0.6);
    }
    applyLevelUp(){
      const s = TowerTypes[this.typeKey].scale;
      this.cfg.damage = Math.round(this.cfg.damage*s.dmg);
      this.cfg.range = Math.round(this.cfg.range*s.range);
      this.cfg.rps = +(this.cfg.rps*s.rps).toFixed(2);
      this.level++;
    }
    update(dt){
      this.cooldown -= dt;
      if (this.cooldown<=0){
        const target=acquireTarget(this.x,this.y,this.range);
        if(target){ fire(this,target); this.cooldown = 1/this.rps; }
      }
    }
    draw(){
      drawTowerSprite(this.x, this.y, this.typeKey, state.selectedTower===this);
      if (state.selectedTower===this){
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffd166';
        ctx.strokeRect(this.gx*TILE+4.5,this.gy*TILE+4.5,TILE-9,TILE-9);
        ctx.restore();
      }
    }
  }

  // 像素风小人持武器的塔模型渲染
  function drawTowerSprite(cx, cy, typeKey, selected){
    // 尺寸基于 TILE 40：小人约 20x26
    const px = (n)=>Math.round(n); // 像素对齐
    const x = cx - 10, y = cy - 13; // 左上角
    // 调色板
    const skin = '#f1c27d';
    const outline = '#1b1b1b';
    const uniform = typeKey==='sniper' ? '#2b3a4a' : typeKey==='slow' ? '#274a66' : typeKey==='splash' ? '#4a3a2b' : '#2e4a2b';
    const accent  = typeKey==='sniper' ? '#546e7a' : typeKey==='slow' ? '#6cc3ff' : typeKey==='splash' ? '#c9a66b' : '#4caf50';
    const steelDark = '#2f2f2f', steel = '#555', steelLight = '#c8ced6';
    const weapon  = typeKey==='sniper' ? steel : typeKey==='slow' ? '#7ec8ff' : typeKey==='splash' ? steel : steel;
    const stroke  = '#0e0e0e';

    // 辅助：带描边的小矩形（像素风轮廓）
    function box(rx, ry, rw, rh, fill, outlineColor=stroke){
      ctx.fillStyle = outlineColor; // 外描边
      ctx.fillRect(px(rx-1), px(ry-1), rw+2, 1);
      ctx.fillRect(px(rx-1), px(ry+rh), rw+2, 1);
      ctx.fillRect(px(rx-1), px(ry), 1, rh);
      ctx.fillRect(px(rx+rw), px(ry), 1, rh);
      ctx.fillStyle = fill;
      ctx.fillRect(px(rx), px(ry), rw, rh);
    }

    ctx.save();
    // 选中时轻微发光底板
    if(selected){ ctx.globalAlpha=0.12; ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(cx,cy,14,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }

    // 脚/鞋
    ctx.fillStyle = outline; ctx.fillRect(px(x+2), px(y+23), 6, 3); ctx.fillRect(px(x+12), px(y+23), 6, 3);
    // 裤子
    ctx.fillStyle = uniform; ctx.fillRect(px(x+3), px(y+18), 14, 6);
    // 上衣
    ctx.fillStyle = uniform; ctx.fillRect(px(x+2), px(y+11), 16, 8);
    // 肩章/徽记
    ctx.fillStyle = accent; ctx.fillRect(px(x+2), px(y+11), 3, 3); ctx.fillRect(px(x+15), px(y+11), 3, 3);
    // 头部
    ctx.fillStyle = skin; ctx.fillRect(px(x+6), px(y+5), 8, 8);
    // 帽子/头盔
    ctx.fillStyle = uniform; ctx.fillRect(px(x+5), px(y+3), 10, 4);
    // 眼睛（像素）
    ctx.fillStyle = outline; ctx.fillRect(px(x+8), px(y+8), 1, 1); ctx.fillRect(px(x+11), px(y+8), 1, 1);

    // 手臂与武器造型按塔类型差异
    ctx.fillStyle = skin;
    // 左臂
    ctx.fillRect(px(x+1), px(y+13), 3, 6);
    // 右臂
    ctx.fillRect(px(x+16), px(y+13), 3, 6);

    // 武器（更粗的形体+高对比描边+亮色枪口/晶体）
    if(typeKey==='basic'){
      // 步枪：更粗的枪身与明显枪托/枪口
      box(x+5,  y+14, 14, 3, steel);         // 枪身
      box(x+16, y+13, 4,  5, steelDark);     // 枪托
      box(x+3,  y+14, 3,  3, steelLight);    // 枪口
      ctx.fillStyle = steelLight; ctx.fillRect(px(x+10), px(y+13), 2, 1); // 上导轨高光
    } else if(typeKey==='sniper'){
      // 狙击：更长更粗，带明显瞄具与枪口制退器
      box(x+2,  y+13, 20, 3, steel);         // 长枪身
      box(x+19, y+12, 4,  5, steelDark);     // 枪托
      box(x+0,  y+13, 3,  3, steelLight);    // 枪口制退
      box(x+9,  y+11, 4,  3, accent);        // 瞄具
    } else if(typeKey==='slow'){
      // 冰杖移到左手侧，避免遮挡脸
      box(x+3,  y+10, 3,  14, '#2a3a48');    // 杖杆（更靠左）
      box(x+1,  y+7,  7,  4,  '#9fe1ff');    // 大冰晶（随之左移）
      ctx.globalAlpha=0.45; ctx.fillStyle='#bdeeff'; ctx.fillRect(px(x+0), px(y+6), 9, 2); ctx.globalAlpha=1; // 冰辉
      box(x+3,  y+9,  3,  2,  '#d7f6ff');    // 晶体高光
    } else if(typeKey==='splash'){
      // 榴弹发射器：粗圆筒与清晰机匣
      box(x+4,  y+14, 16, 4, steelDark);     // 机匣
      box(x+3,  y+13, 6,  3, steel);         // 弹筒
      box(x+16, y+13, 5,  3, accent);        // 护木
      ctx.fillStyle = steelLight; ctx.fillRect(px(x+7), px(y+12), 2, 1); // 上光
    }

    // 简单轮廓高光
    ctx.globalAlpha=0.15; ctx.fillStyle='#fff'; ctx.fillRect(px(x+2), px(y+11), 1, 12); ctx.globalAlpha=1;
    ctx.restore();
  }

  class Bullet {
    constructor(x,y,target,damage,meta){ this.x=x; this.y=y; this.target=target; this.damage=damage; this.meta=meta||{}; this.speed=420; this.alive=true; }
    update(dt){
      if(!this.target||!this.target.alive){ this.alive=false; return; }
      const dx=this.target.pos.x-this.x, dy=this.target.pos.y-this.y;
      const dist=Math.hypot(dx,dy)||1; const step=this.speed*dt;
      if(step>=dist){ onHit(this); this.alive=false; }
      else { this.x+=dx/dist*step; this.y+=dy/dist*step; }
    }
    draw(){ ctx.fillStyle=this.meta&&this.meta.color?this.meta.color:'#ffb400'; ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.fill(); }
  }

  function onHit(b){
    const t=b.target; if(!t.alive) return;
    t.hp -= b.damage;

    // slow
    if (b.meta&&b.meta.slow && !t.immuneSlow){
      state.slows.set(t.id,{ until: performance.now()+b.meta.slow.secs*1000, factor: b.meta.slow.factor });
    }
    // splash
    if (b.meta&&b.meta.splash){
      for(const e of state.enemies){
        if(!e.alive||e===t) continue;
        const d=Math.hypot(e.pos.x-t.pos.x, e.pos.y-t.pos.y);
        if(d<=b.meta.splash.radius){
          e.hp -= Math.floor(b.damage*0.6);
          if(e.hp<=0&&e.alive){ e.alive=false; state.gold+=e.reward; state.score+=5; }
        }
      }
    }
    if (t.hp<=0 && t.alive){ t.alive=false; state.gold+=t.reward; state.score+=5; updateHUD(); }
  }

  function acquireTarget(x,y,range){ let best=null, bd=Infinity; for(const e of state.enemies){ if(!e.alive) continue; const d=Math.hypot(e.pos.x-x,e.pos.y-y); if(d<=range && d<bd){ best=e; bd=d; } } return best }
  function fire(tower, target){
    const meta={};
    if(tower.typeKey==='slow') meta.slow = TowerTypes.slow.slow;
    if(tower.typeKey==='splash') meta.splash = {radius: TowerTypes.splash.splashRadius};
    if(tower.typeKey==='sniper') meta.color = '#ffa7a7';
    if(tower.typeKey==='slow') meta.color='#8df';
    if(tower.typeKey==='splash') meta.color='#ffd166';
    state.bullets.push(new Bullet(tower.x, tower.y, target, tower.damage, meta));
  }

  // 生成当前波次的敌人队列（彩色敌人）
  function getWavePlan(wave){
    const weights=[
      {k:'normal',w:Math.max(8-Math.floor(wave/3),2)},
      {k:'runner',w:Math.min(3+Math.floor(wave/4),8)},
      {k:'tank',w:Math.min(2+Math.floor(wave/5),6)},
      {k:'immuneSlow',w:Math.min(1+Math.floor(wave/6),5)}
    ];
    const total=weights.reduce((s,a)=>s+a.w,0);
    const count=9+Math.floor(wave*1.8);
    const arr=[];
    for(let i=0;i<count;i++){
      let r=Math.random()*total;
      for(const it of weights){ if((r-=it.w)<=0){ arr.push(it.k); break; } }
    }
    return arr;
  }

  function startWave(){ if(state.inWave) return; state.inWave=true; state.spawnQueue = getWavePlan(state.wave); state.spawnTimer=0; }
  function updateHUD(){ livesEl.textContent=state.lives; goldEl.textContent=state.gold; scoreEl.textContent=state.score; waveEl.textContent=state.wave; }

  startBtn.addEventListener('click',()=>{ if(!state.inWave) startWave(); });
  shopBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key = btn.dataset.type;
      const isActive = btn.classList.contains('active');
      // 切换选择：再次点击已选按钮则取消选择
      shopBtns.forEach(b=>b.classList.remove('active'));
      if (isActive) { state.selectedType = null; }
      else { btn.classList.add('active'); state.selectedType = key; }
    });
  });
  spdBtns.forEach(btn=> btn.addEventListener('click',()=>{ state.speed = +btn.dataset.speed; }));
  mapSelect.addEventListener('change',()=>{ state.mapKey = mapSelect.value; hardReset(); });

  // 初始化商店文案
  refreshShopLabels();

  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  // 预览用鼠标移动，记录悬停格
  canvas.addEventListener('mousemove',(e)=>{
    const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
    const gx=Math.floor(x/TILE), gy=Math.floor(y/TILE);
    if(gx>=0&&gx<COLS&&gy>=0&&gy<ROWS){ state.hoverGX=gx; state.hoverGY=gy; state.hoverTower = state.towers.find(t=>t.gx===gx&&t.gy===gy)||null; } else { state.hoverGX=-1; state.hoverGY=-1; state.hoverTower=null; }
  });
  canvas.addEventListener('mousedown',(e)=>{
    const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
    const gx=Math.floor(x/TILE), gy=Math.floor(y/TILE); const key=`${gx},${gy}`;
    const on=gx>=0&&gx<COLS&&gy>=0&&gy<ROWS; if(!on) return;

    // 右键：若当前选中了商店塔，则取消选中
    if(e.button===2 && state.selectedType){
      state.selectedType = null;
      shopBtns.forEach(b=>b.classList.remove('active'));
      return;
    }

    if(e.button===0){ // place/select
      const sel = state.towers.find(t=>t.gx===gx&&t.gy===gy);
      if (sel){ selectTower(sel); return; }
      // 点击空白处：取消选中塔
      hidePanel();
      if (state.gridBlocked.has(key)) return;
      if (!TowerTypes[state.selectedType]) return;
      const price = TowerTypes[state.selectedType].price;
      if (state.gold >= price){
        const t = new Tower(state.selectedType, gx, gy);
        state.towers.push(t); state.gold -= price; updateHUD(); selectTower(t);
      }
    } else if (e.button===2){ // remove/deselect
      const idx = state.towers.findIndex(t=>t.gx===gx&&t.gy===gy);
      if (idx>=0){
        if (e.shiftKey){ state.gold += state.towers[idx].sellValue(); state.towers.splice(idx,1); updateHUD(); hidePanel(); }
      } else { hidePanel(); }
    }
  });

  function selectTower(t){
    state.selectedTower = t; panel.hidden=false;
    panelName.textContent=t.name; panelLevel.textContent=t.level;
    panelDmg.textContent=t.damage; panelRps.textContent=t.rps; panelRange.textContent=t.range;
  }
  function hidePanel(){ state.selectedTower=null; panel.hidden=true; }
  upgradeBtn.addEventListener('click',()=>{
    const t=state.selectedTower; if(!t) return;
    if(t.level>=TowerTypes[t.typeKey].maxLv) return;
    const cost = t.upgradeCost();
    if(state.gold>=cost){ state.gold-=cost; t.applyLevelUp(); updateHUD(); selectTower(t); }
  });
  sellBtn.addEventListener('click',()=>{
    const t=state.selectedTower; if(!t) return;
    state.gold += t.sellValue();
    const i=state.towers.indexOf(t); if(i>=0) state.towers.splice(i,1);
    hidePanel(); updateHUD();
  });
  closePanelBtn.addEventListener('click', hidePanel);

  // Keyboard: Space pause, 1/2/3 speed
  window.addEventListener('keydown',(e)=>{
    if(e.code==='Space'){ e.preventDefault(); state.speed = state.speed===0?1:0; }
    else if(e.key==='1'){ state.speed=1 }
    else if(e.key==='2'){ state.speed=2 }
    else if(e.key==='3'){ state.speed=3 }
  });

  function hardReset(){
    state.lives=20; state.gold=100; state.score=0; state.wave=1;
    state.inWave=false; state.spawnTimer=0; state.spawnQueue=[];
    state.enemies.length=0; state.towers.length=0; state.bullets.length=0;
    hidePanel(); resetGridBlocked(); updateHUD();
  }

  // Loop
  let last=performance.now();
  function loop(now){
    const rawDt = Math.min(0.033,(now-last)/1000); last=now;
    const dt = rawDt * (state.speed===0?0:state.speed);
    update(dt); draw(); requestAnimationFrame(loop);
  }

  function update(dt){
    if(state.lives<=0) return;
    if(state.inWave){
      state.spawnTimer-=dt;
      if(state.spawnTimer<=0 && state.spawnQueue && state.spawnQueue.length>0){
        const typeKey = state.spawnQueue.shift();
        state.enemies.push(new Enemy(typeKey));
        state.spawnTimer = Math.max(0.25, 0.7 - state.wave*0.01);
      }
      if((!state.spawnQueue || state.spawnQueue.length===0) && state.enemies.every(e=>!e.alive)){
        state.inWave=false; state.wave+=1; updateHUD();
      }
    }
    for(const e of state.enemies) if(e.alive) e.update(dt);
    state.enemies = state.enemies.filter(e=>e.alive);
    for(const t of state.towers) t.update(dt);
    for(const b of state.bullets) if(b.alive) b.update(dt);
    state.bullets = state.bullets.filter(b=>b.alive);
  }

  // 使用顶部定义的 currentTheme()

  function drawGrid(){
    const th = currentTheme();
    // 仅在透明地图下绘制网格线，其它主题用像素风地表
    if (state.mapKey !== 'clear') return;
    ctx.strokeStyle = th.grid || '#1f1f24'; ctx.lineWidth=1;
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }
  }
  function drawPath(){
    const th = currentTheme();
    // 透明地图：不绘制地表
    if (!th.path && state.mapKey==='clear') return;

    // 像素风格草地/泥土渲染（确定性散斑，避免闪烁）
    function hash(x,y,seed){
      let n = x*73856093 ^ y*19349663 ^ seed;
      n = (n<<13) ^ n; // xorshift-like
      return (1.0 - ((n*(n*n*15731+789221)+1376312589) & 0x7fffffff)/1073741824.0); // [-1,1]
    }
    const pal = th.pal || { grassBase:'#2e6a36', grassDark:'#275a2d', grassLight:'#357a3f', grassBlade:'#3e8a49', dirtBase:'#7a5a3a', dirtDark:'#6b4d32', dirtLight:'#8a6948', track:'#000', trackAlpha:0.08 };
    function drawGrassTile(px,py,gx,gy){
      // 基础草地底色
      ctx.fillStyle = pal.grassBase;
      ctx.fillRect(px,py,TILE,TILE);
      // 随机深浅斑点
      for(let i=0;i<6;i++){
        const r = hash(gx+i,gy-i, i*97);
        if (r>0.15){
          const sx = px + ((i*7 + (gx*3+gy*5)) % (TILE-3));
          const sy = py + ((i*11 + (gx*5+gy*3)) % (TILE-3));
          ctx.fillStyle = r>0.55 ? pal.grassLight : pal.grassDark;
          ctx.fillRect(sx, sy, 3, 3);
        }
      }
      // 草梗点缀
      for(let i=0;i<3;i++){
        const sx = px + ((i*13 + gx*11) % (TILE-2));
        const sy = py + ((i*17 + gy*7)  % (TILE-2));
        ctx.fillStyle = pal.grassBlade;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    function drawDirtTile(px,py,gx,gy){
      // 基础泥土底色
      ctx.fillStyle = pal.dirtBase;
      ctx.fillRect(px,py,TILE,TILE);
      // 颗粒与石子
      for(let i=0;i<6;i++){
        const r = hash(gx-i,gy+i, i*131);
        if (r>0.10){
          const sx = px + ((i*9 + gx*7 + 3) % (TILE-3));
          const sy = py + ((i*5 + gy*9 + 5) % (TILE-3));
          ctx.fillStyle = r>0.6 ? pal.dirtDark : pal.dirtLight;
          ctx.fillRect(sx, sy, 3, 3);
        }
      }
      // 轮压浅痕
      ctx.globalAlpha = pal.trackAlpha ?? 0.08;
      ctx.fillStyle = pal.track || '#000';
      ctx.fillRect(px+4, py+TILE-8, TILE-8, 3);
      ctx.globalAlpha = 1;
    }

    // 绘制整张地图：路径=泥土；非路径=草地
    for(let gy=0; gy<ROWS; gy++){
      for(let gx=0; gx<COLS; gx++){
        const px = gx*TILE, py = gy*TILE;
        if (state.gridBlocked.has(`${gx},${gy}`)) drawDirtTile(px,py,gx,gy);
        else drawGrassTile(px,py,gx,gy);
      }
    }
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // 先绘制路径与网格
    drawPath(); drawGrid();
    // 再绘制放置预览，确保不被路径覆盖
    drawPreview();
    for(const t of state.towers) t.draw();
    for(const e of state.enemies) e.draw();
    for(const b of state.bullets) b.draw();
    // 若选中了已放置的塔，则显示射程圈
    drawSelectedRange();
    if(state.lives<=0) banner('游戏结束','#c33');
    else if(!state.inWave && state.enemies.length===0) banner('点击“开始/下一波”或继续建塔','#3c3');
    drawHoverUpgradeHint();
    // 最后叠加自检徽章，保证位于最上层
    drawSelfCheckOverlay();
  }

  // 放置预览与射程圈
  function canPlaceAt(gx, gy){
    if (gx<0||gx>=COLS||gy<0||gy>=ROWS) return false;
    if(state.gridBlocked.has(`${gx},${gy}`)) return false;
    if(state.towers.some(t=>t.gx===gx&&t.gy===gy)) return false;
    const type=TowerTypes[state.selectedType]; if(!type) return false;
    if(state.gold < type.price) return false; return true;
  }
  function drawPreview(){
    if(state.hoverGX<0) return;
    const type=TowerTypes[state.selectedType]; if(!type) return; // 未选择塔则不显示预览
    const gx=state.hoverGX, gy=state.hoverGY; const ok=canPlaceAt(gx,gy);
    ctx.globalAlpha=0.35; ctx.fillStyle=ok?'#4aa3ff':'#ff5c5c'; ctx.fillRect(gx*TILE+2,gy*TILE+2,TILE-4,TILE-4); ctx.globalAlpha=1;
    { const cx=gx*TILE+TILE/2, cy=gy*TILE+TILE/2; ctx.strokeStyle=ok?'#76d6ff':'#ff8a8a'; ctx.setLineDash([6,6]); ctx.beginPath(); ctx.arc(cx,cy,type.range,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
  }
  function drawHoverUpgradeHint(){
    if(state.selectedType) return;
    const t = state.hoverTower; if(!t) return;
    const maxLv = TowerTypes[t.typeKey].maxLv;
    if(t.level>=maxLv) return;
    const cost = t.upgradeCost();
    const text = `升级: ${cost}`;
    ctx.save();
    ctx.font = '12px Segoe UI, Microsoft YaHei';
    const w = ctx.measureText(text).width + 10;
    const cx = t.gx*TILE + TILE/2;
    let x = cx - w/2;
    let y = t.gy*TILE - 22; // 放在塔上方
    if (y < 4) y = 4; // 避免超出画布顶部
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x, y, w, 18);
    ctx.fillStyle = '#ffd166';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x+5, y+2);
    ctx.restore();
  }
  function banner(text,color){
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(180,260,600,120);
    ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='28px Segoe UI, Microsoft YaHei, sans-serif';
    ctx.fillText(text,480,320);
  }

  updateHUD(); requestAnimationFrame(loop);
})();