// ==========================================
// SANDBOX GAME - MAIN FILE
// ==========================================
// 一个16x16像素风格的沙盒生存游戏
// 包含：资源采集、合成、建造、战斗等系统
// ==========================================

// ES6 模块导入
// import { UI_CONFIG, COMBAT_CONFIG, ORE_CONFIG, GATHERING_CONFIG, HINTS } from './config.js';
// 注释掉导入，因为config.js中的配置目前仅作参考
// 实际使用时取消注释并替换代码中的硬编码值

(()=>{
  // ==========================================
  // SECTION 1: 初始化与配置
  // ==========================================
  
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Pixel-art style switch (phase 1): 'classic' | 'pixlake'
  const STYLE = 'pixlake';
  // chest sprite (single embedded pixel art)
  const chestImg = new Image(); let chestImgReady=false;
  // cow sprites (two frames for running animation)
  const cowImg1 = new Image(); let cowImg1Ready=false;
  const cowImg2 = new Image(); let cowImg2Ready=false;
  cowImg1.onload = () => { cowImg1Ready = true; };
  cowImg2.onload = () => { cowImg2Ready = true; };
  cowImg1.src = '素材/mow1.png';
  cowImg2.src = '素材/mow2.png';
  const cowImgReady = () => cowImg1Ready && cowImg2Ready; // 两张都加载完成才算ready
  (function buildChestSprite(){
    // Warm browns + bright gold to match reference
    const PAL = { K:'#3a1e18', D:'#5b2b21', M:'#7a3a26', L:'#9c5534', G:'#f2c500', H:'#ffe680', S:'#2b140f', ' ':'#00000000' };
    // Refined 16x16 pattern: taller top light band, thicker buckle, wider bottom shadow
    const GRID = [
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'LMMMMMMMMMMMMMML',
      'LMMMMMMMMMMMMMML',
      'LLGGGGGGGGGGGGLL',
      'LLGGGLLLHHLLGGLL',
      'LLGGGLLLHHLLGGLL',
      'LLGGGGGGGGGGGGLL',
      'LDDDDDDDDDDDDDDL',
      'LDDDDGGGGGGDDDDL',
      'LDDDDGGGGGGDDDDL',
      'LDDDDDDDDDDDDDDL',
      'LDDDDMMMMMMDDDDL',
      'LDDDDMMMMMMDDDDL',
      'LDDDDDDDDDDDDDDL',
      'LDDDDDDDDDDDDDDL',
    ];
    const px = 1; const h = GRID.length; const w = GRID[0].length;
    const cvs = document.createElement('canvas'); cvs.width=w*px; cvs.height=h*px; const ictx=cvs.getContext('2d'); ictx.imageSmoothingEnabled=false;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const ch = GRID[y][x] || ' ';
        ictx.fillStyle = PAL[ch] || '#ff00ff';
        ictx.fillRect(x*px, y*px, px, px);
      }
    }
    chestImg.onload=()=>{ chestImgReady=true; };
    chestImg.src = cvs.toDataURL('image/png');
  })();

  // --- Phase 1: embedded 16x16 tiles & sprites (no external assets) ---
  const tiles = { ready:false };
  function mkCvs(w=16,h=16){ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; return {c,x}; }
  function drawRect(x,clr,px,py,w,h){ x.fillStyle=clr; x.fillRect(px,py,w,h); }
  function genTiles(){
    const grass={};{ const {c,x}=mkCvs(); drawRect(x,'#2c5d30',0,0,16,16); // base
      // noise dots
      x.fillStyle='#306835'; for(let i=0;i<12;i++){ x.fillRect((i*7)%16, (i*11+3)%16, 1,1); }
      x.fillStyle='#264d29'; for(let i=0;i<10;i++){ x.fillRect((i*5+2)%16, (i*9+1)%16, 1,1); }
      grass.img=new Image(); grass.img.src=c.toDataURL('image/png'); }
    const sand={};{ const {c,x}=mkCvs(); drawRect(x,'#caa96a',0,0,16,16); x.fillStyle='#b99355'; for(let i=0;i<8;i++){ x.fillRect((i*6+1)%16,(i*7+4)%16,1,1);} sand.img=new Image(); sand.img.src=c.toDataURL('image/png'); }
    const waterDeep={};{ const {c,x}=mkCvs(); drawRect(x,'#1a4060',0,0,16,16); x.fillStyle='#215780'; for(let i=0;i<10;i++){ x.fillRect((i*6+3)%16,(i*5+2)%16,1,1);} waterDeep.img=new Image(); waterDeep.img.src=c.toDataURL('image/png'); }
    const waterShallow={};{ const {c,x}=mkCvs(); drawRect(x,'#256a96',0,0,16,16); x.fillStyle='#2e7fb3'; for(let i=0;i<8;i++){ x.fillRect((i*5+1)%16,(i*7+5)%16,1,1);} waterShallow.img=new Image(); waterShallow.img.src=c.toDataURL('image/png'); }
    const treeSprite={};{ const {c,x}=mkCvs(16,16);
      x.clearRect(0,0,16,16); x.imageSmoothingEnabled=false;
      // palette tuned to reference
      const COL={ out:'#182118', mid:'#2f6f3f', dark:'#214d2b', lite:'#4aa35a', trunk:'#704c31', trunkHi:'#8a6a4d' };
      // build canopy mask: 3 overlapping circles
      const mask=[]; for(let y=0;y<16;y++){ mask[y]=new Uint8Array(16); }
      const discs=[ {cx:8, cy:5, r:4}, {cx:9, cy:7, r:4}, {cx:7, cy:9, r:4} ];
      for(const d of discs){ const r2=d.r*d.r; for(let y=0;y<16;y++){ for(let x0=0;x0<16;x0++){ const dx=x0-d.cx, dy=y-d.cy; if(dx*dx+dy*dy<=r2) mask[y][x0]=1; } } }
      // draw fill with shading and highlight bands
      for(let y=0;y<16;y++){
        for(let x0=0;x0<16;x0++){
          if(!mask[y][x0]) continue;
          // simple lighting: top-right highlight, bottom shadow
          const light = (x0*0.7 - y*0.9);
          const base = COL.mid;
          let col = base;
          if(light>1.5 && y<=8) col = COL.lite; else if(y>=8) col = COL.dark;
          x.fillStyle=col; x.fillRect(x0, y, 1, 1);
        }
      }
      // no black outline per request; keep soft edge implied by shading
      // trunk and roots (bottom center)
      x.fillStyle=COL.trunk; x.fillRect(7,10,2,5); x.fillStyle=COL.trunkHi; x.fillRect(7,11,1,3);
      x.fillStyle=COL.trunk; x.fillRect(6,15,4,1);
      treeSprite.img=new Image(); treeSprite.img.src=c.toDataURL('image/png'); }
    // Rock sprite (16x16) - Gravel/rubble style (bottom half only)
    const rockSprite={};{ const {c,x}=mkCvs(16,16);
      x.clearRect(0,0,16,16); x.imageSmoothingEnabled=false;
      // Grey stone palette
      const ROCK={ dark:'#4a4a52', mid:'#6b6b73', lite:'#8a8a94', hi:'#a5a5b0' };
      // Large stone piece (bottom-left)
      x.fillStyle = ROCK.mid;
      x.fillRect(1,8,6,5); x.fillRect(2,7,3,1); x.fillRect(0,9,1,3);
      x.fillStyle = ROCK.hi; x.fillRect(2,8,3,1); x.fillRect(3,9,2,1);
      x.fillStyle = ROCK.dark; x.fillRect(1,12,5,1); x.fillRect(6,11,1,2);
      // Medium stone piece (bottom-right)
      x.fillStyle = ROCK.mid;
      x.fillRect(9,9,5,5); x.fillRect(10,8,3,1); x.fillRect(8,10,1,3);
      x.fillStyle = ROCK.hi; x.fillRect(10,9,2,1); x.fillRect(11,10,1,1);
      x.fillStyle = ROCK.dark; x.fillRect(9,13,4,1); x.fillRect(13,12,1,1);
      // Small scattered piece in middle
      x.fillStyle = ROCK.lite;
      x.fillRect(7,10,2,2);
      rockSprite.img=new Image(); rockSprite.img.src=c.toDataURL('image/png'); }
    // 4-way shoreline overlays (transparent background) for sand next to water
    function mkShore(dir){ const {c,x}=mkCvs(16,16); x.clearRect(0,0,16,16); x.imageSmoothingEnabled=false; x.fillStyle='#caa96a'; // sand color
      if(dir==='N'){ x.fillRect(0,0,16,5); x.fillStyle='#b99355'; for(let i=0;i<8;i++) x.fillRect((i*5+1)%16,3,1,1); }
      if(dir==='S'){ x.fillRect(0,11,16,5); x.fillStyle='#b99355'; for(let i=0;i<8;i++) x.fillRect((i*5+2)%16,12,1,1); }
      if(dir==='W'){ x.fillRect(0,0,5,16); x.fillStyle='#b99355'; for(let i=0;i<8;i++) x.fillRect(3,(i*5+1)%16,1,1); }
      if(dir==='E'){ x.fillRect(11,0,5,16); x.fillStyle='#b99355'; for(let i=0;i<8;i++) x.fillRect(12,(i*5+2)%16,1,1); }
      const img=new Image(); img.src=c.toDataURL('image/png'); return img; }
    tiles.shoreN = mkShore('N'); tiles.shoreS = mkShore('S'); tiles.shoreW = mkShore('W'); tiles.shoreE = mkShore('E');
    tiles.grass=grass.img; tiles.sand=sand.img; tiles.waterDeep=waterDeep.img; tiles.waterShallow=waterShallow.img; tiles.tree=treeSprite.img; tiles.rock=rockSprite.img;
    // Ore sprites (7 types: copper, tin, iron, silver, gold, darkGold, diamond)
    const ORE_COLORS = {
      copper: '#d97706',   // orange-brown
      tin: '#94a3b8',      // grey-blue  
      iron: '#78716c',     // brown-grey
      silver: '#e5e7eb',   // light grey
      gold: '#fbbf24',     // yellow
      darkGold: '#a16207', // dark gold
      diamond: '#06b6d4'   // cyan
    };
    tiles.ores = {};
    for(const [oreName, oreColor] of Object.entries(ORE_COLORS)){
      const oreSprite={}; const {c:oc,x:ox}=mkCvs(16,16);
      ox.clearRect(0,0,16,16); ox.imageSmoothingEnabled=false;
      // Draw base rock (same as rockSprite) - redefine ROCK palette
      const ROCK={ dark:'#4a4a52', mid:'#6b6b73', lite:'#8a8a94', hi:'#a5a5b0' };
      ox.fillStyle = ROCK.mid;
      ox.fillRect(1,8,6,5); ox.fillRect(2,7,3,1); ox.fillRect(0,9,1,3);
      ox.fillStyle = ROCK.hi; ox.fillRect(2,8,3,1); ox.fillRect(3,9,2,1);
      ox.fillStyle = ROCK.dark; ox.fillRect(1,12,5,1); ox.fillRect(6,11,1,2);
      ox.fillStyle = ROCK.mid;
      ox.fillRect(9,9,5,5); ox.fillRect(10,8,3,1); ox.fillRect(8,10,1,3);
      ox.fillStyle = ROCK.hi; ox.fillRect(10,9,2,1); ox.fillRect(11,10,1,1);
      ox.fillStyle = ROCK.dark; ox.fillRect(9,13,4,1); ox.fillRect(13,12,1,1);
      ox.fillStyle = ROCK.lite; ox.fillRect(7,10,2,2);
      // Add colored ore dots
      ox.fillStyle = oreColor;
      ox.fillRect(3,10,1,1); ox.fillRect(4,11,1,1); ox.fillRect(2,11,1,1);
      ox.fillRect(11,11,1,1); ox.fillRect(12,10,1,1); ox.fillRect(10,12,1,1);
      oreSprite.img=new Image(); oreSprite.img.src=oc.toDataURL('image/png');
      tiles.ores[oreName] = oreSprite.img;
    }
    tiles.ready=true;
  }
  genTiles();
  const seedView = document.getElementById('seedView');
  const regenBtn = document.getElementById('regen');
  const miniMinus = document.getElementById('miniMinus');
  const miniPlus = document.getElementById('miniPlus');
  const miniTimeEl = document.getElementById('miniTime');
  const miniCtrlEl = document.getElementById('miniCtrl');

  // Resize to fill window, keep pixel crisp
  function fit(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; ctx.imageSmoothingEnabled = false; }
  window.addEventListener('resize', fit); fit();

  // ==========================================
  // SECTION 2: 世界与相机
  // ==========================================
  
  // Camera and world
  const camera = { x:0, y:0, z:1 };

  // Procedural terrain setup
  function seededRNG(seed){
    let s = seed|0; if(!s) s = (Math.random()*0x7fffffff)|0;
    return { s,
      next(){ s = (s*1664525 + 1013904223) >>> 0; return s; },
      float(){ return (this.next()>>>8)/0xFFFFFF; },
      int(n){ return this.next()%n; }
    };
  }

  // ==========================================
  // SECTION 3: UI 渲染函数
  // ==========================================
  
  // -------------------- 工具函数 --------------------
  /**
   * 绘制矿石图标（灰色石头底座 + 3个彩色点）
   * @param {CanvasRenderingContext2D} ctx - 画布上下文
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {string} color - 矿石颜色（十六进制）
   */
  function drawOreIcon(ctx, x, y, color) {
    ctx.fillStyle = '#6b6b73'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + 10, y + 6, 4, 4);
    ctx.fillRect(x + 2, y + 10, 4, 4);
  }
  
  // 矿石配置
  const ORE_COLORS = {
    copper: '#d97706',
    tin: '#94a3b8',
    iron: '#78716c',
    silver: '#e5e7eb',
    gold: '#fbbf24',
    darkGold: '#a16207',
    diamond: '#06b6d4'
  };
  
  // -------------------- 箱子 UI --------------------
  function drawChestUI(){
    if(!chestOpen || !currentChest) return;
    const w = 600, h = 460;
    const x = (canvas.width - w) >> 1, y = (canvas.height - h) >> 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(24,24,24,0.96)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#666'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    ctx.fillStyle = '#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei'; ctx.textBaseline='top';
    ctx.fillText('箱子', x+12, y+10);
    // inventory list (left) with scrolling and hide zero-count
    const listX = x+20, listY = y+56, rowH=40;
    const rawEntries=[
      ...(inventory.gem>0? [{type:'gem', label:`宝石: ${inventory.gem}`}] : []),
      ...(inventory.wood>0? [{type:'wood', label:`木材: ${inventory.wood}`}] : []),
      ...(inventory.stone>0? [{type:'stone', label:`石块: ${inventory.stone}`}] : []),
      ...(inventory.plank>0? [{type:'plank', label:`木板: ${inventory.plank}`}] : []),
      ...(inventory.stick>0? [{type:'stick', label:`木棍: ${inventory.stick}`}] : []),
      ...(inventory.workbench>0? [{type:'workbench', label:`工作台: ${inventory.workbench}`}] : []),
      ...(inventory.chest>0? [{type:'chest', label:`箱子: ${inventory.chest}`}] : []),
      ...(inventory.bow>0? [{type:'bow', label:`弓: ${inventory.bow}${player.equipped==='bow'?' (已装备)':''}`}] : []),
      ...(inventory.pickaxe>0? [{type:'pickaxe', label:`石镐: ${inventory.pickaxe}${player.equipped==='pickaxe'?' (已装备)':''}`}] : []),
      ...(inventory.stoneAxe>0? [{type:'stoneAxe', label:`石斧: ${inventory.stoneAxe}${player.equipped==='stoneAxe'?' (已装备)':''}`}] : []),
      ...(inventory.stoneSword>0? [{type:'stoneSword', label:`石剑: ${inventory.stoneSword}${player.equipped==='stoneSword'?' (已装备)':''}`}] : []),
      ...(inventory.apple>0? [{type:'apple', label:`苹果: ${inventory.apple}`}] : []),
      ...(inventory.copper>0? [{type:'copper', label:`铜矿: ${inventory.copper}`}] : []),
      ...(inventory.tin>0? [{type:'tin', label:`锡矿: ${inventory.tin}`}] : []),
      ...(inventory.iron>0? [{type:'iron', label:`铁矿: ${inventory.iron}`}] : []),
      ...(inventory.silver>0? [{type:'silver', label:`银矿: ${inventory.silver}`}] : []),
      ...(inventory.gold>0? [{type:'gold', label:`金矿: ${inventory.gold}`}] : []),
      ...(inventory.darkGold>0? [{type:'darkGold', label:`黑金矿: ${inventory.darkGold}`}] : []),
      ...(inventory.diamond>0? [{type:'diamond', label:`钻石: ${inventory.diamond}`}] : []),
    ];
    ctx.fillStyle='#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei';
    const listViewportH = 200;
    const totalHChest = rawEntries.length * rowH;
    const maxScrollChest = Math.max(0, totalHChest - listViewportH);
    if(chestScroll < 0) chestScroll = 0; else if(chestScroll > maxScrollChest) chestScroll = maxScrollChest;
    ctx.save(); ctx.beginPath(); ctx.rect(listX-4, listY-4, 260, listViewportH+8); ctx.clip();
    let curY=listY - chestScroll; const listBounds=[];
    for(const ent of rawEntries){
      const rowTop = curY, rowBottom = curY + rowH;
      const visible = rowBottom >= listY && rowTop <= listY + listViewportH;
      if(!visible){ curY+=rowH; continue; }
      if(ent.type===backpackSelectedType){ ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2; ctx.strokeRect(listX+0.5, curY+0.5, 220-1, rowH-1); }
      if(ent.type==='gem'){
        ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(listX+8, curY+8); ctx.lineTo(listX, curY+20); ctx.lineTo(listX+8, curY+32); ctx.lineTo(listX+16, curY+20); ctx.closePath(); ctx.fill();
      } else if(ent.type==='wood'){
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#a87945'; ctx.fillRect(listX, curY+14, 20, 4);
      } else if(ent.type==='stone'){
        ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+2, curY+10, 16, 14); ctx.fillStyle='#8a8a94'; ctx.fillRect(listX+3, curY+11, 10, 8); ctx.fillStyle='#4a4a52'; ctx.fillRect(listX+8, curY+16, 8, 6);
      } else if(ent.type==='plank'){
        ctx.fillStyle='#e0d4a3'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#b9a77c'; ctx.fillRect(listX, curY+14, 20, 4);
      } else if(ent.type==='stick'){
        ctx.fillStyle='#c8aa7a'; ctx.fillRect(listX, curY+10, 20, 3); ctx.fillRect(listX+4, curY+16, 20, 3);
      } else if(ent.type==='workbench'){
        ctx.fillStyle='#6b7280'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#374151'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1);
      } else if(ent.type==='chest'){
        if(chestImgReady){ ctx.drawImage(chestImg, listX, curY+6, 24, 18); }
        else { ctx.fillStyle='#a16207'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#713f12'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1); }
      } else if(ent.type==='bow'){
        ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(listX+10, curY+15, 8, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(listX+10, curY+7); ctx.lineTo(listX+10, curY+23); ctx.stroke();
      } else if(ent.type==='pickaxe'){
        ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+6, curY+10, 8, 4);
      } else if(ent.type==='stoneAxe'){
        ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+4, curY+10, 10, 6);
      } else if(ent.type==='stoneSword'){
        ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+9, curY+8, 2, 14); ctx.fillStyle='#78716c'; ctx.fillRect(listX+7, curY+20, 6, 4);
      } else if(ORE_COLORS[ent.type]){
        drawOreIcon(ctx, listX+2, curY+10, ORE_COLORS[ent.type]);
      }
      ctx.fillStyle='#e6e6e6'; ctx.fillText(ent.label, listX+32, curY+6);
      listBounds.push({type: ent.type, x:listX, y:curY, w:220, h:rowH});
      curY+=rowH;
    }
    ctx.restore();
    // scrollbar
    const trackX = listX + 232, trackY = listY, trackW = 6, trackH = listViewportH;
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#2b2b2b'; ctx.fillRect(trackX, trackY, trackW, trackH);
    let thumbY = trackY, thumbH = trackH;
    if(maxScrollChest > 0){ thumbH = Math.max(18, Math.floor(trackH * (listViewportH / (totalHChest||1)))); const ratioSB = chestScroll / maxScrollChest; thumbY = Math.round(trackY + (trackH - thumbH) * ratioSB); }
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#6b7280'; ctx.fillRect(trackX+1, thumbY, trackW-2, thumbH);
    ctx.restore();
    // grid 4x8 on right (right-aligned)
    const cols=4, rows=8, cell=44, gap=8;
    const gridW = cols*cell + (cols-1)*gap, gridH = rows*cell + (rows-1)*gap;
    const gridX = x + w - gridW - 24, gridY = y + 56;
    chestLayout = { x,y,w,h, list:listBounds, slots:[], scrollbar:{x:trackX,y:trackY,w:trackW,h:trackH,thumbY,thumbH,maxScroll:maxScrollChest}, listViewport:{x:listX-4,y:listY-4,w:260,h:listViewportH+8} };
    ctx.strokeStyle='#888'; ctx.lineWidth=2;
    if(!currentChest.slots) currentChest.slots = new Array(32).fill(null);
    if(currentChest.slots.length < 32){ currentChest.slots.length = 32; for(let i=0;i<32;i++){ if(currentChest.slots[i]===undefined) currentChest.slots[i]=null; } }
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const idx = r*cols+c; const sx = gridX + c*(cell+gap); const sy = gridY + r*(cell+gap);
        ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(sx,sy,cell,cell);
        // reset border style per-cell to avoid color bleeding from item drawing
        ctx.strokeStyle='#888'; ctx.lineWidth=2; ctx.strokeRect(sx+0.5, sy+0.5, cell-1, cell-1);
        chestLayout.slots.push({x:sx,y:sy,w:cell,h:cell});
        const it = currentChest.slots[idx];
        if(it){
          if(it.type==='gem'){
            ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(sx+cell/2, sy+cell/2-10); ctx.lineTo(sx+cell/2-8, sy+cell/2); ctx.lineTo(sx+cell/2, sy+cell/2+10); ctx.lineTo(sx+cell/2+8, sy+cell/2); ctx.closePath(); ctx.fill();
          } else if(it.type==='wood'){
            ctx.fillStyle='#8b5a2b'; ctx.fillRect(sx+cell/2-14, sy+cell/2-6, 28, 12); ctx.fillStyle='#a87945'; ctx.fillRect(sx+cell/2-14, sy+cell/2-1, 28, 3);
          } else if(it.type==='stone'){
            ctx.fillStyle='#6b6b73'; ctx.fillRect(sx+cell/2-12, sy+cell/2-10, 24, 20); ctx.fillStyle='#8a8a94'; ctx.fillRect(sx+cell/2-10, sy+cell/2-8, 16, 12); ctx.fillStyle='#4a4a52'; ctx.fillRect(sx+cell/2-4, sy+cell/2+2, 12, 8);
          } else if(it.type==='plank'){
            ctx.fillStyle='#e0d4a3'; ctx.fillRect(sx+cell/2-16, sy+cell/2-8, 32, 16); ctx.fillStyle='#b9a77c'; ctx.fillRect(sx+cell/2-16, sy+cell/2-2, 32, 4);
          } else if(it.type==='stick'){
            ctx.fillStyle='#c8aa7a'; ctx.fillRect(sx+cell/2-14, sy+cell/2-1, 28, 3); ctx.fillRect(sx+cell/2-10, sy+cell/2+5, 28, 3);
          } else if(it.type==='workbench'){
            ctx.fillStyle='#6b7280'; ctx.fillRect(sx+cell/2-16, sy+cell/2-8, 32, 16); ctx.strokeStyle='#374151'; ctx.strokeRect(sx+cell/2-16+0.5, sy+cell/2-8+0.5, 32-1, 16-1);
          } else if(it.type==='chest'){
            if(chestImgReady){ ctx.drawImage(chestImg, sx+cell/2-16, sy+cell/2-16, 32, 32); }
            else { ctx.fillStyle='#a16207'; ctx.fillRect(sx+cell/2-16, sy+cell/2-8, 32, 16); ctx.strokeStyle='#713f12'; ctx.strokeRect(sx+cell/2-16+0.5, sy+cell/2-8+0.5, 32-1, 16-1); }
          } else if(it.type==='bow'){
            ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx+cell/2, sy+cell/2, 12, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(sx+cell/2, sy+cell/2-12); ctx.lineTo(sx+cell/2, sy+cell/2+12); ctx.stroke();
          } else if(it.type==='apple'){
            ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(sx+cell/2, sy+cell/2, 9, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#14532d'; ctx.fillRect(sx+cell/2-2, sy+cell/2-10, 4, 6);
          }
        }
      }
    }
    ctx.restore();
  }

  // Bow cone preview (shown when pressing G)
  function drawBowCone(){
    if(!showAggroRings) return;
    if(player.equipped!=='bow') return;
    const cx = Math.round(player.x - camera.x), cy = Math.round(player.y - camera.y);
    const aim = Math.atan2((mouse.y+camera.y)-player.y, (mouse.x+camera.x)-player.x);
    const pct = Math.max(0, Math.min(1, player.bowCharge / (player.bowChargeMax||1)));
    const baseSpread = Math.PI/4; // 45°
    let spread = baseSpread * (1 - pct);
    const pen = player.movePen||0;
    if(pen>0){ spread *= (1 + 0.5*pen); spread = Math.max(spread, (Math.PI/12)*pen); }
    const Rmax = (BOWCFG && BOWCFG.range) ? BOWCFG.range : 600;
    let Rcur = Rmax * (0.2 + 0.8*pct);
    if(pen>0) Rcur *= (1 - 0.5*pen);
    // filled wedge within current range
    ctx.save();
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#4ade80'; // greenish for current effective range
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Rcur, aim - spread, aim + spread);
    ctx.closePath(); ctx.fill();
    // outline
    ctx.globalAlpha = 0.75; ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, Rcur, aim - spread, aim + spread);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    // faint max range circle (yellow)
    ctx.globalAlpha = 0.20; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Rmax, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  function drawCenterHints(){
    if(centerHints.length===0) return;
    const now = performance.now();
    // remove expired
    for(let i=centerHints.length-1;i>=0;i--) if(now >= centerHints[i].until) centerHints.splice(i,1);
    if(centerHints.length===0) return;
    const h = centerHints[centerHints.length-1];
    const alpha = Math.max(0, Math.min(1, (h.until - now)/1200));
    const x = canvas.width/2, y = canvas.height - 100;
    ctx.save();
    ctx.globalAlpha = 0.6*alpha; ctx.fillStyle='rgba(0,0,0,0.6)';
    // background pill
    const padX=14, padY=8; ctx.font='16px Segoe UI, Microsoft YaHei';
    const tw = ctx.measureText(h.txt).width; const bw = tw + padX*2, bh = 30;
    ctx.fillRect(Math.round(x - bw/2), Math.round(y - bh/2), bw, bh);
    ctx.globalAlpha = alpha; ctx.fillStyle='#ffe0e0'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(h.txt, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function drawBenches(){
    for(const b of benches){
      const cx = Math.round(b.x - camera.x), cy = Math.round(b.y - camera.y);
      const sz = b.r*2;
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(cx - b.r, cy - b.r, sz, sz);
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 2; ctx.strokeRect(cx - b.r + 0.5, cy - b.r + 0.5, sz-1, sz-1);
    }
  }
  function drawChests(){
    for(const c of chests){
      const cx = Math.round(c.x - camera.x), cy = Math.round(c.y - camera.y);
      const sz = c.r*2;
      if(chestImgReady){
        // draw with slight perspective fit: scale to sz and center
        ctx.drawImage(chestImg, cx - c.r, cy - c.r, sz, sz);
      } else {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(cx - c.r, cy - c.r, sz, sz);
        ctx.strokeStyle = '#713f12'; ctx.lineWidth = 2; ctx.strokeRect(cx - c.r + 0.5, cy - c.r + 0.5, sz-1, sz-1);
      }
    }
  }
  
  function clearInventory(){
    if(!inventory) return;
    inventory.gem=0; inventory.wood=0; inventory.plank=0; inventory.stick=0; inventory.workbench=0; inventory.bow=0; inventory.apple=0; inventory.chest=0; inventory.stone=0; inventory.stoneAxe=0; inventory.stoneWall=0; inventory.stoneSword=0; inventory.furnace=0; inventory.pickaxe=0; inventory.copper=0; inventory.tin=0; inventory.iron=0; inventory.silver=0; inventory.gold=0; inventory.darkGold=0; inventory.diamond=0;
  }
  function resetInventoryToStarter(){
    if(!inventory) return;
    inventory.gem=16; inventory.wood=16; inventory.plank=16; inventory.stick=16; inventory.workbench=16; inventory.bow=16; inventory.apple=16; inventory.chest=16; inventory.stone=16; inventory.stoneAxe=16; inventory.stoneWall=16; inventory.stoneSword=16; inventory.furnace=16; inventory.pickaxe=16; inventory.copper=16; inventory.tin=16; inventory.iron=16; inventory.silver=16; inventory.gold=16; inventory.darkGold=16; inventory.diamond=16;
  }


  function attemptMelee(){
    if(melee.cd>0 || player.dead) return;
    // Block when low stamina (<10) or no food
    if((player.stamina||0) < 10 || (player.food||0) <= 0){
      const now = performance.now(); if(now - (lastHintAt||0) > 600){
        lastHintAt = now;
        const msg = (player.stamina||0)<10 ? '体力不足，无法近战' : '饥饿无法近战';
        centerHints.push({ txt: msg, until: now + 1200 });
      }
      return;
    }
    // Consume stamina and food on attack
    const sCost = (player.staminaMax||1) * 0.10;
    const fCost = (player.foodMax||1) * 0.01;
    player.stamina = Math.max(0, (player.stamina||0) - sCost);
    player.food = Math.max(0, (player.food||0) - fCost);
    const ang = Math.atan2((mouse.y+camera.y)-player.y, (mouse.x+camera.x)-player.x);
    melee.angle = ang; melee.activeUntil = performance.now() + MELEE.fxMs; melee.cd = MELEE.cd;
    sfxSlash();
    // hit detection cone
    for(const e of enemies){ if(!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y; const dist = Math.hypot(dx,dy);
      if(dist > MELEE.range + e.r) continue;
      const a = Math.atan2(dy, dx);
      let da = a - ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2;
      if(Math.abs(da) <= MELEE.half){
        // damage (armor/shield aware)
        const hadShield = (e.shield||0) > 0;
        const meleeDmg = (player.equipped==='stoneSword' ? MELEE.dmg * 2 : MELEE.dmg); // Stone sword 2x damage
        const applied = applyEnemyDamage(e, meleeDmg);
        e.showHpUntil = performance.now() + 800; if(!e.attack){ e.state='patrol'; e.patrolSince=performance.now(); } sfxHit();
        if(applied>0){
          // particles: white if shield active, else stronger red burst
          if(hadShield){
            for(let i=0;i<8;i++){ const ang=Math.random()*Math.PI*2, sp=70+Math.random()*90; particles.push({ x:e.x, y:e.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:2, a:0.9, color:'#ffffff', fade:1.8 }); }
          }else{
            for(let i=0;i<14;i++){ const ang=Math.random()*Math.PI*2, sp=90+Math.random()*150; particles.push({ x:e.x, y:e.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:2+Math.random()*1.8, a:1.0, color:'#ff1f1f', fade:2.4 }); }
          }
          damageTexts.push({ x:e.x, y:e.y - e.r - 6, vy:-28, a:1, text: `-${Math.round(applied)}` });
        }
        // knockback impulse
        const nx = dx/(dist||1), ny = dy/(dist||1);
        e.vx += nx * MELEE.kb; e.vy += ny * MELEE.kb;
        if(e.hp<=0){ e.alive=false; if(world.rng.float()<0.35){ const amt = 1 + world.rng.int(3); drops.push({x:e.x,y:e.y,r:6,a:1,val:amt,type:'gem'}); } }
      }
    }
  }

  function drawMeleeFX(){
    if(performance.now() > melee.activeUntil) return;
    const cx = Math.round(player.x - camera.x), cy = Math.round(player.y - camera.y);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(melee.angle);
    // Crescent (moon-slash): from runtime-adjustable params
    const R = Math.round(MELEE.range * slashFx.outerScale);
    const r = Math.round(MELEE.range * slashFx.innerScale);
    const off = slashFx.off;
    const ellYOuter = slashFx.ellYOuter;
    const ellYInner = slashFx.ellYInner;
    ctx.beginPath();
    // draw outer elliptical arc by scaling Y then drawing a circle at shifted center
    ctx.save();
    ctx.translate(off, 0);
    ctx.scale(1, ellYOuter);
    ctx.arc(0, 0, R, -MELEE.half, MELEE.half);
    ctx.restore();

    // inner arc (reverse) as ellipse at origin to carve shape (wider)
    ctx.save();
    ctx.scale(1, ellYInner);
    ctx.arc(0, 0, r, MELEE.half, -MELEE.half, true);
    ctx.restore();
    ctx.closePath();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#cfe9ff';
    ctx.fill('evenodd');
    // fine outline
    ctx.globalAlpha = 0.95; ctx.strokeStyle = '#9bd3ff'; ctx.lineWidth = 1; ctx.lineJoin='miter';
    ctx.stroke();
    ctx.restore();
  }

  // -------------------- 工作台 UI --------------------
  function drawWorkbenchUI(){
    if(!benchOpen || !currentBench) return;
    const w = 560, h = 360;
    const x = (canvas.width - w) >> 1, y = (canvas.height - h) >> 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(24,24,24,0.96)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#666'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    ctx.fillStyle = '#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei'; ctx.textBaseline='top';
    ctx.fillText('工作台', x+12, y+10);
    // inventory list (left) with scrolling and hide zero-count
    const listX = x+20, listY = y+56, rowH=40;
    const rawEntries=[
      ...(inventory.gem>0? [{type:'gem', label:`宝石: ${inventory.gem}`}] : []),
      ...(inventory.wood>0? [{type:'wood', label:`木材: ${inventory.wood}`}] : []),
      ...(inventory.stone>0? [{type:'stone', label:`石块: ${inventory.stone}`}] : []),
      ...(inventory.plank>0? [{type:'plank', label:`木板: ${inventory.plank}`}] : []),
      ...(inventory.stick>0? [{type:'stick', label:`木棍: ${inventory.stick}`}] : []),
      ...(inventory.workbench>0? [{type:'workbench', label:`工作台: ${inventory.workbench}`}] : []),
      ...(inventory.chest>0? [{type:'chest', label:`箱子: ${inventory.chest}`}] : []),
      ...(inventory.bow>0? [{type:'bow', label:`弓: ${inventory.bow}${player.equipped==='bow'?' (已装备)':''}`}] : []),
      ...(inventory.pickaxe>0? [{type:'pickaxe', label:`石镐: ${inventory.pickaxe}${player.equipped==='pickaxe'?' (已装备)':''}`}] : []),
      ...(inventory.stoneAxe>0? [{type:'stoneAxe', label:`石斧: ${inventory.stoneAxe}${player.equipped==='stoneAxe'?' (已装备)':''}`}] : []),
      ...(inventory.stoneSword>0? [{type:'stoneSword', label:`石剑: ${inventory.stoneSword}${player.equipped==='stoneSword'?' (已装备)':''}`}] : []),
      ...(inventory.apple>0? [{type:'apple', label:`苹果: ${inventory.apple}`}] : []),
      ...(inventory.copper>0? [{type:'copper', label:`铜矿: ${inventory.copper}`}] : []),
      ...(inventory.tin>0? [{type:'tin', label:`锡矿: ${inventory.tin}`}] : []),
      ...(inventory.iron>0? [{type:'iron', label:`铁矿: ${inventory.iron}`}] : []),
      ...(inventory.silver>0? [{type:'silver', label:`银矿: ${inventory.silver}`}] : []),
      ...(inventory.gold>0? [{type:'gold', label:`金矿: ${inventory.gold}`}] : []),
      ...(inventory.darkGold>0? [{type:'darkGold', label:`黑金矿: ${inventory.darkGold}`}] : []),
      ...(inventory.diamond>0? [{type:'diamond', label:`钻石: ${inventory.diamond}`}] : []),
    ];
    ctx.fillStyle='#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei';
    // Match backpack viewport height (200)
    const listViewportH = 200;
    const totalHBench = rawEntries.length * rowH;
    const maxScrollBench = Math.max(0, totalHBench - listViewportH);
    if(benchScroll < 0) benchScroll = 0; else if(benchScroll > maxScrollBench) benchScroll = maxScrollBench;
    ctx.save(); ctx.beginPath(); ctx.rect(listX-4, listY-4, 260, listViewportH+8); ctx.clip();
    let curY=listY - benchScroll; const listBounds=[]; const primaryBtnsLocal=[];
    for(const ent of rawEntries){
      const rowTop = curY, rowBottom = curY + rowH;
      const visible = rowBottom >= listY && rowTop <= listY + listViewportH;
      if(!visible){ curY+=rowH; continue; }
      // highlight selected row with a light border
      if(ent.type===backpackSelectedType){
        ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2;
        ctx.strokeRect(listX+0.5, curY+0.5, 220-1, rowH-1);
      }
      if(ent.type==='gem'){
        ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(listX+8, curY+8); ctx.lineTo(listX, curY+20); ctx.lineTo(listX+8, curY+32); ctx.lineTo(listX+16, curY+20); ctx.closePath(); ctx.fill();
      } else if(ent.type==='wood'){
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#a87945'; ctx.fillRect(listX, curY+14, 20, 4);
      } else if(ent.type==='stone'){
        ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+2, curY+10, 16, 14); ctx.fillStyle='#8a8a94'; ctx.fillRect(listX+3, curY+11, 10, 8); ctx.fillStyle='#4a4a52'; ctx.fillRect(listX+8, curY+16, 8, 6);
      } else if(ent.type==='plank'){
        ctx.fillStyle='#e0d4a3'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#b9a77c'; ctx.fillRect(listX, curY+14, 20, 4);
      } else if(ent.type==='stick'){
        ctx.fillStyle='#c8aa7a'; ctx.fillRect(listX, curY+10, 20, 3); ctx.fillRect(listX+4, curY+16, 20, 3);
      } else if(ent.type==='workbench'){
        ctx.fillStyle='#6b7280'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#374151'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1);
      } else if(ent.type==='chest'){
        if(chestImgReady){ ctx.drawImage(chestImg, listX, curY+6, 24, 18); }
        else { ctx.fillStyle='#a16207'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#713f12'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1); }
      } else if(ent.type==='bow'){
        // simple bow icon
        ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(listX+10, curY+15, 8, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(listX+10, curY+7); ctx.lineTo(listX+10, curY+23); ctx.stroke();
      } else if(ent.type==='pickaxe'){
        ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+6, curY+10, 8, 4);
      } else if(ent.type==='stoneAxe'){
        ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+4, curY+10, 10, 6);
      } else if(ent.type==='stoneSword'){
        ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+9, curY+8, 2, 14); ctx.fillStyle='#78716c'; ctx.fillRect(listX+7, curY+20, 6, 4);
      } else if(ORE_COLORS[ent.type]){
        drawOreIcon(ctx, listX+2, curY+10, ORE_COLORS[ent.type]);
      }
      ctx.fillStyle='#e6e6e6'; ctx.fillText(ent.label, listX+32, curY+6);
      listBounds.push({type: ent.type, x:listX, y:curY, w:220, h:rowH});
      // draw per-item primary button（与背包一致，仅对有意义的类型显示）
      if(ent.type===backpackSelectedType && (ent.type==='plank'||ent.type==='workbench'||ent.type==='chest'||ent.type==='bow'||ent.type==='pickaxe'||ent.type==='stoneAxe'||ent.type==='stoneSword'||ent.type==='apple')){
        const fontPrev = ctx.font; // restore later to avoid text shrinking
        // primary button
        let primaryLabel = '使用';
        if(ent.type==='workbench') primaryLabel='放置';
        if(ent.type==='chest') primaryLabel='放置';
        else if(ent.type==='bow') primaryLabel=(player.equipped==='bow'?'卸下':'使用');
        else if(ent.type==='pickaxe') primaryLabel=(player.equipped==='pickaxe'?'卸下':'使用');
        else if(ent.type==='stoneAxe') primaryLabel=(player.equipped==='stoneAxe'?'卸下':'使用');
        else if(ent.type==='stoneSword') primaryLabel=(player.equipped==='stoneSword'?'卸下':'使用');
        else if(ent.type==='apple') primaryLabel='食用';
        const btnW1=56; const uy = curY + 6; const ux = listX + 220 - 6 - btnW1;
        ctx.fillStyle='#2e7d32'; ctx.fillRect(ux, uy, btnW1, 24);
        ctx.strokeStyle='#1b5e20'; ctx.strokeRect(ux+0.5, uy+0.5, btnW1-1, 24-1);
        ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(primaryLabel, ux+btnW1/2, uy+12);
        primaryBtnsLocal.push({ x:ux, y:uy, w:btnW1, h:24, type: ent.type });
        // restore drawing defaults (use top baseline to keep rows aligned)
        ctx.font = fontPrev; ctx.textAlign='left'; ctx.textBaseline='top';
      }
      curY+=rowH;
    }
    ctx.restore();
    // 3x3 crafting grid
    const gridCols=3, gridRows=3, cellSz=64, gap=12;
    const gridW = gridCols*cellSz + (gridCols-1)*gap, gridH = gridRows*cellSz + (gridRows-1)*gap;
    const gridX = x + w - gridW - 24, gridY = y + 56;
    benchLayout = { x,y,w,h, list: listBounds, slots: [], primaryBtns: primaryBtnsLocal, listViewport: { x:listX-4, y:listY-4, w:260, h:listViewportH+8 } };
    // draw thin scrollbar (right of list area)
    const trackXb = listX + 232, trackYb = listY, trackWb = 6, trackHb = listViewportH;
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#2b2b2b'; ctx.fillRect(trackXb, trackYb, trackWb, trackHb);
    let thumbYb = trackYb, thumbHb = trackHb;
    if(maxScrollBench > 0){
      thumbHb = Math.max(18, Math.floor(trackHb * (listViewportH / (totalHBench||1))));
      const ratioSB = benchScroll / maxScrollBench;
      thumbYb = Math.round(trackYb + (trackHb - thumbHb) * ratioSB);
    }
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#6b7280'; ctx.fillRect(trackXb+1, thumbYb, trackWb-2, thumbHb);
    ctx.restore();
    benchLayout.scrollbar = { x: trackXb, y: trackYb, w: trackWb, h: trackHb, thumbY: thumbYb, thumbH: thumbHb, maxScroll: maxScrollBench };
    ctx.strokeStyle='#888'; ctx.lineWidth=2;
    if(!currentBench.slots) currentBench.slots = new Array(9).fill(null);
    for(let r=0;r<gridRows;r++){
      for(let c=0;c<gridCols;c++){
        const idx = r*gridCols + c; const sx = gridX + c*(cellSz+gap); const sy = gridY + r*(cellSz+gap);
        ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(sx,sy,cellSz,cellSz);
        ctx.strokeRect(sx+0.5, sy+0.5, cellSz-1, cellSz-1);
        benchLayout.slots.push({x:sx,y:sy,w:cellSz,h:cellSz});
        const it = currentBench.slots[idx];
        if(it){
          if(it.type==='gem'){
            ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(sx+cellSz/2, sy+cellSz/2-10); ctx.lineTo(sx+cellSz/2-8, sy+cellSz/2); ctx.lineTo(sx+cellSz/2, sy+cellSz/2+10); ctx.lineTo(sx+cellSz/2+8, sy+cellSz/2); ctx.closePath(); ctx.fill();
          } else if(it.type==='wood'){
            ctx.fillStyle='#8b5a2b'; ctx.fillRect(sx+cellSz/2-14, sy+cellSz/2-6, 28, 12); ctx.fillStyle='#a87945'; ctx.fillRect(sx+cellSz/2-14, sy+cellSz/2-1, 28, 3);
          } else if(it.type==='stone'){
            ctx.fillStyle='#6b6b73'; ctx.fillRect(sx+cellSz/2-12, sy+cellSz/2-10, 24, 20); ctx.fillStyle='#8a8a94'; ctx.fillRect(sx+cellSz/2-10, sy+cellSz/2-8, 16, 12); ctx.fillStyle='#4a4a52'; ctx.fillRect(sx+cellSz/2-4, sy+cellSz/2+2, 12, 8);
          } else if(it.type==='plank'){
            ctx.fillStyle='#e0d4a3'; ctx.fillRect(sx+cellSz/2-16, sy+cellSz/2-8, 32, 16); ctx.fillStyle='#b9a77c'; ctx.fillRect(sx+cellSz/2-16, sy+cellSz/2-2, 32, 4);
          } else if(it.type==='stick'){
            ctx.fillStyle='#c8aa7a'; ctx.fillRect(sx+cellSz/2-14, sy+cellSz/2-1, 28, 3); ctx.fillRect(sx+cellSz/2-10, sy+cellSz/2+5, 28, 3);
          } else if(it.type==='workbench'){
            ctx.fillStyle='#6b7280'; ctx.fillRect(sx+cellSz/2-16, sy+cellSz/2-8, 32, 16); ctx.strokeStyle='#374151'; ctx.strokeRect(sx+cellSz/2-16+0.5, sy+cellSz/2-8+0.5, 32-1, 16-1);
          }
        }
      }
    }
    // Bench crafting preview + button
    const recipe = benchGetRecipe(currentBench.slots||[]);
    benchLayout.craftBtn = null;
    if(recipe){
      // preview label
      const label = `可合成：${recipe.label}`;
      ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(label, x+20, y+h-30);
      // craft button
      const btnW=72, btnH=26, bx=x+w-24-btnW, by=y+h-36;
      ctx.fillStyle='#2e7d32'; ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle='#1b5e20'; ctx.strokeRect(bx+0.5, by+0.5, btnW-1, btnH-1);
      ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('制作', bx+btnW/2, by+btnH/2);
      benchLayout.craftBtn = { x:bx, y:by, w:btnW, h:btnH };
    }
    // drag item
    if(dragItem){ const mx=mouse.x,my=mouse.y; if(dragItem.type==='gem'){ ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(mx, my-10); ctx.lineTo(mx-10, my); ctx.lineTo(mx, my+10); ctx.lineTo(mx+10, my); ctx.closePath(); ctx.fill(); } else if(dragItem.type==='wood'){ ctx.fillStyle='#8b5a2b'; ctx.fillRect(mx-12,my-6,24,12); ctx.fillStyle='#a87945'; ctx.fillRect(mx-12,my-1,24,3);} else if(dragItem.type==='plank'){ ctx.fillStyle='#e0d4a3'; ctx.fillRect(mx-14,my-7,28,14); ctx.fillStyle='#b9a77c'; ctx.fillRect(mx-14,my-2,28,4);} else if(dragItem.type==='workbench'){ ctx.fillStyle='#6b7280'; ctx.fillRect(mx-14,my-7,28,14); ctx.strokeStyle='#374151'; ctx.strokeRect(mx-14+0.5,my-7+0.5,28-1,14-1);} }
    ctx.restore();
  }

  // Determine bench recipe from 3x3 slots. Very simple sample rules.
  function benchGetRecipe(slots){
    const cnt={wood:0, plank:0, stick:0, stone:0}; const idxs={wood:[], plank:[], stick:[], stone:[]};
    for(let i=0;i<slots.length;i++){ const it=slots[i]; if(!it) continue; if(cnt[it.type]!=null){ cnt[it.type]++; idxs[it.type].push(i); } }
    // Check for 2x2 plank square anywhere (workbench)
    const twoByTwoSets = [ [0,1,3,4],[1,2,4,5],[3,4,6,7],[4,5,7,8] ];
    for(const set of twoByTwoSets){ if(set.every(i=>slots[i]?.type==='plank')){
      return { label:'工作台 ×1', make:()=>{ inventory.workbench=(inventory.workbench||0)+1; }, take:[...set] };
    }}
    // 8 planks around center (index 4 empty) -> chest
    const ring = [0,1,2,3,5,6,7,8];
    if(ring.every(i=>slots[i]?.type==='plank') && !slots[4]){
      return { label:'箱子 ×1', make:()=>{ inventory.chest=(inventory.chest||0)+1; }, take:[...ring] };
    }
    // 8 stones around center -> furnace
    if(ring.every(i=>slots[i]?.type==='stone') && !slots[4]){
      return { label:'熔炉 ×1', make:()=>{ inventory.furnace=(inventory.furnace||0)+1; }, take:[...ring] };
    }
    // 4 stones -> stone wall
    if(cnt.stone>=4){
      for(const set of twoByTwoSets){ if(set.every(i=>slots[i]?.type==='stone')){
        return { label:'石墙 ×1', make:()=>{ inventory.stoneWall=(inventory.stoneWall||0)+1; }, take:[...set] };
      }}
    }
    // Pickaxe: 2 sticks + 3 stones
    if(cnt.stick>=2 && cnt.stone>=3){
      return { label:'石镐 ×1', make:()=>{ inventory.pickaxe=(inventory.pickaxe||0)+1; }, take:[...idxs.stick.slice(0,2), ...idxs.stone.slice(0,3)] };
    }
    // Stone axe: 2 sticks + 2 stones (stick on top)
    if(cnt.stick>=2 && cnt.stone>=2){
      return { label:'石斧 ×1', make:()=>{ inventory.stoneAxe=(inventory.stoneAxe||0)+1; }, take:[...idxs.stick.slice(0,2), ...idxs.stone.slice(0,2)] };
    }
    // Stone sword: 1 stick + 2 stones
    if(cnt.stick>=1 && cnt.stone>=2){
      return { label:'石剑 ×1', make:()=>{ inventory.stoneSword=(inventory.stoneSword||0)+1; }, take:[...idxs.stick.slice(0,1), ...idxs.stone.slice(0,2)] };
    }
    // Priority: bow (3 sticks) > sticks (2 planks) > plank (2 wood)
    if(cnt.stick>=3){ return { label:'弓 ×1', make:()=>{ inventory.bow=(inventory.bow||0)+1; }, take:[...idxs.stick.slice(0,3)] }; }
    if(cnt.plank>=2){ return { label:'木棍 ×4', make:()=>{ inventory.stick=(inventory.stick||0)+4; }, take:[...idxs.plank.slice(0,2)] }; }
    if(cnt.wood>=2){ return { label:'木板 ×1', make:()=>{ inventory.plank=(inventory.plank||0)+1; }, take:[...idxs.wood.slice(0,2)] }; }
    return null;
  }

  function performBenchCraft(){
    if(!benchOpen||!currentBench) return false;
    const recipe = benchGetRecipe(currentBench.slots||[]);
    if(!recipe) return false;
    // consume inputs
    for(const i of recipe.take){ currentBench.slots[i]=null; }
    // produce output
    try{ recipe.make(); sfxPickup(); }catch(_){ }
    return true;
  }

  function drawDebugPanel(){
    if(!showAggroRings) return;
    // find nearest enemy to player (or to mouse if needed)
    let ne=null, nd=1e9; for(const e of enemies){ if(!e.alive) continue; const d=Math.hypot(e.x-player.x,e.y-player.y); if(d<nd){ nd=d; ne=e; } }
    const lines=[];
    if(ne){
      const nowMs = performance.now();
      const effSpd = getEnemySpeed(ne, nowMs).toFixed(1);
      const buffLeft = ne.speedBuffUntil? Math.max(0, (ne.speedBuffUntil-nowMs)/1000).toFixed(2) : '0.00';
      const chargeLeft = ne.charging? Math.max(0, (ne.chargingUntil-nowMs)/1000).toFixed(2) : '0.00';
      lines.push(`敌人: ${ne.type}`);
      lines.push(`HP: ${Math.round(ne.hp)}/${Math.round(ne.hpMax)}`);
      if((ne.shieldMax||0)>0){ lines.push(`盾: ${Math.round(ne.shield||0)}/${Math.round(ne.shieldMax)}  甲: ${Math.round(ne.armor||0)}（仅盾>0生效）`); }
      lines.push(`r: ${ne.r}  wallR: ${ne.wallR||6}`);
      lines.push(`aggro: ${ne.aggro}  alert: ${(ne.aggro*1.5).toFixed(0)}`);
      lines.push(`spd: ${ne.spd.toFixed(1)}  eff: ${effSpd}`);
      if(ne.type==='brute'){
        lines.push(`charging: ${ne.charging? 'Y':''} ${chargeLeft}s  shoutCD: ${ne.nextShoutAt? Math.max(0, (ne.nextShoutAt-nowMs)/1000).toFixed(2):'--'}s  buffLeft: ${buffLeft}s x${ne.speedBuffMul||1.35}`);
        lines.push(`砸墙伤害: 28  呐喊半径: 220`);
      }
    }
    lines.push(`墙默认HP: 60  spawn: ${spawnEnabled? 'ON':'OFF'}  网格: ${cell}px`);
    // world-gen params
    lines.push(`Chunk:${worldGen.chunkSize} pad:${worldGen.chunkPad}  远距散怪: base${worldGen.enemyChunkSpawnTriesBase}+rand${worldGen.enemyChunkSpawnTriesRand}`);
    lines.push(`软上限:${worldGen.enemySoftCap}  最小刷距:${worldGen.enemyMinDist}  密度半径:${worldGen.densityRadius}  目标密度:${worldGen.densityTarget}`);
    // slash FX params
    lines.push(`剑气 外:${slashFx.outerScale.toFixed(3)} 内:${slashFx.innerScale.toFixed(3)} off:${slashFx.off} yOut:${slashFx.ellYOuter.toFixed(2)} yIn:${slashFx.ellYInner.toFixed(2)}`);
    // bow debug (when equipped)
    if(player.equipped==='bow'){
      const chargePct = Math.max(0, Math.min(1, player.bowCharge / (player.bowChargeMax||1)));
      const baseSpread = Math.PI/4; // 45°
      let spread = baseSpread * (1 - chargePct);
      const moving = player.moving;
      // apply current penalty factor (0..1)
      const pen = player.movePen||0;
      if(pen>0){ spread *= (1 + 0.5*pen); spread = Math.max(spread, (Math.PI/12)*pen); }
      const spreadDeg = (spread * 180/Math.PI).toFixed(1);
      let rangeCur = (BOWCFG?BOWCFG.range:600) * (0.2 + 0.8*chargePct);
      if(pen>0) rangeCur *= (1 - 0.5*pen);
      lines.push(`弓 充能:${(chargePct*100).toFixed(0)}% 移动:${moving?'Y':'N'}`);
      lines.push(`弓 射程: 当前${Math.round(rangeCur)} / 最大${BOWCFG?BOWCFG.range:600} 像素  锥角:${spreadDeg}°`);
      lines.push(`箭矢数量（木棍）: ${inventory.stick||0}`);
      // penalty line: rising/recovering/idle
      let pStatus = 'idle';
      if(moving && pen<1) pStatus = '增长';
      else if(!moving && pen>0) pStatus = '恢复中';
      else if(moving && pen>=1) pStatus = '增长';
      lines.push(`移动惩罚: ${(pen*100).toFixed(0)}%（${pStatus}）`);
      // charge reduction due to moving (while charging)
      if(player.bowCharging){
        const maxReduce = 0.2*(player.bowChargeMax||1);
        const left = Math.max(0, player._moveReduceLeft||0);
        const reduced = Math.max(0, maxReduce - left);
        const reducedPct = (reduced/Math.max(1e-6, player.bowChargeMax))*100;
        const crStatus = moving? '进行中' : (left>0? '恢复中':'');
        lines.push(`充能移动扣减: ${reducedPct.toFixed(0)}% / 20%（${crStatus||'--'}）`);
      }
    }
    // draw panel
    const pad=8, lh=16, w=360, h=pad*2 + lh*lines.length;
    const x = Math.round((canvas.width - w)/2);
    const y = 8;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
    ctx.fillStyle='#e6e6e6'; ctx.font='12px Segoe UI, Microsoft YaHei'; ctx.textBaseline='top';
    for(let i=0;i<lines.length;i++) ctx.fillText(lines[i], x+8, y+4 + i*lh);
    ctx.restore();
  }

  function getEnemySpeed(e, now){
    let s = e.spd;
    if(e.speedBuffUntil && now < e.speedBuffUntil){ s *= (e.speedBuffMul||1.25); }
    if(e.charging){ s *= (e.chargeMul||2.2); }
    return s;
  }

  function drawPlacementPreview(){
    if(!placeMode.active) return;
    const r = { x: mouse.x, y: mouse.y };
    const wp = toWorld(r.x, r.y);
    const sx = snapCenterX(wp.x), sy = snapCenterY(wp.y);
    const tooClosePlayer = Math.hypot(sx - player.x, sy - player.y) <= (cell/2 + 12);
    // use a slightly smaller radius for overlap test so neighboring cells are allowed
    const valid = !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2));
    const cx = Math.round(sx - camera.x), cy = Math.round(sy - camera.y);
    const size = cell; // align to grid cell size
    ctx.save();
    ctx.globalAlpha = 0.5;
    if(placeMode.type==='wall'){
      ctx.fillStyle = valid ? '#6ee7b7' : '#f87171';
      ctx.fillRect(cx - size/2, cy - size/2, size, size);
    } else if(placeMode.type==='stoneWall'){
      ctx.fillStyle = valid ? '#94a3b8' : '#f87171';
      ctx.fillRect(cx - size/2, cy - size/2, size, size);
    } else if(placeMode.type==='bench'){
      ctx.fillStyle = valid ? '#a7b0c0' : '#f87171';
      ctx.fillRect(cx - size/2, cy - size/2, size, size);
      ctx.globalAlpha = 1; ctx.strokeStyle = '#4b5563'; ctx.lineWidth=2; ctx.strokeRect(cx - size/2 + 0.5, cy - size/2 + 0.5, size-1, size-1);
    } else if(placeMode.type==='chest'){
      if(chestImgReady){ ctx.globalAlpha = valid?0.9:0.5; ctx.drawImage(chestImg, cx - (size/2) - 1, cy - (size/2) - 1, size+2, size+2); ctx.globalAlpha=1; }
      else { ctx.fillStyle = valid ? '#a16207' : '#f87171'; ctx.fillRect(cx - size/2, cy - size/2, size, size); ctx.globalAlpha = 1; ctx.strokeStyle = '#713f12'; ctx.lineWidth=2; ctx.strokeRect(cx - size/2 + 0.5, cy - size/2 + 0.5, size-1, size-1); }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = valid ? '#059669' : '#b91c1c'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - size/2 + 0.5, cy - size/2 + 0.5, size-1, size-1);
    ctx.restore();
  }

  function drawWalls(){
    for(const w of walls){
      const cx = Math.round(w.x - camera.x), cy = Math.round(w.y - camera.y);
      const sz = w.r*2;
      // 区分木墙和石墙
      if(w.type === 'stone'){
        ctx.fillStyle = '#6b6b73'; // 灰色石墙
        ctx.fillRect(cx - w.r, cy - w.r, sz, sz);
        ctx.fillStyle = '#8a8a94'; // 高光
        ctx.fillRect(cx - w.r + 2, cy - w.r + 2, sz - 4, sz/2 - 2);
        ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2; ctx.strokeRect(cx - w.r + 0.5, cy - w.r + 0.5, sz-1, sz-1);
      } else {
        ctx.fillStyle = '#7a5a3a'; // 棕色木墙
        ctx.fillRect(cx - w.r, cy - w.r, sz, sz);
        ctx.strokeStyle = '#4e3623'; ctx.lineWidth = 2; ctx.strokeRect(cx - w.r + 0.5, cy - w.r + 0.5, sz-1, sz-1);
      }
      // HP指示器
      const hp = (w.hp!=null? w.hp : 60), hpMax=(w.hpMax||60); if(hp<hpMax){
        ctx.fillStyle='#000'; ctx.fillRect(cx-14, cy - w.r - 8, 28, 3);
        ctx.fillStyle='#f87171'; ctx.fillRect(cx-14, cy - w.r - 8, 28*(hp/hpMax), 3);
      }
    }
  }
  
  function drawDungeonEntrances(){
    if(inDungeon) return; // 在地下城中不显示入口
    for(const entrance of dungeonEntrances){
      const cx = Math.round(entrance.x - camera.x);
      const cy = Math.round(entrance.y - camera.y);
      
      ctx.save();
      
      // 洞穴入口尺寸
      const caveWidth = 64;
      const caveHeight = 56;
      const frameThickness = 8;
      
      // 1. 绘制外部岩石轮廓（背景山体）
      const rockColor = '#6b5842';
      const rockDark = '#4a3828';
      const rockLight = '#8b7355';
      
      // 左侧岩石
      ctx.fillStyle = rockColor;
      ctx.beginPath();
      ctx.moveTo(cx - caveWidth/2 - 20, cy + caveHeight/2);
      ctx.lineTo(cx - caveWidth/2 - 16, cy - caveHeight/2 - 10);
      ctx.lineTo(cx - caveWidth/2 - 8, cy - caveHeight/2 - 8);
      ctx.lineTo(cx - caveWidth/2, cy + caveHeight/2);
      ctx.closePath();
      ctx.fill();
      
      // 右侧岩石
      ctx.fillStyle = rockColor;
      ctx.beginPath();
      ctx.moveTo(cx + caveWidth/2, cy + caveHeight/2);
      ctx.lineTo(cx + caveWidth/2 + 8, cy - caveHeight/2 - 8);
      ctx.lineTo(cx + caveWidth/2 + 16, cy - caveHeight/2 - 10);
      ctx.lineTo(cx + caveWidth/2 + 20, cy + caveHeight/2);
      ctx.closePath();
      ctx.fill();
      
      // 岩石阴影细节
      ctx.fillStyle = rockDark;
      ctx.fillRect(cx - caveWidth/2 - 18, cy, 4, caveHeight/2);
      ctx.fillRect(cx + caveWidth/2 + 14, cy, 4, caveHeight/2);
      
      // 2. 绘制黑色洞穴内部（梯形，有深度感）
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(cx - caveWidth/2 + 6, cy - caveHeight/2); // 左上
      ctx.lineTo(cx + caveWidth/2 - 6, cy - caveHeight/2); // 右上
      ctx.lineTo(cx + caveWidth/2 + 2, cy + caveHeight/2); // 右下
      ctx.lineTo(cx - caveWidth/2 - 2, cy + caveHeight/2); // 左下
      ctx.closePath();
      ctx.fill();
      
      // 内部阴影渐变
      const gradient = ctx.createRadialGradient(cx, cy + 10, 6, cx, cy + 10, caveWidth/2);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.5, '#0a0a0a');
      gradient.addColorStop(1, '#1a1410');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cx - caveWidth/2 + 6, cy - caveHeight/2);
      ctx.lineTo(cx + caveWidth/2 - 6, cy - caveHeight/2);
      ctx.lineTo(cx + caveWidth/2 + 2, cy + caveHeight/2);
      ctx.lineTo(cx - caveWidth/2 - 2, cy + caveHeight/2);
      ctx.closePath();
      ctx.fill();
      
      // 3. 绘制木质门框
      const woodColor = '#9b7e52';
      const woodDark = '#6b5435';
      const woodLight = '#c4a86e';
      
      // 左侧木板（多层次）
      ctx.fillStyle = woodColor;
      ctx.fillRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 6, frameThickness, caveHeight + 12);
      ctx.fillStyle = woodLight;
      ctx.fillRect(cx - caveWidth/2 - frameThickness + 1, cy - caveHeight/2 - 6, 3, caveHeight + 12);
      ctx.fillStyle = woodDark;
      ctx.fillRect(cx - caveWidth/2 - 2, cy - caveHeight/2 - 6, 2, caveHeight + 12);
      
      // 右侧木板
      ctx.fillStyle = woodColor;
      ctx.fillRect(cx + caveWidth/2, cy - caveHeight/2 - 6, frameThickness, caveHeight + 12);
      ctx.fillStyle = woodLight;
      ctx.fillRect(cx + caveWidth/2 + 1, cy - caveHeight/2 - 6, 3, caveHeight + 12);
      ctx.fillStyle = woodDark;
      ctx.fillRect(cx + caveWidth/2 + frameThickness - 2, cy - caveHeight/2 - 6, 2, caveHeight + 12);
      
      // 顶部横梁（带厚度）
      ctx.fillStyle = woodColor;
      ctx.fillRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 6, caveWidth + frameThickness * 2, 8);
      ctx.fillStyle = woodLight;
      ctx.fillRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 6, caveWidth + frameThickness * 2, 3);
      ctx.fillStyle = woodDark;
      ctx.fillRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 + 2, caveWidth + frameThickness * 2, 2);
      
      // 4. 木板纹理（更密集）
      ctx.strokeStyle = woodDark;
      ctx.lineWidth = 1;
      for(let i = 0; i < 4; i++){
        ctx.beginPath();
        ctx.moveTo(cx - caveWidth/2 - frameThickness + 2 + i * 2, cy - caveHeight/2 - 6);
        ctx.lineTo(cx - caveWidth/2 - frameThickness + 2 + i * 2, cy + caveHeight/2 + 6);
        ctx.stroke();
      }
      for(let i = 0; i < 4; i++){
        ctx.beginPath();
        ctx.moveTo(cx + caveWidth/2 + 2 + i * 2, cy - caveHeight/2 - 6);
        ctx.lineTo(cx + caveWidth/2 + 2 + i * 2, cy + caveHeight/2 + 6);
        ctx.stroke();
      }
      
      // 横向木纹（横梁）
      for(let i = 0; i < 2; i++){
        ctx.beginPath();
        ctx.moveTo(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 3 + i * 3);
        ctx.lineTo(cx + caveWidth/2 + frameThickness, cy - caveHeight/2 - 3 + i * 3);
        ctx.stroke();
      }
      
      // 5. 木板边缘和钉子
      ctx.strokeStyle = '#3a2415';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 6, frameThickness, caveHeight + 12);
      ctx.strokeRect(cx + caveWidth/2, cy - caveHeight/2 - 6, frameThickness, caveHeight + 12);
      ctx.strokeRect(cx - caveWidth/2 - frameThickness, cy - caveHeight/2 - 6, caveWidth + frameThickness * 2, 8);
      
      // 木钉（更多，更明显）
      ctx.fillStyle = '#2a1810';
      const nailSize = 3;
      // 左侧
      ctx.fillRect(cx - caveWidth/2 - frameThickness + 2, cy - caveHeight/2 + 2, nailSize, nailSize);
      ctx.fillRect(cx - caveWidth/2 - frameThickness + 2, cy, nailSize, nailSize);
      ctx.fillRect(cx - caveWidth/2 - frameThickness + 2, cy + caveHeight/2 - 6, nailSize, nailSize);
      // 右侧
      ctx.fillRect(cx + caveWidth/2 + frameThickness - 5, cy - caveHeight/2 + 2, nailSize, nailSize);
      ctx.fillRect(cx + caveWidth/2 + frameThickness - 5, cy, nailSize, nailSize);
      ctx.fillRect(cx + caveWidth/2 + frameThickness - 5, cy + caveHeight/2 - 6, nailSize, nailSize);
      // 横梁
      ctx.fillRect(cx - caveWidth/2, cy - caveHeight/2 - 3, nailSize, nailSize);
      ctx.fillRect(cx, cy - caveHeight/2 - 3, nailSize, nailSize);
      ctx.fillRect(cx + caveWidth/2 - 3, cy - caveHeight/2 - 3, nailSize, nailSize);
      
      // 6. 地面装饰（碎石）
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(cx - caveWidth/2 - 8, cy + caveHeight/2, 4, 3);
      ctx.fillRect(cx - caveWidth/2 + 4, cy + caveHeight/2, 3, 2);
      ctx.fillRect(cx + caveWidth/2 + 4, cy + caveHeight/2, 4, 3);
      ctx.fillRect(cx + caveWidth/2 - 8, cy + caveHeight/2, 3, 2);
      
      ctx.restore();
      
      // 如果玩家靠近，显示提示
      const dist = Math.hypot(player.x - entrance.x, player.y - entrance.y);
      if(dist < 50){
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(cx - 50, cy - caveHeight/2 - 32, 100, 24);
        ctx.strokeStyle = '#9b7e52';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 50, cy - caveHeight/2 - 32, 100, 24);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 13px Segoe UI, Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('按 E 进入地下城', cx, cy - caveHeight/2 - 20);
        ctx.restore();
      }
    }
  }
  
  function drawDungeon(){
    if(!inDungeon || !currentDungeonId) return;
    const dungeon = dungeons.get(currentDungeonId);
    if(!dungeon) return;
    
    // 绘制深色背景（完全黑暗）
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // 绘制房间地板
    for(const room of dungeon.rooms){
      const rx = Math.round(room.x - camera.x);
      const ry = Math.round(room.y - camera.y);
      const hw = room.w / 2;
      const hh = room.h / 2;
      
      // 地板（石质纹理）
      ctx.fillStyle = '#3a3532';
      ctx.fillRect(rx - hw, ry - hh, room.w, room.h);
      
      // 地板纹理（简单格子）
      ctx.strokeStyle = '#2a2520';
      ctx.lineWidth = 1;
      for(let i = -hw; i <= hw; i += 32){
        ctx.beginPath();
        ctx.moveTo(rx + i, ry - hh);
        ctx.lineTo(rx + i, ry + hh);
        ctx.stroke();
      }
      for(let j = -hh; j <= hh; j += 32){
        ctx.beginPath();
        ctx.moveTo(rx - hw, ry + j);
        ctx.lineTo(rx + hw, ry + j);
        ctx.stroke();
      }
    }
    
    // 绘制走廊地板
    for(const corridor of dungeon.corridors){
      const cx = Math.round(corridor.x - camera.x);
      const cy = Math.round(corridor.y - camera.y);
      const hw = corridor.w / 2;
      const hh = corridor.h / 2;
      
      ctx.fillStyle = '#3a3532';
      ctx.fillRect(cx - hw, cy - hh, corridor.w, corridor.h);
      
      // 走廊纹理
      if(corridor.dir === 'horizontal'){
        ctx.strokeStyle = '#2a2520';
        ctx.lineWidth = 1;
        for(let i = -hw; i <= hw; i += 32){
          ctx.beginPath();
          ctx.moveTo(cx + i, cy - hh);
          ctx.lineTo(cx + i, cy + hh);
          ctx.stroke();
        }
      } else {
        for(let j = -hh; j <= hh; j += 32){
          ctx.beginPath();
          ctx.moveTo(cx - hw, cy + j);
          ctx.lineTo(cx + hw, cy + j);
          ctx.stroke();
        }
      }
    }
    
    // 绘制墙壁
    for(const wall of dungeon.walls){
      const wx = Math.round(wall.x - camera.x);
      const wy = Math.round(wall.y - camera.y);
      const hw = wall.w / 2;
      const hh = wall.h / 2;
      
      // 墙壁主体（深灰石砖）
      ctx.fillStyle = '#52514e';
      ctx.fillRect(wx - hw, wy - hh, wall.w, wall.h);
      
      // 墙壁高光
      ctx.fillStyle = '#6a6864';
      ctx.fillRect(wx - hw + 2, wy - hh + 2, wall.w - 4, wall.h / 2 - 2);
      
      // 墙壁边框
      ctx.strokeStyle = '#3a3937';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx - hw, wy - hh, wall.w, wall.h);
    }
    
    // 绘制门
    for(let i = 0; i < dungeon.doors.length; i++){
      const door = dungeon.doors[i];
      const dx = Math.round(door.x - camera.x);
      const dy = Math.round(door.y - camera.y);
      const hw = door.w / 2;
      const hh = door.h / 2;
      
      if(door.open){
        // 打开的门（显示地板）
        ctx.fillStyle = '#3a3532';
        ctx.fillRect(dx - hw, dy - hh, door.w, door.h);
      } else {
        // 关闭的门（木质）
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(dx - hw, dy - hh, door.w, door.h);
        
        // 门板纹理
        if(door.dir === 'horizontal'){
          ctx.strokeStyle = '#6b5010';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(dx - hw + 4, dy - hh);
          ctx.lineTo(dx - hw + 4, dy + hh);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(dx + hw - 4, dy - hh);
          ctx.lineTo(dx + hw - 4, dy + hh);
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#6b5010';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(dx - hw, dy - hh + 4);
          ctx.lineTo(dx + hw, dy - hh + 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(dx - hw, dy + hh - 4);
          ctx.lineTo(dx + hw, dy + hh - 4);
          ctx.stroke();
        }
        
        // 门框
        ctx.strokeStyle = '#4a3510';
        ctx.lineWidth = 3;
        ctx.strokeRect(dx - hw, dy - hh, door.w, door.h);
        
        // 门把手
        ctx.fillStyle = '#e5c07b';
        if(door.dir === 'horizontal'){
          ctx.fillRect(dx + hw - 8, dy - 3, 4, 6);
        } else {
          ctx.fillRect(dx - 3, dy + hh - 8, 6, 4);
        }
      }
      
      // 如果玩家靠近门，显示提示
      const dist = Math.hypot(player.x - door.x, player.y - door.y);
      if(dist < 35){
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        const tw = door.open ? 60 : 70;
        ctx.fillRect(dx - tw/2, dy - 30, tw, 20);
        ctx.fillStyle = '#e6e6e6';
        ctx.font = '11px Segoe UI, Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(door.open ? '按 E 关门' : '按 E 开门', dx, dy - 20);
        ctx.restore();
        door._nearPlayer = true;
        door._index = i;
      } else {
        door._nearPlayer = false;
      }
    }
    
    // 绘制宝箱
    for(const chest of dungeon.chests){
      const cx = Math.round(chest.x - camera.x);
      const cy = Math.round(chest.y - camera.y);
      if(chest.opened){
        ctx.fillStyle = '#78716c';
        ctx.fillRect(cx - 12, cy - 10, 24, 20);
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 12, cy - 10, 24, 20);
      } else {
        if(chestImgReady){
          ctx.drawImage(chestImg, cx - 12, cy - 10, 24, 18);
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(cx - 12, cy - 10, 24, 20);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 12, cy - 10, 24, 20);
        }
        const glowAlpha = 0.3 + 0.2 * Math.sin(performance.now() / 300);
        ctx.save();
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const dist = Math.hypot(player.x - chest.x, player.y - chest.y);
      if(dist < 40 && !chest.opened){
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(cx - 35, cy - 35, 70, 22);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '11px Segoe UI, Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('点击打开宝箱', cx, cy - 24);
        ctx.restore();
      }
    }
    
    // 绘制出口
    const ex = Math.round(dungeon.exitPoint.x - camera.x);
    const ey = Math.round(dungeon.exitPoint.y - camera.y);
    ctx.save();
    ctx.fillStyle = '#6b6b73';
    ctx.fillRect(ex - 20, ey - 15, 40, 30);
    ctx.fillStyle = '#8a8a94';
    for(let i = 0; i < 4; i++){
      ctx.fillRect(ex - 15 + i * 8, ey - 10 + i * 5, 30 - i * 6, 4);
    }
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex - 20, ey - 15, 40, 30);
    ctx.restore();
    
    const exitDist = Math.hypot(player.x - dungeon.exitPoint.x, player.y - dungeon.exitPoint.y);
    if(exitDist < 50){
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(ex - 45, ey - 45, 90, 24);
      ctx.fillStyle = '#e6e6e6';
      ctx.font = '12px Segoe UI, Microsoft YaHei';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('按 E 返回地表', ex, ey - 33);
      ctx.restore();
    }
    
    ctx.restore();
  }

  // -------------------- 背包 UI --------------------
  function drawBackpack(){
    if(!backpackOpen) return;
    const w = 520, h = 320; // doubled size
    const x = (canvas.width - w) >> 1, y = (canvas.height - h) >> 1;
    ctx.save();
    ctx.fillStyle = 'rgba(20,20,20,0.95)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#666'; ctx.lineWidth = 2; ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
    ctx.fillStyle = '#e6e6e6'; ctx.font = '16px Segoe UI, Microsoft YaHei'; ctx.textBaseline='top';
    ctx.fillText('背包', x+12, y+10);
    // Left-side buttons: Backpack / Skills
    const sideBtnW = 64, sideBtnH = 28, sideGap = 10;
    let sideX = x - (sideBtnW + 12);
    if(sideX < 8) sideX = x + 8; // if off-screen, place inside panel left margin
    const sideY1 = y + 56;
    const sideY2 = sideY1 + sideBtnH + sideGap;
    // 背包按钮
    ctx.fillStyle = (uiPanel==='bag')? '#2563eb' : '#374151';
    ctx.fillRect(sideX, sideY1, sideBtnW, sideBtnH);
    ctx.strokeStyle = (uiPanel==='bag')? '#1d4ed8' : '#111827'; ctx.strokeRect(sideX+0.5, sideY1+0.5, sideBtnW-1, sideBtnH-1);
    ctx.fillStyle = '#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('背包', sideX + sideBtnW/2, sideY1 + sideBtnH/2);
    // 技能按钮
    ctx.fillStyle = (uiPanel==='skills')? '#2563eb' : '#374151';
    ctx.fillRect(sideX, sideY2, sideBtnW, sideBtnH);
    ctx.strokeStyle = (uiPanel==='skills')? '#1d4ed8' : '#111827'; ctx.strokeRect(sideX+0.5, sideY2+0.5, sideBtnW-1, sideBtnH-1);
    ctx.fillStyle = '#e6e6e6'; ctx.fillText('技能', sideX + sideBtnW/2, sideY2 + sideBtnH/2);
    // record hitboxes (will also be stored into backpackLayout below)
    const sideBtns = {
      bag: { x: sideX, y: sideY1, w: sideBtnW, h: sideBtnH },
      skills: { x: sideX, y: sideY2, w: sideBtnW, h: sideBtnH }
    };
    ctx.textAlign='left'; ctx.textBaseline='top';
    // Skills panel placeholder
    if(uiPanel==='skills'){
      ctx.fillStyle='#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei';
      ctx.fillText('技能', x+12, y+10);
      // simple grid placeholders
      const cols=3, rows=2, cellW=120, cellH=60, gap=16;
      const gridW = cols*cellW + (cols-1)*gap;
      const gridH = rows*cellH + (rows-1)*gap;
      const gx = x + (w - gridW)/2;
      const gy = y + 56;
      ctx.strokeStyle='#555'; ctx.lineWidth=2; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
      for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
          const sx = gx + c*(cellW+gap), sy = gy + r*(cellH+gap);
          ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(sx, sy, cellW, cellH);
          ctx.strokeRect(sx+0.5, sy+0.5, cellW-1, cellH-1);
          ctx.fillStyle='#9ca3af'; ctx.fillText('待添加', sx+cellW/2, sy+cellH/2);
        }
      }
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      // ensure side button hitboxes are available to input handler
      backpackLayout = { x, y, w, h, list: [], slots: [], craftBtn: null, scroll: 0, maxScroll: 0, scrollbar: null, sideBtns };
      ctx.restore();
      return;
    }
    // items list (left side)
    const listX = x+20, listY = y+56, rowH = 40;
    const listViewportH = h - 120; // leave space for bottom hints
    // Only show items that have inventory > 0
    const entries = [];
    if(inventory.gem>0) entries.push({type:'gem', label:`宝石: ${inventory.gem}`});
    if(inventory.wood>0) entries.push({type:'wood', label:`木材: ${inventory.wood}`});
    if(inventory.stone>0) entries.push({type:'stone', label:`石块: ${inventory.stone}`});
    if(inventory.plank>0) entries.push({type:'plank', label:`木板: ${inventory.plank}`});
    if(inventory.stick>0) entries.push({type:'stick', label:`木棍: ${inventory.stick}`});
    if(inventory.workbench>0) entries.push({type:'workbench', label:`工作台: ${inventory.workbench}`});
    if(inventory.chest>0) entries.push({type:'chest', label:`箱子: ${inventory.chest}`});
    if(inventory.bow>0) entries.push({type:'bow', label:`弓: ${inventory.bow}${player.equipped==='bow'?' (已装备)':''}`});
    if(inventory.pickaxe>0) entries.push({type:'pickaxe', label:`石镐: ${inventory.pickaxe}${player.equipped==='pickaxe'?' (已装备)':''}`});
    if(inventory.stoneAxe>0) entries.push({type:'stoneAxe', label:`石斧: ${inventory.stoneAxe}${player.equipped==='stoneAxe'?' (已装备)':''}`});
    if(inventory.stoneSword>0) entries.push({type:'stoneSword', label:`石剑: ${inventory.stoneSword}${player.equipped==='stoneSword'?' (已装备)':''}`});
    if(inventory.apple>0) entries.push({type:'apple', label:`苹果: ${inventory.apple}`});
    if(inventory.copper>0) entries.push({type:'copper', label:`铜矿: ${inventory.copper}`});
    if(inventory.tin>0) entries.push({type:'tin', label:`锡矿: ${inventory.tin}`});
    if(inventory.iron>0) entries.push({type:'iron', label:`铁矿: ${inventory.iron}`});
    if(inventory.silver>0) entries.push({type:'silver', label:`银矿: ${inventory.silver}`});
    if(inventory.gold>0) entries.push({type:'gold', label:`金矿: ${inventory.gold}`});
    if(inventory.darkGold>0) entries.push({type:'darkGold', label:`黑金矿: ${inventory.darkGold}`});
    if(inventory.diamond>0) entries.push({type:'diamond', label:`钻石: ${inventory.diamond}`});
    ctx.fillStyle='#e6e6e6'; ctx.font='16px Segoe UI, Microsoft YaHei';
    // scrolling math and clip viewport
    const totalH = entries.length * rowH;
    const maxScroll = Math.max(0, totalH - listViewportH);
    if(backpackScroll < 0) backpackScroll = 0; else if(backpackScroll > maxScroll) backpackScroll = maxScroll;
    ctx.save(); ctx.beginPath(); ctx.rect(listX-4, listY-4, 260, listViewportH+8); ctx.clip();
    let curY = listY - backpackScroll;
    const listBounds = [];
    const backpackPrimaryBtns = [];
    for(const ent of entries){
      const rowTop = curY, rowBottom = curY + rowH;
      const visible = rowBottom >= listY && rowTop <= listY + listViewportH;
      if(visible){
        if(ent.type==='gem'){
          ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(listX+8, curY+8); ctx.lineTo(listX, curY+20); ctx.lineTo(listX+8, curY+32); ctx.lineTo(listX+16, curY+20); ctx.closePath(); ctx.fill();
        } else if(ent.type==='wood'){
          ctx.fillStyle='#8b5a2b'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#a87945'; ctx.fillRect(listX, curY+14, 20, 4);
        } else if(ent.type==='stone'){
          ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+2, curY+10, 16, 14); ctx.fillStyle='#8a8a94'; ctx.fillRect(listX+3, curY+11, 10, 8); ctx.fillStyle='#4a4a52'; ctx.fillRect(listX+8, curY+16, 8, 6);
        } else if(ent.type==='plank'){
          ctx.fillStyle='#e0d4a3'; ctx.fillRect(listX, curY+10, 20, 10); ctx.fillStyle='#b9a77c'; ctx.fillRect(listX, curY+14, 20, 4);
        } else if(ent.type==='stick'){
          ctx.fillStyle='#c8aa7a'; ctx.fillRect(listX, curY+10, 20, 3); ctx.fillRect(listX+4, curY+16, 20, 3);
        } else if(ent.type==='workbench'){
          ctx.fillStyle='#6b7280'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#374151'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1);
        } else if(ent.type==='chest'){
          if(chestImgReady){ ctx.drawImage(chestImg, listX, curY+6, 24, 18); }
          else { ctx.fillStyle='#a16207'; ctx.fillRect(listX, curY+10, 20, 10); ctx.strokeStyle='#713f12'; ctx.strokeRect(listX+0.5, curY+10.5, 20-1, 10-1); }
        } else if(ent.type==='bow'){
          ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(listX+10, curY+15, 8, -Math.PI/2, Math.PI/2); ctx.stroke();
          ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(listX+10, curY+7); ctx.lineTo(listX+10, curY+23); ctx.stroke();
        } else if(ent.type==='pickaxe'){
          ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+6, curY+10, 8, 4);
        } else if(ent.type==='stoneAxe'){
          ctx.fillStyle='#78716c'; ctx.fillRect(listX+8, curY+8, 4, 12); ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+4, curY+10, 10, 6);
        } else if(ent.type==='stoneSword'){
          ctx.fillStyle='#6b6b73'; ctx.fillRect(listX+9, curY+8, 2, 14); ctx.fillStyle='#78716c'; ctx.fillRect(listX+7, curY+20, 6, 4);
        } else if(ent.type==='apple'){
          ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(listX+10, curY+16, 7, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle='#14532d'; ctx.fillRect(listX+8, curY+8, 3, 4);
        } else if(ORE_COLORS[ent.type]){
          drawOreIcon(ctx, listX+2, curY+10, ORE_COLORS[ent.type]);
        }
        ctx.fillStyle='#e6e6e6'; ctx.fillText(ent.label, listX+32, curY+6);
        listBounds.push({type: ent.type, x:listX, y:curY, w:220, h:rowH});
        // Add primary buttons for various item types
        if(ent.type===backpackSelectedType && (ent.type==='plank'||ent.type==='workbench'||ent.type==='chest'||ent.type==='apple'||ent.type==='bow'||ent.type==='pickaxe'||ent.type==='stoneAxe'||ent.type==='stoneSword'||ent.type==='stoneWall')){
          const fontPrev = ctx.font;
          let primaryLabel = '使用';
          if(ent.type==='plank'||ent.type==='workbench'||ent.type==='chest'||ent.type==='stoneWall') primaryLabel='放置';
          else if(ent.type==='apple') primaryLabel='食用';
          else if(ent.type==='bow'||ent.type==='pickaxe'||ent.type==='stoneAxe'||ent.type==='stoneSword') primaryLabel=(player.equipped===ent.type?'卸下':'使用');
          const btnW1=56; const uy = curY + 6; const ux = listX + 220 - 6 - btnW1;
          ctx.fillStyle='#2e7d32'; ctx.fillRect(ux, uy, btnW1, 24);
          ctx.strokeStyle='#1b5e20'; ctx.strokeRect(ux+0.5, uy+0.5, btnW1-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(primaryLabel, ux+btnW1/2, uy+12);
          backpackPrimaryBtns.push({ x:ux, y:uy, w:btnW1, h:24, type: ent.type });
          ctx.font = fontPrev; ctx.textAlign='left'; ctx.textBaseline='top';
        }
        if(ent.type===backpackSelectedType){
          ctx.save();
          ctx.globalAlpha=0.18; ctx.fillStyle='#e5f3ff'; ctx.fillRect(listX-2, curY+2, 224, rowH-4);
          ctx.restore();
          ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=2; ctx.strokeRect(listX+0.5, curY+0.5, 220-1, rowH-1);
        }
      }
      curY += rowH;
    }
    ctx.restore();

    // draw thin scrollbar (right of list area)
    const trackX = listX + 232, trackY = listY, trackW = 6, trackH = listViewportH;
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#2b2b2b'; ctx.fillRect(trackX, trackY, trackW, trackH);
    let thumbY = trackY, thumbH = trackH;
    if(maxScroll > 0){
      thumbH = Math.max(18, Math.floor(trackH * (listViewportH / (totalH||1))));
      const ratioSB = backpackScroll / maxScroll;
      thumbY = Math.round(trackY + (trackH - thumbH) * ratioSB);
    }
    ctx.globalAlpha = 0.8; ctx.fillStyle = '#6b7280'; ctx.fillRect(trackX+1, thumbY, trackW-2, thumbH);
    ctx.restore();

    // crafting grid (right side)
    const gridCols = 2, gridRows=2, cell = 72, gap = 12;
    const gridW = gridCols*cell + (gridCols-1)*gap, gridH = gridRows*cell + (gridRows-1)*gap;
    const gridX = x + w - gridW - 24, gridY = y + 56;
    backpackLayout = { x: x, y: y, w: w, h: h, list: listBounds, slots: [], craftBtn: null, scroll: backpackScroll, maxScroll: maxScroll,
      scrollbar: { x: trackX, y: trackY, w: trackW, h: trackH, thumbY: thumbY, thumbH: thumbH }, sideBtns, primaryBtns: backpackPrimaryBtns
    };
    ctx.strokeStyle='#888'; ctx.lineWidth=2;
    for(let r=0;r<gridRows;r++){
      for(let c=0;c<gridCols;c++){
        const idx = r*gridCols+c; const sx = gridX + c*(cell+gap); const sy = gridY + r*(cell+gap);
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(sx, sy, cell, cell);
        ctx.strokeRect(sx+0.5, sy+0.5, cell-1, cell-1);
        backpackLayout.slots.push({x:sx,y:sy,w:cell,h:cell});
        // draw item if present
        const it = craftingSlots[idx];
        if(it){
          if(it.type==='gem'){
            ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(sx+cell/2, sy+cell/2-10); ctx.lineTo(sx+cell/2-8, sy+cell/2); ctx.lineTo(sx+cell/2, sy+cell/2+10); ctx.lineTo(sx+cell/2+8, sy+cell/2); ctx.closePath(); ctx.fill();
          } else if(it.type==='wood'){
            ctx.fillStyle='#8b5a2b'; ctx.fillRect(sx+cell/2-14, sy+cell/2-6, 28, 12);
            ctx.fillStyle='#a87945'; ctx.fillRect(sx+cell/2-14, sy+cell/2-1, 28, 3);
          } else if(it.type==='stone'){
            ctx.fillStyle='#6b6b73'; ctx.fillRect(sx+cell/2-12, sy+cell/2-10, 24, 20); ctx.fillStyle='#8a8a94'; ctx.fillRect(sx+cell/2-10, sy+cell/2-8, 16, 12); ctx.fillStyle='#4a4a52'; ctx.fillRect(sx+cell/2-4, sy+cell/2+2, 12, 8);
          } else if(it.type==='plank'){
            ctx.fillStyle='#e0d4a3'; ctx.fillRect(sx+cell/2-16, sy+cell/2-8, 32, 16);
            ctx.fillStyle='#b9a77c'; ctx.fillRect(sx+cell/2-16, sy+cell/2-2, 32, 4);
          } else if(it.type==='stick'){
            ctx.fillStyle='#c8aa7a';
            ctx.fillRect(sx+cell/2-22, sy+cell/2-2, 28, 3);
            ctx.fillRect(sx+cell/2-18, sy+cell/2+4, 28, 3);
          } else if(it.type==='workbench'){
            ctx.fillStyle='#6b7280'; ctx.fillRect(sx+cell/2-16, sy+cell/2-8, 32, 16);
            ctx.strokeStyle='#374151'; ctx.strokeRect(sx+cell/2-16+0.5, sy+cell/2-8+0.5, 32-1, 16-1);
          } else if(it.type==='bow'){
            ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx+cell/2, sy+cell/2, 12, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(sx+cell/2, sy+cell/2-12); ctx.lineTo(sx+cell/2, sy+cell/2+12); ctx.stroke();
          }
        }
      }
    }
    // craftable preview above grid（悬浮预览配方，按形状优先）
    const s0t=craftingSlots[0]?.type, s1t=craftingSlots[1]?.type, s2t=craftingSlots[2]?.type, s3t=craftingSlots[3]?.type;
    const shapedWorkbench = (s0t==='plank' && s1t==='plank' && s2t==='plank' && s3t==='plank');
    const cnt = { wood:0, plank:0 };
    for(const it of craftingSlots){ if(!it) continue; if(it.type==='wood') cnt.wood++; else if(it.type==='plank') cnt.plank++; }
    let preview = null; // {label, draw: (cx,cy)=>void}
    if(shapedWorkbench){
      preview = {
        label: '可合成：工作台 ×1',
        draw(cx,cy){
          ctx.fillStyle='#9aa5b1'; ctx.fillRect(cx-16, cy-8, 32, 16);
          ctx.strokeStyle='#374151'; ctx.strokeRect(cx-16+0.5, cy-8+0.5, 32-1, 16-1);
        }
      };
    } else if(cnt.plank>=2){
      preview = {
        label: '可合成：木棍 ×4',
        draw(cx,cy){
          ctx.fillStyle='#c8aa7a';
          ctx.fillRect(cx-22, cy-4, 20, 3); ctx.fillRect(cx-18, cy+2, 20, 3);
        }
      };
    } else if(cnt.wood>=2){
      preview = {
        label: '可合成：木板 ×1',
        draw(cx,cy){
          ctx.fillStyle='#e0d4a3'; ctx.fillRect(cx-14, cy-8, 28, 16);
          ctx.fillStyle='#b9a77c'; ctx.fillRect(cx-14, cy-2, 28, 4);
        }
      };
    } else if(craftingSlots.filter(it=>it?.type==='stick').length>=3){
      preview = {
        label: '可合成：弓 ×1',
        draw(cx,cy){ ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx, cy, 10, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(cx, cy-10); ctx.lineTo(cx, cy+10); ctx.stroke(); }
      };
    }
    if(preview){
      const bx = gridX + gridW/2, by = gridY - 20;
      // icon
      preview.draw(bx-60, by);
      // label
      ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(preview.label, bx-40, by);
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    };
    // By default, no buttons
    backpackLayout.plankUseBtn = null;
    backpackLayout.benchUseBtn = null;
    // Show contextual buttons near selected row only (must be visible)
    if(backpackSelectedType){
      const row = listBounds.find(b=>b.type===backpackSelectedType);
      if(row){
        // place button inside highlight box (row) at right side, slightly higher
        const pad = 6; const btnTopOffset = 4; // smaller top offset
        const uy = row.y + btnTopOffset;
        if(backpackSelectedType==='plank' && inventory.plank>0){
          const btnW=56; const ux = row.x + 220 - pad - btnW;
          ctx.fillStyle='#2e7d32'; ctx.fillRect(ux, uy, btnW, 24);
          ctx.strokeStyle='#1b5e20'; ctx.strokeRect(ux+0.5, uy+0.5, 56-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('使用', ux+28, uy+12);
          backpackLayout.plankUseBtn = { x:ux, y:uy, w:btnW, h:24 };
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        } else if(backpackSelectedType==='workbench' && inventory.workbench>0){
          const btnW=56; const ux = row.x + 220 - pad - btnW;
          ctx.fillStyle='#4b5563'; ctx.fillRect(ux, uy, btnW, 24);
          ctx.strokeStyle='#1f2937'; ctx.strokeRect(ux+0.5, uy+0.5, 56-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('放置', ux+28, uy+12);
          backpackLayout.benchUseBtn = { x:ux, y:uy, w:btnW, h:24 };
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        } else if(backpackSelectedType==='chest' && inventory.chest>0){
          const btnW=56; const ux = row.x + 220 - pad - btnW;
          ctx.fillStyle='#4b5563'; ctx.fillRect(ux, uy, btnW, 24);
          ctx.strokeStyle='#1f2937'; ctx.strokeRect(ux+0.5, uy+0.5, 56-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('放置', ux+28, uy+12);
          backpackLayout.chestUseBtn = { x:ux, y:uy, w:btnW, h:24 };
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        } else if(backpackSelectedType==='bow' && inventory.bow>0){
          const btnW=72; const ux = row.x + 220 - pad - btnW;
          ctx.fillStyle='#2e7d32'; ctx.fillRect(ux, uy, btnW, 24);
          ctx.strokeStyle='#1b5e20'; ctx.strokeRect(ux+0.5, uy+0.5, 72-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(player.equipped==='bow'?'卸下':'使用', ux+36, uy+12);
          backpackLayout.bowUseBtn = { x:ux, y:uy, w:btnW, h:24 };
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        } else if(backpackSelectedType==='apple' && inventory.apple>0){
          const btnW=56; const ux = row.x + 220 - pad - btnW;
          ctx.fillStyle='#2e7d32'; ctx.fillRect(ux, uy, btnW, 24);
          ctx.strokeStyle='#1b5e20'; ctx.strokeRect(ux+0.5, uy+0.5, 56-1, 24-1);
          ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('食用', ux+28, uy+12);
          backpackLayout.appleUseBtn = { x:ux, y:uy, w:btnW, h:24 };
          ctx.textAlign='left'; ctx.textBaseline='alphabetic';
        }
      }
    }
    // craft button
    const btnW=100, btnH=28, btnX = gridX + (gridW - btnW)/2, btnY = gridY + gridH + 16;
    backpackLayout.craftBtn = { x:btnX, y:btnY, w:btnW, h:btnH };
    ctx.fillStyle='#2e7d32'; ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle='#1b5e20'; ctx.strokeRect(btnX+0.5, btnY+0.5, btnW-1, btnH-1);
    ctx.fillStyle='#e6e6e6'; ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('制作', btnX+btnW/2, btnY+btnH/2);
    // hint
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#aaaaaa'; ctx.font='12px Segoe UI, Microsoft YaHei'; ctx.fillText('拖动物品到右侧 2x2 格子 | 2木材→木板；2木板→4木棍 | 按 Tab 关闭', x+12, y+h-28);

    // draw dragging item on top
    if(dragItem){
      const mx = mouse.x, my = mouse.y;
      if(dragItem.type==='gem'){
        ctx.fillStyle='#f5e663'; ctx.beginPath(); ctx.moveTo(mx, my-10); ctx.lineTo(mx-10, my); ctx.lineTo(mx, my+10); ctx.lineTo(mx+10, my); ctx.closePath(); ctx.fill();
      }else if(dragItem.type==='wood'){
        ctx.fillStyle='#8b5a2b'; ctx.fillRect(mx-12, my-6, 24, 12); ctx.fillStyle='#a87945'; ctx.fillRect(mx-12, my-1, 24, 3);
      }else if(dragItem.type==='stone'){
        ctx.fillStyle='#6b6b73'; ctx.fillRect(mx-10, my-8, 20, 16); ctx.fillStyle='#8a8a94'; ctx.fillRect(mx-8, my-6, 14, 10); ctx.fillStyle='#4a4a52'; ctx.fillRect(mx-2, my, 10, 6);
      }else if(dragItem.type==='plank'){
        ctx.fillStyle='#e0d4a3'; ctx.fillRect(mx-14, my-7, 28, 14); ctx.fillStyle='#b9a77c'; ctx.fillRect(mx-14, my-2, 28, 4);
      } else if(dragItem.type==='stick'){
        ctx.fillStyle='#c8aa7a'; ctx.fillRect(mx-22, my-2, 28, 3); ctx.fillRect(mx-18, my+4, 28, 3);
      } else if(dragItem.type==='workbench'){
        ctx.fillStyle='#6b7280'; ctx.fillRect(mx-14, my-7, 28, 14); ctx.strokeStyle='#374151'; ctx.strokeRect(mx-14+0.5, my-7+0.5, 28-1, 14-1);
      } else if(dragItem.type==='bow'){
        ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(mx, my, 10, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(mx, my-10); ctx.lineTo(mx, my+10); ctx.stroke();
      } else if(dragItem.type==='apple'){
        ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#14532d'; ctx.fillRect(mx-1, my-10, 3, 5);
      }
    }
    ctx.restore();
  }

  function drawChopProgress(){
    if(!chop.active || chop.total<=0) return;
    const t = trees.find(tr=>tr.id===chop.treeId);
    if(!t) return;
    const pct = Math.max(0, Math.min(1, (chop.total - chop.time)/chop.total));
    const cx = Math.round(t.x - camera.x);
    const cy = Math.round(t.y - camera.y);
    const w = 30, h = 6, x = cx - (w>>1), y = cy + 16; // under the tree trunk
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x-1, y-1, w+2, h+2);
    ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7ad66a'; ctx.fillRect(x, y, Math.floor(w*pct), h);
  }

  function drawMineProgress(){
    if(!mine.active || mine.total<=0) return;
    const ro = rocks.find(r=>r.id===mine.rockId);
    if(!ro) return;
    const pct = Math.max(0, Math.min(1, (mine.total - mine.time)/mine.total));
    const cx = Math.round(ro.x - camera.x);
    const cy = Math.round(ro.y - camera.y);
    const w = 30, h = 6, x = cx - (w>>1), y = cy + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x-1, y-1, w+2, h+2);
    ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8a8a94'; ctx.fillRect(x, y, Math.floor(w*pct), h);
  }

  function drawOreMineProgress(){
    if(!oreMine.active || oreMine.total<=0) return;
    const ore = ores.find(o=>o.id===oreMine.oreId);
    if(!ore) return;
    const pct = Math.max(0, Math.min(1, (oreMine.total - oreMine.time)/oreMine.total));
    const cx = Math.round(ore.x - camera.x);
    const cy = Math.round(ore.y - camera.y);
    const w = 30, h = 6, x = cx - (w>>1), y = cy + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x-1, y-1, w+2, h+2);
    ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(x, y, Math.floor(w*pct), h);
  }

  function drawOres(){
    if(STYLE==='pixlake' && tiles.ready && tiles.ores){
      for(const ore of ores){
        const cx = Math.round(ore.x - camera.x), cy = Math.round(ore.y - camera.y);
        const s = 2.24; // visual scale (80% of 2.8)
        ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(cx, cy + Math.round(3*s), Math.round(6*s), Math.round(3*s), 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        ctx.drawImage(tiles.ores[ore.type], cx - 8*s, cy - 8*s, 16*s, 16*s);
        if(selectedOreId === ore.id){
          const ax = cx, ay = cy - 16;
          ctx.save(); ctx.fillStyle='#06b6d4'; ctx.strokeStyle='#0891b2'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-7, ay-10); ctx.lineTo(ax+7, ay-10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      return;
    }
    const oreColors = {copper: '#d97706', tin: '#94a3b8', iron: '#78716c', silver: '#e5e7eb', gold: '#fbbf24', darkGold: '#a16207', diamond: '#06b6d4'};
    for(const ore of ores){
      const cx = Math.round(ore.x - camera.x), cy = Math.round(ore.y - camera.y);
      ctx.fillStyle = oreColors[ore.type] || '#6b6b73'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2; ctx.stroke();
      if(selectedOreId === ore.id){ const ax = cx, ay = cy - 16; ctx.save(); ctx.fillStyle='#06b6d4'; ctx.strokeStyle='#0891b2'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-7, ay-10); ctx.lineTo(ax+7, ay-10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
  }

  // Trees: generate on grass only, non-passable
  function isGrass(wx, wy){
    const gx = Math.floor(wx / cell), gy = Math.floor(wy / cell);
    const {noise} = world;
    const e = (0.55*noise(gx*scale1, gy*scale1) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3) + 2)/4;
    return e >= SAND_T;
  }
  const TREE_SPAWN_BUFFER = 140; // pixels to keep clear around spawn area (near 0,0)
  const CHOP_RANGE = 24; // distance within which chopping can start
  const MINE_RANGE = 24; // distance for rock mining
  let ROCK_SEQ = 0;
  function snapCenterX(wx){ return Math.floor(wx / cell) * cell + cell/2; }
  function snapCenterY(wy){ return Math.floor(wy / cell) * cell + cell/2; }
  function regenerateTrees(){
    // Clear existing and chunk cache; actual generation is lazy per chunk
    trees.length = 0; TREE_SEQ = 0; rocks.length = 0; ROCK_SEQ = 0; ores.length = 0; ORE_SEQ = 0; treeChunks.clear();
    
    // ==========================================
    // 地下城系统 - 暂时禁用（保留代码，待后续开发）
    // ==========================================
    /*
    // Generate dungeon entrances (3-5 per world)
    dungeonEntrances.length = 0; dungeons.clear(); dungeonIdSeq = 0;
    const entranceCount = 3 + Math.floor(world.rng.float() * 3);
    let attempts = 0;
    for(let i = 0; i < entranceCount && attempts < 100; i++){
      const angle = (i / entranceCount) * Math.PI * 2;
      const dist = 400 + world.rng.float() * 600;
      const ex = player.x + Math.cos(angle) * dist;
      const ey = player.y + Math.sin(angle) * dist;
      const pos = findLandNear(ex, ey, 0, 100, 20);
      if(pos){
        // 确保不在水上且不与树重叠
        const clearRadius = 40;
        let valid = true;
        if(isWaterArea(pos.x, pos.y, clearRadius)){
          valid = false;
        }
        // 确保周围没有树
        if(valid && collidesTree(pos.x, pos.y, clearRadius)){
          valid = false;
        }
        // 确保与其他入口有足够距离
        for(const other of dungeonEntrances){
          if(Math.hypot(other.x - pos.x, other.y - pos.y) < 300){
            valid = false;
            break;
          }
        }
        
        if(valid){
          const dungeonId = dungeonIdSeq++;
          dungeonEntrances.push({ x: pos.x, y: pos.y, id: dungeonEntrances.length, dungeonId });
          // Create dungeon for this entrance
          createDungeon(dungeonId, pos.x, pos.y);
          // Place stone walls around entrance
          for(let j = 0; j < 3 + Math.floor(world.rng.float() * 4); j++){
            const wa = world.rng.float() * Math.PI * 2;
            const wd = 80 + world.rng.float() * 120;
            const wx = pos.x + Math.cos(wa) * wd;
            const wy = pos.y + Math.sin(wa) * wd;
            if(!isWaterArea(wx, wy, 16) && !collidesTree(wx, wy, 10)){
              walls.push({ x: wx, y: wy, r: cell/2, hp: 120, hpMax: 120, type: 'stone' });
            }
          }
        } else {
          i--; // 重试
          attempts++;
        }
      } else {
        i--;
        attempts++;
      }
    }
    */
    // 地下城系统结束
    // ==========================================
  }
  function generateTreeChunk(cx, cy){
    const key = chunkKey(cx, cy); if(treeChunks.has(key)) return;
    treeChunks.add(key);
    const { noise, rng } = world;
    const s = worldGen.chunkSize;
    const x0 = cx*s, y0 = cy*s;
    const x1 = x0 + s, y1 = y0 + s;
    const P_MIN = 0.02, P_MAX = 0.18;
    // iterate tile centers within chunk
    const gx0 = Math.floor(x0/cell), gx1 = Math.floor((x1)/cell);
    const gy0 = Math.floor(y0/cell), gy1 = Math.floor((y1)/cell);
    for(let gy=gy0; gy<gy1; gy++){
      for(let gx=gx0; gx<gx1; gx++){
        const cxw = gx*cell + cell/2, cyw = gy*cell + cell/2;
        if(cxw*cxw + cyw*cyw < TREE_SPAWN_BUFFER*TREE_SPAWN_BUFFER) continue; // keep spawn area around origin clear
        const e = (0.55*noise(gx*scale1, gy*scale1) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3) + 2)/4;
        if(e < SAND_T) continue; // only on grass
        const t = Math.max(0, Math.min(1, (e - SAND_T) / (1 - SAND_T + 1e-6)));
        const prob = P_MIN + (P_MAX - P_MIN) * Math.pow(t, 1.3);
        if(world.rng.float() < prob){
          // avoid clustering too tightly
          let ok = true; for(let i=trees.length-1;i>=0 && i>trees.length-300;i--){ const tr=trees[i]; const dx=tr.x-cxw, dy=tr.y-cyw; if(dx*dx+dy*dy < (cell*1.1)*(cell*1.1)){ ok=false; break; } }
          if(ok) trees.push({ id: ++TREE_SEQ, x: cxw, y: cyw, r: 10, type: (world.rng.float()<0.22?'apple':'normal') });
        }
        // Generate rocks with lower probability than trees
        const rockProb = (P_MIN + (P_MAX - P_MIN) * Math.pow(t, 1.5)) * 0.4; // 40% of tree probability
        if(world.rng.float() < rockProb){
          // avoid clustering with trees and other rocks
          let ok = true;
          for(let i=trees.length-1;i>=0 && i>trees.length-300;i--){ const tr=trees[i]; const dx=tr.x-cxw, dy=tr.y-cyw; if(dx*dx+dy*dy < (cell*1.8)*(cell*1.8)){ ok=false; break; } }
          for(let i=rocks.length-1;i>=0 && i>rocks.length-300;i--){ const ro=rocks[i]; const dx=ro.x-cxw, dy=ro.y-cyw; if(dx*dx+dy*dy < (cell*1.5)*(cell*1.5)){ ok=false; break; } }
          if(ok) rocks.push({ id: ++ROCK_SEQ, x: cxw, y: cyw, r: 10 });
        }
        // Generate ores (rarer than rocks)
        const oreProb = (P_MIN + (P_MAX - P_MIN) * Math.pow(t, 1.6)) * 0.15; // 15% of tree probability
        if(world.rng.float() < oreProb){
          // avoid clustering with trees, rocks, and other ores
          let ok = true;
          for(let i=trees.length-1;i>=0 && i>trees.length-300;i--){ const tr=trees[i]; const dx=tr.x-cxw, dy=tr.y-cyw; if(dx*dx+dy*dy < (cell*2)*(cell*2)){ ok=false; break; } }
          for(let i=rocks.length-1;i>=0 && i>rocks.length-300;i--){ const ro=rocks[i]; const dx=ro.x-cxw, dy=ro.y-cyw; if(dx*dx+dy*dy < (cell*2)*(cell*2)){ ok=false; break; } }
          for(let i=ores.length-1;i>=0 && i>ores.length-300;i--){ const ore=ores[i]; const dx=ore.x-cxw, dy=ore.y-cyw; if(dx*dx+dy*dy < (cell*2)*(cell*2)){ ok=false; break; } }
          if(ok){
            // Determine ore type based on rarity
            const oreRoll = world.rng.float();
            let oreType;
            if(oreRoll < 0.30) oreType = 'copper';      // 30% - common
            else if(oreRoll < 0.55) oreType = 'tin';    // 25% - common
            else if(oreRoll < 0.75) oreType = 'iron';   // 20% - uncommon
            else if(oreRoll < 0.88) oreType = 'silver'; // 13% - rare
            else if(oreRoll < 0.96) oreType = 'gold';   // 8% - rare
            else if(oreRoll < 0.99) oreType = 'darkGold'; // 3% - very rare
            else oreType = 'diamond';                   // 1% - legendary
            ores.push({ id: ++ORE_SEQ, x: cxw, y: cyw, r: 10, type: oreType });
          }
        }
      }
    }
    // Optionally seed a few enemies in far chunks
    if(enemies.length < worldGen.enemySoftCap){
      const cxm = (x0+x1)/2, cym = (y0+y1)/2;
      const centerDist = Math.hypot(cxm - player.x, cym - player.y);
      if(centerDist > 800){
        // density-based suppression
        let nearby = 0; const rad = worldGen.densityRadius; const rad2=rad*rad;
        for(const e of enemies){ const dx=e.x-cxm, dy=e.y-cym; if(dx*dx+dy*dy<=rad2) nearby++; }
        let spawnTries = worldGen.enemyChunkSpawnTriesBase + world.rng.int(worldGen.enemyChunkSpawnTriesRand+1);
        if(nearby >= worldGen.densityTarget) spawnTries = 0;
        for(let i=0;i<spawnTries;i++){
          const tpRoll = world.rng.float();
          const tp = tpRoll<0.06? 'brute' : tpRoll<0.20? 'tank' : tpRoll<0.50? 'runner' : 'normal';
          const e = makeEnemy(tp);
          const rx = x0 + world.rng.float()*s; const ry = y0 + world.rng.float()*s;
          if(!isWaterArea(rx, ry, 12) && isTreeFree(rx, ry, e.r)){
            const dp0 = Math.hypot(rx - player.x, ry - player.y); if(dp0>worldGen.enemyMinDist){ e.x=rx; e.y=ry; enemies.push(e); }
          }
        }
      }
    }
  }
  function ensureTreeChunksNear(){
    const pad = worldGen.chunkPad; const cc = chunkOf(camera.x + canvas.width/2, camera.y + canvas.height/2);
    for(let dy=-pad; dy<=pad; dy++) for(let dx=-pad; dx<=pad; dx++) generateTreeChunk(cc.cx+dx, cc.cy+dy);
  }

  function drawGridOverlay(){
    // Show grid only when G debug is ON and Shift is held
    if(!showAggroRings) return;
    if(!(keys.has('ShiftLeft')||keys.has('ShiftRight'))) return;
    const x0 = Math.floor(camera.x / cell) * cell;
    const y0 = Math.floor(camera.y / cell) * cell;
    const x1 = camera.x + canvas.width;
    const y1 = camera.y + canvas.height;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    // vertical lines
    for(let x=x0; x<=x1; x+=cell){
      const sx = Math.round(x - camera.x) + 0.5;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
    }
    // horizontal lines
    for(let y=y0; y<=y1; y+=cell){
      const sy = Math.round(y - camera.y) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
    }
    ctx.restore();
  }
  // initial trees will be generated after world init
  

  // Tile thresholds for biomes
  const WATER_T = 0.45; // lower = more land, higher = more water
  const SAND_T  = 0.485; // [WATER_T, SAND_T) becomes sand (~30% narrower than 0.05 band)

  // Water detection using same noise + threshold as rendering
  function isWater(wx, wy){
    const gx = Math.floor(wx / cell), gy = Math.floor(wy / cell);
    const {noise} = world;
    const e = (0.55*noise(gx*scale1, gy*scale1) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3) + 2)/4;
    return e < WATER_T;
  }
  // Sample multiple points around a radius to ensure a small body of water doesn't slip through
  function isWaterArea(wx, wy, r=14){
    const offs = [
      [0,0], [r,0], [-r,0], [0,r], [0,-r], [r*0.7,r*0.7], [r*0.7,-r*0.7], [-r*0.7,r*0.7], [-r*0.7,-r*0.7]
    ];
    for(const [ox,oy] of offs){ if(isWater(wx+ox, wy+oy)) return true; }
    return false;
  }
  // Search nearest non-water tile center around given world position
  function nearestLandTile(wx, wy, maxTiles=120){
    const cx = Math.floor(wx / cell), cy = Math.floor(wy / cell);
    if(!isWaterArea(cx*cell+cell/2, cy*cell+cell/2, cell*0.6)) return { x: cx*cell+cell/2, y: cy*cell+cell/2 };
    for(let r=1; r<=maxTiles; r++){
      // scan perimeter of the square ring at radius r
      for(let dx=-r; dx<=r; dx++){
        const gx1 = cx+dx, gy1 = cy-r;
        const gx2 = cx+dx, gy2 = cy+r;
        const wx1 = gx1*cell + cell/2, wy1 = gy1*cell + cell/2;
        const wx2 = gx2*cell + cell/2, wy2 = gy2*cell + cell/2;
        if(!isWaterArea(wx1, wy1, cell*0.6)) return { x: wx1, y: wy1 };
        if(!isWaterArea(wx2, wy2, cell*0.6)) return { x: wx2, y: wy2 };
      }
      for(let dy=-r+1; dy<=r-1; dy++){
        const gx1 = cx-r, gy1 = cy+dy;
        const gx2 = cx+r, gy2 = cy+dy;
        const wx1 = gx1*cell + cell/2, wy1 = gy1*cell + cell/2;
        const wx2 = gx2*cell + cell/2, wy2 = gy2*cell + cell/2;
        if(!isWaterArea(wx1, wy1, cell*0.6)) return { x: wx1, y: wy1 };
        if(!isWaterArea(wx2, wy2, cell*0.6)) return { x: wx2, y: wy2 };
      }
    }
    return null;
  }
  // Find a clear point: not water and not blocked by trees
  function isTreeFree(wx, wy, r=10){
    const rr = r+8; const rr2=rr*rr; for(const t of trees){ const dx=t.x-wx, dy=t.y-wy; if(dx*dx+dy*dy<=rr2) return false; } return true;
  }
  function findClearNear(cx, cy, minD, maxD, tries){
    const { rng } = world;
    for(let i=0;i<tries;i++){
      const a = rng.float()*Math.PI*2; const d = minD + rng.float()*(maxD-minD);
      const x = cx + Math.cos(a)*d, y = cy + Math.sin(a)*d;
      if(!isWaterArea(x,y,12) && isTreeFree(x,y,10)) return {x,y};
    }
    return null;
  }
  function findLandNear(cx, cy, minD, maxD, tries){
    const { rng } = world;
    let best=null, bestWaterCount=Infinity;
    for(let i=0;i<tries;i++){
      const a = rng.float()*Math.PI*2; const d = minD + rng.float()*(maxD-minD);
      const x = cx + Math.cos(a)*d, y = cy + Math.sin(a)*d;
      if(!isWaterArea(x,y,12)) return {x,y};
      // track the least-watery candidate by counting corner samples
      let wc=0; wc += isWater(x,y)?1:0; wc += isWater(x+8,y)?1:0; wc += isWater(x-8,y)?1:0; wc += isWater(x,y+8)?1:0; wc += isWater(x,y-8)?1:0;
      if(wc<bestWaterCount){ bestWaterCount=wc; best={x,y}; }
    }
    return best; // may still be watery, caller can decide to skip
  }
  function setMiniTimeText(){
    if(!miniTimeEl) return;
    const totalHours = (dayTime / dayLength) * 24;
    const h = Math.floor(totalHours) % 24;
    const m = Math.floor((totalHours - Math.floor(totalHours)) * 60);
    const pad = (n)=> (n<10? '0'+n : ''+n);
    miniTimeEl.textContent = `时间：${pad(h)}:${pad(m)}`;
  }
  
  // ==========================================
  // 地下城生成系统
  // ==========================================
  function createDungeon(dungeonId, entranceX, entranceY){
    const { rng } = world;
    const dungeon = {
      id: dungeonId,
      entranceX, entranceY,
      walls: [], // 地下城墙壁数据
      doors: [], // 门数据
      enemies: [], // 地下城敌人
      chests: [], // 宝箱
      spawnPoint: { x: 0, y: 0 },
      exitPoint: { x: 0, y: -70 },
      rooms: [],
      corridors: []
    };
    
    const WALL_THICKNESS = 12;
    const DOOR_WIDTH = 48;
    const CORRIDOR_WIDTH = 64;
    
    // 中心房间（方形，出生点）
    const centerRoom = { x: 0, y: 0, w: 180, h: 180 };
    dungeon.rooms.push(centerRoom);
    dungeon.spawnPoint = { x: 0, y: 0 };
    dungeon.exitPoint = { x: 0, y: -70 };
    
    // 四个方向生成房间（上下左右）
    const directions = [
      { name: 'north', dx: 0, dy: -1, axis: 'y' },
      { name: 'south', dx: 0, dy: 1, axis: 'y' },
      { name: 'west', dx: -1, dy: 0, axis: 'x' },
      { name: 'east', dx: 1, dy: 0, axis: 'x' }
    ];
    
    for(const dir of directions){
      const roomsInDir = 1 + Math.floor(rng.float() * 2); // 1-2个房间
      let prevRoom = centerRoom;
      
      for(let i = 0; i < roomsInDir; i++){
        const roomW = 140 + Math.floor(rng.float() * 80);
        const roomH = 140 + Math.floor(rng.float() * 80);
        const corridorLen = 100 + Math.floor(rng.float() * 80);
        
        let newRoom;
        if(dir.axis === 'y'){
          // 上下方向
          const rx = prevRoom.x + (rng.float() - 0.5) * 60; // 稍微偏移
          const ry = prevRoom.y + dir.dy * (prevRoom.h/2 + corridorLen + roomH/2);
          newRoom = { x: rx, y: ry, w: roomW, h: roomH };
          // 创建竖直走廊
          const cy1 = prevRoom.y + dir.dy * prevRoom.h/2;
          const cy2 = newRoom.y - dir.dy * newRoom.h/2;
          dungeon.corridors.push({
            x: prevRoom.x,
            y: (cy1 + cy2) / 2,
            w: CORRIDOR_WIDTH,
            h: Math.abs(cy2 - cy1),
            dir: 'vertical',
            door1: { x: prevRoom.x, y: cy1, side: dir.name, roomId: dungeon.rooms.length - 1 },
            door2: { x: newRoom.x, y: cy2, side: dir.name === 'north' ? 'south' : 'north', roomId: dungeon.rooms.length }
          });
        } else {
          // 左右方向
          const rx = prevRoom.x + dir.dx * (prevRoom.w/2 + corridorLen + roomW/2);
          const ry = prevRoom.y + (rng.float() - 0.5) * 60;
          newRoom = { x: rx, y: ry, w: roomW, h: roomH };
          // 创建水平走廊
          const cx1 = prevRoom.x + dir.dx * prevRoom.w/2;
          const cx2 = newRoom.x - dir.dx * newRoom.w/2;
          dungeon.corridors.push({
            x: (cx1 + cx2) / 2,
            y: prevRoom.y,
            w: Math.abs(cx2 - cx1),
            h: CORRIDOR_WIDTH,
            dir: 'horizontal',
            door1: { x: cx1, y: prevRoom.y, side: dir.name, roomId: dungeon.rooms.length - 1 },
            door2: { x: cx2, y: newRoom.y, side: dir.name === 'west' ? 'east' : 'west', roomId: dungeon.rooms.length }
          });
        }
        
        dungeon.rooms.push(newRoom);
        prevRoom = newRoom;
      }
    }
    
    // 生成墙壁（每个房间的四周）
    for(let i = 0; i < dungeon.rooms.length; i++){
      const room = dungeon.rooms[i];
      const hw = room.w / 2, hh = room.h / 2;
      
      // 上墙
      dungeon.walls.push({
        x: room.x, y: room.y - hh - WALL_THICKNESS/2,
        w: room.w, h: WALL_THICKNESS,
        side: 'north', roomId: i
      });
      // 下墙
      dungeon.walls.push({
        x: room.x, y: room.y + hh + WALL_THICKNESS/2,
        w: room.w, h: WALL_THICKNESS,
        side: 'south', roomId: i
      });
      // 左墙
      dungeon.walls.push({
        x: room.x - hw - WALL_THICKNESS/2, y: room.y,
        w: WALL_THICKNESS, h: room.h,
        side: 'west', roomId: i
      });
      // 右墙
      dungeon.walls.push({
        x: room.x + hw + WALL_THICKNESS/2, y: room.y,
        w: WALL_THICKNESS, h: room.h,
        side: 'east', roomId: i
      });
    }
    
    // 生成门（在走廊和房间连接处）
    for(const corridor of dungeon.corridors){
      dungeon.doors.push({
        x: corridor.door1.x,
        y: corridor.door1.y,
        w: corridor.dir === 'vertical' ? DOOR_WIDTH : WALL_THICKNESS,
        h: corridor.dir === 'horizontal' ? DOOR_WIDTH : WALL_THICKNESS,
        open: false,
        dir: corridor.dir
      });
      dungeon.doors.push({
        x: corridor.door2.x,
        y: corridor.door2.y,
        w: corridor.dir === 'vertical' ? DOOR_WIDTH : WALL_THICKNESS,
        h: corridor.dir === 'horizontal' ? DOOR_WIDTH : WALL_THICKNESS,
        open: false,
        dir: corridor.dir
      });
    }
    
    // 在房间中生成敌人（不在中心房间）
    for(let i = 1; i < dungeon.rooms.length; i++){
      const room = dungeon.rooms[i];
      const enemyCount = 2 + Math.floor(rng.float() * 3);
      for(let j = 0; j < enemyCount; j++){
        // 确保敌人生成在房间内部，距离墙壁至少60像素
        const safeMargin = 60;
        const ex = room.x + (rng.float() - 0.5) * (room.w - safeMargin * 2);
        const ey = room.y + (rng.float() - 0.5) * (room.h - safeMargin * 2);
        const types = ['normal', 'fast', 'tank'];
        const type = types[Math.floor(rng.float() * types.length)];
        dungeon.enemies.push({ x: ex, y: ey, type, spawned: false, id: i * 100 + j });
      }
    }
    
    // 在房间中生成宝箱
    for(let i = 1; i < dungeon.rooms.length; i += 2){
      const room = dungeon.rooms[i];
      const cx = room.x + (rng.float() - 0.5) * (room.w - 60);
      const cy = room.y + (rng.float() - 0.5) * (room.h - 60);
      const loot = [];
      const lootTypes = ['gem', 'copper', 'tin', 'iron', 'silver', 'gold', 'diamond', 'apple', 'plank', 'stick'];
      const lootCount = 2 + Math.floor(rng.float() * 4);
      for(let j = 0; j < lootCount; j++){
        const item = lootTypes[Math.floor(rng.float() * lootTypes.length)];
        const amount = 1 + Math.floor(rng.float() * 5);
        loot.push({ type: item, amount });
      }
      dungeon.chests.push({ x: cx, y: cy, loot, opened: false, id: i });
    }
    
    dungeons.set(dungeonId, dungeon);
  }
  
  // 检查点是否在地下城可通行区域
  function isInDungeonWalkable(x, y){
    if(!inDungeon || !currentDungeonId) return false;
    const dungeon = dungeons.get(currentDungeonId);
    if(!dungeon) return false;
    
    // 首先检查是否被关闭的门阻挡（最高优先级）
    for(const door of dungeon.doors){
      if(!door.open){
        const hw = door.w / 2;
        const hh = door.h / 2;
        if(x >= door.x - hw && x <= door.x + hw &&
           y >= door.y - hh && y <= door.y + hh){
          return false; // 关闭的门阻挡
        }
      }
    }
    
    // 检查是否在房间内
    for(const room of dungeon.rooms){
      if(x >= room.x - room.w/2 && x <= room.x + room.w/2 &&
         y >= room.y - room.h/2 && y <= room.y + room.h/2){
        return true;
      }
    }
    
    // 检查是否在走廊内
    for(const corridor of dungeon.corridors){
      const hw = corridor.w / 2;
      const hh = corridor.h / 2;
      if(x >= corridor.x - hw && x <= corridor.x + hw &&
         y >= corridor.y - hh && y <= corridor.y + hh){
        return true;
      }
    }
    
    return false;
  }
  function drawDayNightOverlay(){
    // Night alpha peaks at midnight, lighter at noon
    const t = dayTime / dayLength; // [0,1)
    const night = 0.6 * (1 + Math.cos(t*Math.PI*2)) * 0.5; // [0,0.6], 0:00 darkest, 12:00 brightest
    if(night>0.01){ ctx.fillStyle = `rgba(0,0,0,${night.toFixed(3)})`; ctx.fillRect(0,0,canvas.width,canvas.height); }
  }

  function drawInventoryHUD(){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(12, 68, 150, 190);
    ctx.fillStyle='#e6e6e6'; ctx.font='12px Segoe UI, Microsoft YaHei'; ctx.textBaseline='top';
    // HP text (always one decimal for current HP)
    const hpDisp = player.hp.toFixed(1);
    const bw = 120, bh = 6; const bx = 18, by = 90;
    ctx.fillText(`生命: ${hpDisp}/${Math.round(player.hpMax)}`, 18, by - 14);
    // HP bar
    ctx.fillStyle='#222'; ctx.fillRect(bx, by, bw, bh);
    const hpPct = Math.max(0, Math.min(1, player.hp/player.hpMax));
    ctx.fillStyle = hpPct>0.5? '#3c3' : hpPct>0.25? '#ffb400' : '#e74c3c';
    ctx.fillRect(bx, by, Math.floor(bw*hpPct), bh);
    // Stamina (blue) below HP
    const stPct = Math.max(0, Math.min(1, player.stamina/(player.staminaMax||1)));
    const by2 = by + 28; // push stamina bar further down
    ctx.fillStyle='#222'; ctx.fillRect(bx, by2, bw, bh);
    ctx.fillStyle='#3b82f6'; ctx.fillRect(bx, by2, Math.floor(bw*stPct), bh);
    ctx.fillStyle='#9fbefc'; ctx.fillText(`体力: ${Math.round(player.stamina)}/${Math.round(player.staminaMax||1)}`, bx, by2 - 14);
    // Food (yellow) below stamina
    const fdPct = Math.max(0, Math.min(1, player.food/(player.foodMax||1)));
    const by3 = by2 + 28; // extra spacing between stamina and food bar
    ctx.fillStyle='#222'; ctx.fillRect(bx, by3, bw, bh);
    ctx.fillStyle='#fbbf24'; ctx.fillRect(bx, by3, Math.floor(bw*fdPct), bh);
    // acceleration indicator (red down arrows) at right of food bar (thin stroke)
    if(player.foodAccel){
      const ax0 = bx + bw + 6, ay0 = by3 + Math.floor(bh/2);
      const prevLW = ctx.lineWidth; ctx.lineWidth = 1.5; ctx.strokeStyle = '#ef4444';
      const drawArrow = (ax, ay)=>{
        // shaft
        ctx.beginPath(); ctx.moveTo(ax, ay-7); ctx.lineTo(ax, ay+3); ctx.stroke();
        // chevron tip
        ctx.beginPath(); ctx.moveTo(ax-3, ay+1); ctx.lineTo(ax, ay+5); ctx.lineTo(ax+3, ay+1); ctx.stroke();
      };
      const factor = (player.foodAccelFactor||2);
      const count = factor>=8?3 : factor>=4?2 : 1;
      for(let i=0;i<count;i++) drawArrow(ax0 + i*10, ay0);
      ctx.lineWidth = prevLW;
    }
    ctx.fillStyle='#fde68a'; ctx.fillText(`食物: ${Math.round(player.food)}/${Math.round(player.foodMax||1)}`, bx, by3 - 14);
    // Gems and Wood
    // icons
    // gem icon (diamond)
    ctx.fillStyle = '#f5e663';
    ctx.beginPath(); ctx.moveTo(22, 168); ctx.lineTo(18, 172); ctx.lineTo(22, 176); ctx.lineTo(26, 172); ctx.closePath(); ctx.fill();
    // wood icon (log)
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(18, 178, 10, 6);
    ctx.fillStyle = '#a87945'; ctx.fillRect(18, 180, 10, 2);
    // texts
    ctx.fillStyle='#e6e6e6'; ctx.fillText(`宝石: ${inventory.gem}`, 34, 164);
    ctx.fillText(`木材: ${inventory.wood}`, 34, 176);
    ctx.restore();
  }

  function drawMinimap(){
    const size = 192; const x0 = canvas.width - size - 12, y0 = 12;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(x0-2,y0-2,size+4,size+4);
    const step = minimapStep; // world pixels per sample (zoom)
    const half = (size/2)|0;
    const {noise} = world;
    const pal = tintedPalette();
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        const wx = player.x + (x-half)*step;
        const wy = player.y + (y-half)*step;
        const gx = Math.floor(wx/cell), gy = Math.floor(wy/cell);
        const e = (0.55*noise(gx*scale1, gy*scale1) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3) + 2)/4;
        const color = (e < WATER_T) ? pal.water : (e < SAND_T ? pal.sand : pal.grass);
        ctx.fillStyle=color; ctx.fillRect(x0+x, y0+y, 1, 1);
      }
    }
    // Player
    ctx.fillStyle='#fff'; ctx.fillRect(x0+half-2, y0+half-2, 4, 4);
    // Drops
    ctx.fillStyle='#f5e663';
    for(const d of drops){ const dx=d.x-player.x, dy=d.y-player.y; const mx=(dx/step)+half, my=(dy/step)+half; if(mx>=0&&mx<size&&my>=0&&my<size) ctx.fillRect(x0+mx|0, y0+my|0, 2, 2); }
    // Trees (green dots)
    ctx.fillStyle='#7CFC7C';
    for(const t of trees){ const dx=t.x-player.x, dy=t.y-player.y; const mx=(dx/step)+half, my=(dy/step)+half; if(mx>=0&&mx<size&&my>=0&&my<size) ctx.fillRect(x0+mx|0, y0+my|0, 2, 2); }
    // Workbenches (steel-blue squares)
    ctx.fillStyle='#9aa5b1';
    for(const b of benches){ const dx=b.x-player.x, dy=b.y-player.y; const mx=(dx/step)+half, my=(dy/step)+half; if(mx>=0&&mx<size&&my>=0&&my<size) ctx.fillRect((x0+mx|0)-1, (y0+my|0)-1, 3, 3); }
    // Enemies (draw last to be on top) - per-type color
    for(const e of enemies){
      const dx=e.x-player.x, dy=e.y-player.y; const mx=(dx/step)+half, my=(dy/step)+half;
      if(mx>=0&&mx<size&&my>=0&&my<size){
        ctx.fillStyle=e.color||'#ff5c5c';
        const sz = (e.type==='brute')? 8 : 4;
        ctx.fillRect((x0+mx|0) - ((sz-4)/2), (y0+my|0) - ((sz-4)/2), sz, sz);
      }
    }
    // Reposition UI controls under the minimap based on current size/position
    if(miniCtrlEl){ miniCtrlEl.style.right = '12px'; miniCtrlEl.style.top = (y0 + size + 8) + 'px'; }
    if(miniTimeEl){ const ctrlH = miniCtrlEl ? miniCtrlEl.offsetHeight : 24; miniTimeEl.style.right = '12px'; miniTimeEl.style.top = (y0 + size + 8 + ctrlH + 6) + 'px'; }
    ctx.restore();
  }
  function drawParticles(){
    ctx.save();
    for(const p of particles){
      const cx = Math.round(p.x - camera.x), cy = Math.round(p.y - camera.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.a||0));
      ctx.fillStyle = p.color || '#ffd166';
      const rr = (p.r!=null? p.r: 3);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  function drawPickupTexts(){
    for(const t of pickupTexts){
      const cx = Math.round(t.x - camera.x), cy = Math.round(t.y - camera.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.a);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 16px Segoe UI, Microsoft YaHei';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.txt, cx, cy);
      ctx.restore();
    }
  }
  function makeNoise(seed){
    const rng = seededRNG(seed);
    const perm = new Uint8Array(512);
    for(let i=0;i<256;i++) perm[i]=i;
    for(let i=255;i>0;i--){ const j=rng.int(i+1); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
    for(let i=0;i<256;i++) perm[256+i]=perm[i];
    function fade(t){ return t*t*t*(t*(t*6-15)+10); }
    function lerp(a,b,t){ return a+(b-a)*t; }
    function grad(h,x,y){ switch(h&3){ case 0:return x+y; case 1:return -x+y; case 2:return x-y; default:return -x-y; } }
    return function noise2(x,y){
      const X=Math.floor(x)&255, Y=Math.floor(y)&255; x-=Math.floor(x); y-=Math.floor(y);
      const u=fade(x), v=fade(y);
      const aa=perm[X+perm[Y]], ab=perm[X+perm[Y+1]];
      const ba=perm[X+1+perm[Y]], bb=perm[X+1+perm[Y+1]];
      const gaa=grad(aa,x,y), gab=grad(ab,x,y-1);
      const gba=grad(ba,x-1,y), gbb=grad(bb,x-1,y-1);
      return lerp(lerp(gaa,gba,u), lerp(gab,gbb,u), v); // [-2,2]
    };
  }
  function palette(kind){
    if(kind==='tropical') return {deep:'#1a2a4f', water:'#224b7a', shore:'#2c7da0', sand:'#d2b48c', grass:'#3e8a49', forest:'#2f6b3a', hill:'#6c6e2e', rock:'#6f6f7a', snow:'#e7eef4'};
    if(kind==='desert')   return {deep:'#2a1c0f', water:'#3a2612', shore:'#5e3b1a', sand:'#d7b98b', grass:'#9aa06a', forest:'#7f8658', hill:'#c49a6c', rock:'#8c7a6a', snow:'#efe6d9'};
    return {deep:'#0b2033', water:'#143b5a', shore:'#1f5e7a', sand:'#d9c28a', grass:'#3e8a49', forest:'#2b6a3a', hill:'#7a6e3a', rock:'#6e6e78', snow:'#eef2f6'};
  }
  function newWorld(seed){
    const rng = seededRNG(seed);
    const palKinds=['default','tropical','desert'];
    return { rng, seed:rng.s, pal: palette(palKinds[rng.int(palKinds.length)]), noise: makeNoise(rng.s) };
  }
  let world = newWorld(0);
  seedView.textContent = world.seed;
  regenBtn.onclick = ()=>{ world = newWorld(0); seedView.textContent = world.seed; dayTime = dayLength*0.5; regenerateTrees(); };
  const cell = 16; // pixel tile size
  const scale1=1/48, scale2=1/128, scale3=1/20;

  // ==========================================
  // SECTION 4: 游戏核心系统
  // ==========================================
  
  // -------------------- 玩家系统 --------------------
  const player = { x: 0, y:0, w:14, h:20, speed: 160, sprint: 260, dir: 'down', cd: 0, hpMax: 100, hp: 100, dead: false, respawn: 0, iUntil: 0, backpackReset: false, lastHitAt: 0, regenRate: 2, regenDelay: 3000, equipped: 'none', rangedCd: 0, bowCharging: false, bowCharge: 0, bowChargeMax: 1.2, moving:false, movePen:0,
    staminaMax: 100, stamina: 100, foodMax: 100, food: 100 };
  let _prevPX = 0, _prevPY = 0;

  // -------------------- 敌人和实体系统 --------------------
  const enemies = [];
  const bullets = [];
  const particles = [];
  const drops = [];
  const damageTexts = [];
  const centerHints = []; let lastHintAt = 0;
  
  // -------------------- 库存系统 --------------------
  const inventory = { gem: 16, wood: 16, plank: 16, stick: 16, workbench: 16, bow: 16, apple: 16, stone: 16, chest: 16, stoneAxe: 16, stoneWall: 16, stoneSword: 16, furnace: 16, pickaxe: 16, copper: 16, tin: 16, iron: 16, silver: 16, gold: 16, darkGold: 16, diamond: 16 };
  const walls = []; // {x, y, r, hp, hpMax, type: 'wood'|'stone'}
  const benches = [];
  const trees = [];
  const rocks = [];
  const ores = []; // ore deposits
  let ORE_SEQ = 0;
  
  // -------------------- 地下城系统 --------------------
  const dungeonEntrances = []; // {x, y, id, dungeonId}
  const dungeons = new Map(); // dungeonId -> dungeon data
  let inDungeon = false;
  let currentDungeonId = null;
  let dungeonIdSeq = 0;
  // -------------------- 战斗系统 --------------------
  // Player melee state/config
  const MELEE = { range: 48, half: Math.PI/5, dmg: 7, cd: 0.45, fxMs: 110, kb: 140 }; // Base dmg 1/4 of original 28
  const melee = { cd: 0, activeUntil: 0, angle: 0 };
  // Bow config: range and damage falloff (min multiplier at max range)
  const BOWCFG = { range: 600, minMult: 0.2 }; // 80% max reduction at max range
  // Slash FX config (tweak via window.slashFx)
  const slashFx = {
    outerScale: 0.710,
    innerScale: 0.987,
    off: 20,
    ellYOuter: 0.54,
    ellYInner: 0.46,
  };
  window.slashFx = slashFx;
  // Streaming world-gen config (tweak via window.worldGen)
  const worldGen = {
    chunkSize: 1024,
    chunkPad: 2,
    enemyChunkSpawnTriesBase: 1,
    enemyChunkSpawnTriesRand: 1, // final tries = base + rng.int(rand+1)
    enemySoftCap: 140,
    enemyMinDist: 760,
    densityRadius: 900,
    densityTarget: 8,
  };
  window.worldGen = worldGen;
  
  // Tree lazy-loading chunks
  const treeChunks = new Set();
  function chunkOf(wx, wy){ const s=worldGen.chunkSize; return { cx: Math.floor(wx/s), cy: Math.floor(wy/s) }; }
  function chunkKey(cx, cy){ return cx+","+cy; }
  let TREE_SEQ = 0; // must be initialized before regenerateTrees() uses it
  const pickupTexts = [];
  // generate initial trees now that 'trees' exists and 'world' is initialized above
  regenerateTrees();
  // Starter loadout on first start
  resetInventoryToStarter();
  let minimapStep = 4; // world pixels per minimap pixel (zoom)
  const mouse = { x:0, y:0, down:false };
  function toWorld(mx,my){ return { x: mx + camera.x, y: my + camera.y }; }
  let selectedTreeId = null;
  const chop = { active:false, time:0, total:0, treeId:null };
  let selectedRockId = null;
  const mine = { active:false, time:0, total:0, rockId:null };
  let selectedOreId = null;
  const oreMine = { active:false, time:0, total:0, oreId:null };
  let backpackOpen = false;
  let benchOpen = false; let currentBench = null;
  let benchScroll = 0;
  let chestOpen = false; let currentChest = null; let chestScroll = 0;
  const chests = [];
  let uiPanel = 'bag';
  // Backpack layout and crafting grid state
  const craftingSlots = [null,null,null,null]; // 2x2 right-side grid
  let backpackLayout = { x:0,y:0,w:0,h:0, list:[], slots:[] };
  let benchLayout = { x:0,y:0,w:0,h:0, list:[], slots:[] };
  let chestLayout = { x:0,y:0,w:0,h:0, list:[], slots:[] };
  let dragItem = null; // {type:'gem'|'wood', origin:'list'|'slot', slotIndex?:number}
  // Skip one world click (e.g., after bow shot release) to avoid unintended interactions
  let skipWorldClickOnce = false;
  // Backpack selection & drag threshold
  let backpackSelectedType = null; // 'plank' | 'workbench' | ...
  let listMouseDown = null; // { type, x, y }
  let listMouseDownTime = 0;
  let listDragActive = false;
  let listDragArmed = false; // only allow drag if already selected and pressing again
  const DRAG_THRESH = 12;
  const DRAG_MIN_MS = 80;
  let backpackScroll = 0; // pixels
  // Scrollbar drag state
  let scrollDrag = false; let scrollDragStartY = 0; let scrollStartScroll = 0;
  let placeMode = { active:false, type:null, skipClick:false };
  let showAggroRings = false;
  function invCount(t){
    if(t==='gem') return inventory.gem;
    if(t==='wood') return inventory.wood;
    if(t==='stone') return inventory.stone;
    if(t==='plank') return inventory.plank;
    if(t==='stick') return inventory.stick;
    if(t==='workbench') return inventory.workbench;
    if(t==='bow') return inventory.bow;
    if(t==='apple') return inventory.apple;
    if(t==='chest') return inventory.chest;
    if(t==='stoneAxe') return inventory.stoneAxe;
    if(t==='stoneWall') return inventory.stoneWall;
    if(t==='stoneSword') return inventory.stoneSword;
    if(t==='furnace') return inventory.furnace;
    if(t==='pickaxe') return inventory.pickaxe;
    if(t==='copper') return inventory.copper;
    if(t==='tin') return inventory.tin;
    if(t==='iron') return inventory.iron;
    if(t==='silver') return inventory.silver;
    if(t==='gold') return inventory.gold;
    if(t==='darkGold') return inventory.darkGold;
    if(t==='diamond') return inventory.diamond;
    return 0;
  }
  function invDec(t){
    if(t==='gem' && inventory.gem>0){ inventory.gem--; return true; }
    if(t==='wood' && inventory.wood>0){ inventory.wood--; return true; }
    if(t==='stone' && inventory.stone>0){ inventory.stone--; return true; }
    if(t==='plank' && inventory.plank>0){ inventory.plank--; return true; }
    if(t==='stick' && inventory.stick>0){ inventory.stick--; return true; }
    if(t==='workbench' && inventory.workbench>0){ inventory.workbench--; return true; }
    if(t==='bow' && inventory.bow>0){ inventory.bow--; return true; }
    if(t==='apple' && inventory.apple>0){ inventory.apple--; return true; }
    if(t==='chest' && inventory.chest>0){ inventory.chest--; return true; }
    if(t==='stoneAxe' && inventory.stoneAxe>0){ inventory.stoneAxe--; return true; }
    if(t==='stoneWall' && inventory.stoneWall>0){ inventory.stoneWall--; return true; }
    if(t==='stoneSword' && inventory.stoneSword>0){ inventory.stoneSword--; return true; }
    if(t==='furnace' && inventory.furnace>0){ inventory.furnace--; return true; }
    if(t==='pickaxe' && inventory.pickaxe>0){ inventory.pickaxe--; return true; }
    if(t==='copper' && inventory.copper>0){ inventory.copper--; return true; }
    if(t==='tin' && inventory.tin>0){ inventory.tin--; return true; }
    if(t==='iron' && inventory.iron>0){ inventory.iron--; return true; }
    if(t==='silver' && inventory.silver>0){ inventory.silver--; return true; }
    if(t==='gold' && inventory.gold>0){ inventory.gold--; return true; }
    if(t==='darkGold' && inventory.darkGold>0){ inventory.darkGold--; return true; }
    if(t==='diamond' && inventory.diamond>0){ inventory.diamond--; return true; }
    return false;
  }
  function closeBackpackRefund(){
    // return items in crafting slots back to inventory
    for(let i=0;i<craftingSlots.length;i++){
      const it = craftingSlots[i]; if(!it) continue;
      if(it.type==='wood') inventory.wood += 1;
      else if(it.type==='gem') inventory.gem += 1;
      else if(it.type==='stone') inventory.stone += 1;
      else if(it.type==='plank') inventory.plank += 1;
      else if(it.type==='stick') inventory.stick += 1;
      else if(it.type==='workbench') inventory.workbench += 1;
      else if(it.type==='bow') inventory.bow += 1;
      craftingSlots[i]=null;
    }
    dragItem = null;
    backpackOpen = false;
  }
  function closeBackpackDelete(){
    // delete items in crafting slots (no refund)
    for(let i=0;i<craftingSlots.length;i++) craftingSlots[i]=null;
    dragItem = null;
    backpackOpen = false;
  }
  function tryAutofill(kind){
    // kind: 'sticks' means recipe was 2 plank -> 4 sticks; need to place 2 plank
    // kind: 'plank'  means recipe was 2 wood  -> 1 plank; need to place 2 wood
    if(kind==='workbench'){
      // Refill 2x2 with planks for workbench if we have at least 4 and grid is empty
      const allEmpty = craftingSlots.every(s=>!s);
      if(!allEmpty) return;
      if(inventory.plank < 4) return;
      craftingSlots[0] = {type:'plank'};
      craftingSlots[1] = {type:'plank'};
      craftingSlots[2] = {type:'plank'};
      craftingSlots[3] = {type:'plank'};
      inventory.plank -= 4;
      return;
    }
    if(kind==='bow'){
      // place 3 sticks into empty slots if available
      let have = inventory.stick; if(have < 3) return;
      const empties=[]; for(let i=0;i<craftingSlots.length;i++) if(!craftingSlots[i]) empties.push(i);
      if(empties.length < 3) return;
      craftingSlots[empties[0]] = { type: 'stick' };
      craftingSlots[empties[1]] = { type: 'stick' };
      craftingSlots[empties[2]] = { type: 'stick' };
      inventory.stick -= 3;
      return;
    }
    let needType=null; if(kind==='sticks') needType='plank'; else if(kind==='plank') needType='wood';
    if(!needType) return;
    let have = (needType==='wood')? inventory.wood : inventory.plank;
    if(have < 2) return;
    const empties=[]; for(let i=0;i<craftingSlots.length;i++) if(!craftingSlots[i]) empties.push(i);
    if(empties.length < 2) return;
    craftingSlots[empties[0]] = { type: needType };
    craftingSlots[empties[1]] = { type: needType };
    if(needType==='wood') inventory.wood -= 2; else inventory.plank -= 2;
  }
  function craftAttempt(){
    // First try: 2x2 shape all planks -> 1 workbench (shaped recipe)
    const s0=craftingSlots[0]?.type, s1=craftingSlots[1]?.type, s2=craftingSlots[2]?.type, s3=craftingSlots[3]?.type;
    if(s0==='plank' && s1==='plank' && s2==='plank' && s3==='plank'){
      craftingSlots[0]=craftingSlots[1]=craftingSlots[2]=craftingSlots[3]=null;
      inventory.workbench += 1;
      pickupTexts.push({x: player.x, y: player.y-10, txt: '工作台 +1', color:'#9aa5b1', a:1, vy:-28});
      tryAutofill('workbench');
      return;
    }
    // Next: 3 sticks -> 1 bow (shapeless)
    let sticksIdx = [];
    for(let i=0;i<craftingSlots.length;i++) if(craftingSlots[i]?.type==='stick') sticksIdx.push(i);
    if(sticksIdx.length>=3){
      // remove any 3
      for(let k=0;k<3;k++){ craftingSlots[sticksIdx[k]] = null; }
      inventory.bow += 1;
      pickupTexts.push({x: player.x, y: player.y-10, txt: '弓 +1', color:'#ffd166', a:1, vy:-28});
      tryAutofill('bow');
      return;
    }
    // Note: do not handle list selection logic here; craftAttempt should only process recipes
    // Next: 2 plank -> 4 sticks (shapeless)
    let planksIdx = [];
    for(let i=0;i<craftingSlots.length;i++) if(craftingSlots[i]?.type==='plank') planksIdx.push(i);
    if(planksIdx.length>=2){
      const i1 = planksIdx[0], i2 = planksIdx[1];
      craftingSlots[i1]=null; craftingSlots[i2]=null;
      inventory.stick += 4;
      pickupTexts.push({x: player.x, y: player.y-10, txt: '木棍 +4', color:'#c8aa7a', a:1, vy:-28});
      tryAutofill('sticks');
      return;
    }
    // Next: 2 plank -> 4 sticks
    planksIdx = [];
    for(let i=0;i<craftingSlots.length;i++) if(craftingSlots[i]?.type==='plank') planksIdx.push(i);
    if(planksIdx.length>=2){
      const i1 = planksIdx[0], i2 = planksIdx[1];
      craftingSlots[i1]=null; craftingSlots[i2]=null;
      inventory.stick += 4;
      pickupTexts.push({x: player.x, y: player.y-10, txt: '木棍 +4', color:'#c8aa7a', a:1, vy:-28});
      tryAutofill('sticks');
      return;
    }
    // Fallback: 2 wood -> 1 plank
    let woodsIdx = [];
    for(let i=0;i<craftingSlots.length;i++) if(craftingSlots[i]?.type==='wood') woodsIdx.push(i);
    if(woodsIdx.length>=2){
      const i1 = woodsIdx[0], i2 = woodsIdx[1];
      craftingSlots[i1]=null; craftingSlots[i2]=null;
      inventory.plank += 1;
      pickupTexts.push({x: player.x, y: player.y-10, txt: '木板 +1', color:'#e0d4a3', a:1, vy:-28});
      tryAutofill('plank');
      return;
    }
  }
  // Spawn control
  let spawnEnabled = true;
  try{
    const u = new URL(window.location.href);
    const p = u.searchParams.get('spawn');
    if(p!==null) spawnEnabled = !(p==='0' || p==='false');
  }catch(_){/* noop */}
  window.setSpawnEnabled = (v)=>{ spawnEnabled = !!v; };
  window.toggleSpawn = ()=>{ spawnEnabled = !spawnEnabled; return spawnEnabled; };
  function cancelTreeInteraction(){
    player.target = null; selectedTreeId = null; chop.active=false; chop.treeId=null; chop.time=0; chop.total=0;
    selectedRockId = null; mine.active=false; mine.rockId=null; mine.time=0; mine.total=0;
    selectedOreId = null; oreMine.active=false; oreMine.oreId=null; oreMine.time=0; oreMine.total=0;
  }
  const EnemyTypes = {
    // armor: flat reduction that applies only while shield>0; shieldMax: shield capacity
    normal: { hp: 40, spd: 80, atk: 12, aggro: 180, touchR: 14, color: '#ff6b6b', wallCollideR: 6, armor: 8, shieldMax: 15 },
    runner: { hp: 28, spd: 130, atk: 9, aggro: 200, touchR: 12, color: '#f6c90e', wallCollideR: 6, armor: 1, shieldMax: 5 },
    tank:   { hp: 80, spd: 60, atk: 18, aggro: 160, touchR: 16, color: '#6c5ce7', wallCollideR: 8, armor: 4, shieldMax: 30 },
    brute:  { hp: 150, spd: 85, atk: 22, aggro: 180, touchR: 24, color: '#d35400', wallCollideR: 16, armor: 6, shieldMax: 80 },
    // cow: 中立生物，不主动攻击，没有索敌圈和警戒圈，被攻击会巡逻
    cow:    { hp: 60, spd: 50, atk: 0, aggro: 0, touchR: 16, color: '#8b7355', wallCollideR: 8, armor: 0, shieldMax: 0 }
  };
  function makeEnemy(type){
    const t = EnemyTypes[type]||EnemyTypes.normal;
    return { x: 0, y: 0, vx: 0, vy: 0, spd: t.spd, hp: t.hp, hpMax: t.hp, atk: t.atk, aggro: t.aggro, r: t.touchR, alive: true, t: 0, turn: 0, atkCd: 0, type, color: t.color, wallR: t.wallCollideR,
      attack: false, state: 'rest', patrolSince: 0, lastHealCycle: 0, armor: (t.armor||0), shieldMax: (t.shieldMax||0), shield: (t.shieldMax||0), lastShieldHour: undefined, lastShieldCycle: undefined,
      restHoursForShield: 0, lastRestHourStamp: undefined };
  }

  // Apply damage to enemy with armor/shield logic.
  function applyEnemyDamage(e, rawDmg){
    let dmg = Math.max(0, rawDmg);
    // Armor only works while shield > 0
    if((e.shield||0) > 0){
      const ar = Math.max(0, e.armor||0);
      dmg = Math.max(0, dmg - ar);
    }
    if(dmg<=0) return 0;
    // Deplete shield first
    let applied = 0;
    if((e.shield||0) > 0){
      const used = Math.min(dmg, e.shield);
      e.shield -= used; applied += used; dmg -= used;
    }
    if(dmg>0){
      const used = Math.min(dmg, e.hp);
      e.hp -= used; applied += used; dmg -= used;
    }
    return applied;
  }
  function spawnEnemies(n){
    if(!spawnEnabled) return;
    const { rng } = world;
    for(let i=0;i<n;i++){
      const ex = (rng.int(2000)-1000);
      const ey = (rng.int(2000)-1000);
      const tp = i%5===0 ? 'tank' : (i%3===0 ? 'runner' : 'normal');
      const e = makeEnemy(tp);
      let pos = findLandNear(ex, ey, 80, 240, 24);
      if(!pos || isWaterArea(pos.x, pos.y, 14)) pos = nearestLandTile(ex, ey, 160);
      if(pos && !isTreeFree(pos.x, pos.y, e.r)){
        const alt = findClearNear(pos.x, pos.y, 30, 160, 24);
        if(alt) pos = alt; else { continue; }
      }
      if(!pos) continue; // couldn't find acceptable land nearby
      // enforce minimum distance from player for initial batch
      const dp0 = Math.hypot((pos.x - player.x), (pos.y - player.y));
      if(dp0 < 720){
        const altFar = findLandNear(player.x, player.y, 900, 1700, 24);
        if(altFar) pos = altFar; else { continue; }
      }
      e.x = pos.x; e.y = pos.y; enemies.push(e);
    }
  }
  // scatter more initial enemies across a wide area
  spawnEnemies(24);
  
  // 生成中立牛
  function spawnCows(n){
    const { rng } = world;
    for(let i=0;i<n;i++){
      const ex = (rng.int(3000)-1500);
      const ey = (rng.int(3000)-1500);
      const e = makeEnemy('cow');
      let pos = findLandNear(ex, ey, 80, 240, 24);
      if(!pos || isWaterArea(pos.x, pos.y, 14)) pos = nearestLandTile(ex, ey, 160);
      if(pos && !isTreeFree(pos.x, pos.y, e.r)){
        const alt = findClearNear(pos.x, pos.y, 30, 160, 24);
        if(alt) pos = alt; else { continue; }
      }
      if(!pos) continue;
      // 确保牛不会离玩家太近
      const dp0 = Math.hypot((pos.x - player.x), (pos.y - player.y));
      if(dp0 < 300){
        const altFar = findLandNear(player.x, player.y, 400, 800, 24);
        if(altFar) pos = altFar; else { continue; }
      }
      e.x = pos.x; e.y = pos.y; enemies.push(e);
    }
  }
  // 生成8-12只牛在世界各地
  spawnCows(8 + Math.floor(Math.random() * 5));
  
  let spawnTimer = 2.5;
  let timeAlive = 0;
  let dayTime = 0;           // seconds progressed in day
  const dayLength = 60;      // full cycle seconds
  dayTime = dayLength*0.5;   // start at 12:00 noon
  let totalHours = (dayTime/dayLength)*24; // monotonically increasing game hours
  // Now that world is initialized (below) and thresholds are defined, ensure trees exist
  function dynamicSpawn(dt){
    timeAlive += dt;
    dayTime = (dayTime + dt) % dayLength;
    totalHours += dt * (24/dayLength);
    spawnTimer -= dt;
    if(spawnEnabled && spawnTimer<=0){
      const { rng } = world;
      const roll = rng.float();
      // Original distribution: 6% brute, 14% tank, 30% runner, 50% normal
      const tp = roll<0.06? 'brute' : roll<0.20? 'tank' : roll<0.50? 'runner' : 'normal';
      const e = makeEnemy(tp);
      // spawn farther from player
      let pos = findLandNear(player.x, player.y, 900, 1700, 42);
      if(!pos || isWaterArea(pos.x, pos.y, 14)) pos = nearestLandTile(player.x, player.y, 240);
      if(pos && !isTreeFree(pos.x, pos.y, e.r)){
        const alt = findClearNear(pos.x, pos.y, 40, 200, 28);
        if(alt) pos = alt; else { spawnTimer = 0.8; return; }
      }
      if(!pos) { spawnTimer = 0.8; return; }
      // guard: ensure not too close even after fallback adjustments
      const dp = Math.hypot((pos.x - player.x), (pos.y - player.y));
      if(dp < 780){ spawnTimer = 0.6; return; }
      e.x = pos.x; e.y = pos.y;
      enemies.push(e);
      const base = 2.2, gain = Math.max(0.5, 2.2 - timeAlive*0.02);
      spawnTimer = gain + rng.float()*0.6;
    }
  }

  // ==========================================
  // SECTION 5: 输入处理
  // ==========================================
  
  // Input
  const keys = new Set();
  window.addEventListener('keydown', (e)=>{ 
    if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyR','Tab','KeyG','KeyF','KeyE'].includes(e.code)) e.preventDefault(); 
    if(e.code==='Tab'){
      // If workbench is open, close it (refund items) and DO NOT open backpack
      if(benchOpen){
        if(currentBench && currentBench.slots){
          for(let i=0;i<currentBench.slots.length;i++){
            const it=currentBench.slots[i]; if(!it) continue;
            if(it.type==='wood') inventory.wood+=1; 
            else if(it.type==='gem') inventory.gem+=1; 
            else if(it.type==='stone') inventory.stone+=1; 
            else if(it.type==='plank') inventory.plank+=1; 
            else if(it.type==='stick') inventory.stick+=1; 
            else if(it.type==='workbench') inventory.workbench+=1; 
            currentBench.slots[i]=null; 
          }
        }
        dragItem=null; benchOpen=false; currentBench=null; 
        return;
      }
      // If chest is open, just close (no refund logic)
      if(chestOpen){
        dragItem=null; chestOpen=false; currentChest=null;
        return;
      }
      // Otherwise toggle backpack
      if(backpackOpen){ closeBackpackRefund(); backpackSelectedType = null; }
      else { backpackOpen = true; uiPanel='bag'; backpackSelectedType = null; }
      return; 
    } 
    if(e.code==='KeyG'){ showAggroRings = !showAggroRings; return; } 
    if(e.code==='KeyF'){
      // Cancel bow charging without firing
      if(player.bowCharging){ player.bowCharging=false; player.bowCharge=0; sfxSlash(); }
      return;
    }
    if(e.code==='KeyE'){
      // 在地下城中，优先检查门
      if(inDungeon && currentDungeonId){
        const dungeon = dungeons.get(currentDungeonId);
        if(dungeon){
          // 检查是否靠近门
          for(const door of dungeon.doors){
            const dist = Math.hypot(player.x - door.x, player.y - door.y);
            if(dist < 35){
              door.open = !door.open;
              sfxPickup();
              return;
            }
          }
          
          // 检查是否在出口
          const exitDist = Math.hypot(player.x - dungeon.exitPoint.x, player.y - dungeon.exitPoint.y);
          if(exitDist < 50){
            inDungeon = false;
            // 传送回地表入口
            for(const entrance of dungeonEntrances){
              if(entrance.dungeonId === currentDungeonId){
                player.x = entrance.x;
                player.y = entrance.y + 60;
                camera.x = player.x - canvas.width / 2;
                camera.y = player.y - canvas.height / 2;
                break;
              }
            }
            currentDungeonId = null;
            sfxPickup();
            return;
          }
        }
      } else {
        // 尝试进入地下城
        for(const entrance of dungeonEntrances){
          const dist = Math.hypot(player.x - entrance.x, player.y - entrance.y);
          if(dist < 50){
            inDungeon = true;
            currentDungeonId = entrance.dungeonId;
            const dungeon = dungeons.get(currentDungeonId);
            if(dungeon){
              player.x = dungeon.spawnPoint.x;
              player.y = dungeon.spawnPoint.y;
              camera.x = player.x - canvas.width / 2;
              camera.y = player.y - canvas.height / 2;
              // 生成地下城敌人
              for(const enemyData of dungeon.enemies){
                if(!enemyData.spawned){
                  const e = makeEnemy(enemyData.type);
                  e.x = enemyData.x;
                  e.y = enemyData.y;
                  enemies.push(e);
                  enemyData.spawned = true;
                }
              }
              sfxPickup();
            }
            break;
          }
        }
      }
      return;
    }
    keys.add(e.code); 
  });
  // Mouse wheel to scroll backpack list
  canvas.addEventListener('wheel',(e)=>{
    if(!backpackOpen) return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY) * 40;
    backpackScroll = Math.max(0, Math.min((backpackLayout?.maxScroll||0), backpackScroll + delta));
  }, { passive:false });
  window.addEventListener('keyup', (e)=>{ keys.delete(e.code); });
  canvas.addEventListener('mousemove',(e)=>{
    const r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; 
    // Activate drag from list if moved beyond threshold
    if(backpackOpen && listDragArmed && listMouseDown && !listDragActive){
      const dx = mouse.x - listMouseDown.x, dy = mouse.y - listMouseDown.y;
      if(Math.hypot(dx,dy) > DRAG_THRESH && (performance.now()-listMouseDownTime)>=DRAG_MIN_MS){
        if(invCount(listMouseDown.type)>0){ dragItem = { type: listMouseDown.type, origin:'list' }; listDragActive=true; backpackSelectedType=null; }
      }
    }
    // scrollbar drag (backpack)
    if(backpackOpen && scrollDrag && backpackLayout && backpackLayout.scrollbar){
      const sc = backpackLayout.scrollbar; const dy = mouse.y - scrollDragStartY; const trackMov = Math.max(1, sc.h - sc.thumbH);
      const ratio = Math.max(0, Math.min(1, ((sc.thumbY - sc.y) + dy) / trackMov));
      backpackScroll = Math.round(ratio * (backpackLayout.maxScroll||0));
    }
    // scrollbar drag (bench)
    if(benchOpen && scrollDrag && benchLayout && benchLayout.scrollbar){
      const sc = benchLayout.scrollbar; const dy = mouse.y - scrollDragStartY; const trackMov = Math.max(1, sc.h - sc.thumbH);
      const ratio = Math.max(0, Math.min(1, ((sc.thumbY - sc.y) + dy) / trackMov));
      benchScroll = Math.round(ratio * (sc.maxScroll||0));
    }
    // scrollbar drag (chest)
    if(chestOpen && scrollDrag && chestLayout && chestLayout.scrollbar){
      const sc = chestLayout.scrollbar; const dy = mouse.y - scrollDragStartY; const trackMov = Math.max(1, sc.h - sc.thumbH);
      const ratio = Math.max(0, Math.min(1, ((sc.thumbY - sc.y) + dy) / trackMov));
      chestScroll = Math.round(ratio * (sc.maxScroll||0));
    }
  });

  // Wheel scrolling for bench list (same feel as backpack)
  canvas.addEventListener('wheel',(e)=>{
    if(!benchOpen || !benchLayout || !benchLayout.listViewport) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const v = benchLayout.listViewport;
    const inside = (mx>=v.x && mx<=v.x+v.w && my>=v.y && my<=v.y+v.h);
    if(!inside) return;
    const delta = Math.sign(e.deltaY) * 40; // step per wheel
    benchScroll = Math.max(0, Math.min((benchLayout.scrollbar?.maxScroll)||0, benchScroll + delta));
    e.preventDefault();
  }, { passive:false });
  // Wheel scrolling for chest list
  canvas.addEventListener('wheel',(e)=>{
    if(!chestOpen || !chestLayout || !chestLayout.listViewport) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const v = chestLayout.listViewport;
    const inside = (mx>=v.x && mx<=v.x+v.w && my>=v.y && my<=v.y+v.h);
    if(!inside) return;
    const delta = Math.sign(e.deltaY) * 40;
    chestScroll = Math.max(0, Math.min((chestLayout.scrollbar?.maxScroll)||0, chestScroll + delta));
    e.preventDefault();
  }, { passive:false });
  canvas.addEventListener('mousedown',(e)=>{ 
    if(e.button===0){
      mouse.down=true; 
      // Start bow charging if equipped and not in UI modes
      if(!backpackOpen && !benchOpen && !chestOpen && !placeMode.active && player.equipped==='bow'){
        player.bowCharging = true; if(player.bowCharge<=0) player.bowCharge = 0; return;
      }
      // removed chest style button handling (was causing ReferenceError)
      if(backpackOpen){
        // detect buttons, scrollbar, list single-click selection, then 2x2 slots placement
        const mx = mouse.x, my = mouse.y;
        // scrollbar interactions (track click or thumb drag)
        if(backpackLayout && backpackLayout.scrollbar){
          const sc = backpackLayout.scrollbar;
          const withinTrack = (mx>=sc.x && mx<=sc.x+sc.w && my>=sc.y && my<=sc.y+sc.h);
          if(withinTrack){
            if(my>=sc.thumbY && my<=sc.thumbY+sc.thumbH){ scrollDrag=true; scrollDragStartY=my; scrollStartScroll=backpackScroll; return; }
            const ratio = Math.max(0, Math.min(1, (my - sc.y - sc.thumbH/2) / Math.max(1, (sc.h - sc.thumbH)) ));
            backpackScroll = Math.round(ratio * (backpackLayout.maxScroll||0));
            return;
          }
        }
        // buttons first (inside highlighted row)
        // Handle primary buttons (equip/unequip)
        if(backpackLayout && Array.isArray(backpackLayout.primaryBtns)){
          for(const b of backpackLayout.primaryBtns){
            if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h){
              const t=b.type;
              // Placement buttons
              if(t==='plank'){ placeMode.active=true; placeMode.type='wall'; placeMode.skipClick=true; closeBackpackRefund(); return; }
              if(t==='stoneWall'){ placeMode.active=true; placeMode.type='stoneWall'; placeMode.skipClick=true; closeBackpackRefund(); return; }
              if(t==='workbench'){ placeMode.active=true; placeMode.type='bench'; placeMode.skipClick=true; closeBackpackRefund(); return; }
              if(t==='chest'){ placeMode.active=true; placeMode.type='chest'; placeMode.skipClick=true; closeBackpackRefund(); return; }
              // Apple consumption
              if(t==='apple'){ if(inventory.apple>0){ inventory.apple--; const gain=(player.foodMax||1)*0.20; player.food = Math.min((player.foodMax||0), (player.food||0)+gain); pickupTexts.push({x:player.x,y:player.y-10,txt:`食物 +${Math.round((gain/(player.foodMax||1))*100)}%`,color:'#4ade80',a:1,vy:-28}); sfxPickup(); } return; }
              // Equipment buttons with mutual exclusion
              if(t==='bow'||t==='pickaxe'||t==='stoneAxe'||t==='stoneSword'){
                // Check if trying to equip when already equipped with another item
                if(player.equipped!==t && player.equipped!=='none'){
                  const now = performance.now();
                  if(now - (lastHintAt||0) > 800){
                    lastHintAt = now;
                    centerHints.push({ txt:'请先卸下手上的工具', until: now + 1200 });
                  }
                  return;
                }
                // Toggle equip/unequip
                if(t==='bow'){ player.equipped = (player.equipped==='bow'?'none':'bow'); return; }
                if(t==='pickaxe'){ player.equipped = (player.equipped==='pickaxe'?'none':'pickaxe'); return; }
                if(t==='stoneAxe'){ player.equipped = (player.equipped==='stoneAxe'?'none':'stoneAxe'); return; }
                if(t==='stoneSword'){ player.equipped = (player.equipped==='stoneSword'?'none':'stoneSword'); return; }
              }
            }
          }
        }
        // craft button
        if(backpackLayout.craftBtn){ const b=backpackLayout.craftBtn; if(mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h){ craftAttempt(); return; } }
        // list single-click selects type
        if(backpackLayout && Array.isArray(backpackLayout.list)){
          for(const it of backpackLayout.list){ if(mx>=it.x&&mx<=it.x+it.w&&my>=it.y&&my<=it.y+it.h){ backpackSelectedType=it.type; return; } }
        }
        // 2x2 crafting slots: only place selected type into empty
        if(backpackLayout && Array.isArray(backpackLayout.slots)){
          for(let i=0;i<backpackLayout.slots.length;i++){
            const s = backpackLayout.slots[i]; if(!s) continue;
            if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){
              if(!craftingSlots[i] && backpackSelectedType && invDec(backpackSelectedType)){
                craftingSlots[i] = { type: backpackSelectedType };
              }
              return;
            }
          }
        }
      } else if(benchOpen && currentBench){
        const mx = mouse.x, my = mouse.y;
        // primary button actions（与背包一致）优先于列表点击，避免被行点击拦截
        if(benchLayout && Array.isArray(benchLayout.primaryBtns)){
          for(const b of benchLayout.primaryBtns){
            if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h){
              const t=b.type;
              if(t==='plank'){ placeMode.active=true; placeMode.type='wall'; placeMode.skipClick=true; benchOpen=false; currentBench=null; backpackSelectedType=null; return; }
              if(t==='stoneWall'){ placeMode.active=true; placeMode.type='stoneWall'; placeMode.skipClick=true; benchOpen=false; currentBench=null; backpackSelectedType=null; return; }
              if(t==='workbench'){ placeMode.active=true; placeMode.type='bench'; placeMode.skipClick=true; benchOpen=false; currentBench=null; backpackSelectedType=null; return; }
              if(t==='chest'){ placeMode.active=true; placeMode.type='chest'; placeMode.skipClick=true; benchOpen=false; currentBench=null; backpackSelectedType=null; return; }
              // Equipment mutual exclusion check
              if(t==='bow'||t==='pickaxe'||t==='stoneAxe'||t==='stoneSword'){
                if(player.equipped!==t && player.equipped!=='none'){
                  const now = performance.now();
                  if(now - (lastHintAt||0) > 800){
                    lastHintAt = now;
                    centerHints.push({ txt:'请先卸下手上的工具', until: now + 1200 });
                  }
                  return;
                }
                if(t==='bow'){ player.equipped = (player.equipped==='bow'?'none':'bow'); return; }
                if(t==='pickaxe'){ player.equipped = (player.equipped==='pickaxe'?'none':'pickaxe'); return; }
                if(t==='stoneAxe'){ player.equipped = (player.equipped==='stoneAxe'?'none':'stoneAxe'); return; }
                if(t==='stoneSword'){ player.equipped = (player.equipped==='stoneSword'?'none':'stoneSword'); return; }
              }
              if(t==='apple'){ if(inventory.apple>0){ inventory.apple--; const gain=(player.foodMax||1)*0.20; player.food = Math.min((player.foodMax||0), (player.food||0)+gain); pickupTexts.push({x:player.x,y:player.y-10,txt:`食物 +${Math.round((gain/(player.foodMax||1))*100)}%`,color:'#4ade80',a:1,vy:-28}); sfxPickup(); } return; }
            }
          }
        }
        // 列表单击选中类型
        for(const it of (benchLayout.list||[])){
          if(mx>=it.x && mx<=it.x+it.w && my>=it.y && my<=it.y+it.h){ backpackSelectedType = it.type; return; }
        }
        // 槽位单击：仅在空格放入选中物品
        for(let i=0;i<benchLayout.slots.length;i++){
          const s = benchLayout.slots[i];
          if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){
            if(!currentBench.slots[i] && backpackSelectedType){
              let placed=false;
              if(typeof invDec==='function' && invDec(backpackSelectedType)) placed=true;
              else {
                const t=backpackSelectedType;
                if(t==='wood' && inventory.wood>0){ inventory.wood--; placed=true; }
                else if(t==='gem' && inventory.gem>0){ inventory.gem--; placed=true; }
                else if(t==='plank' && inventory.plank>0){ inventory.plank--; placed=true; }
                else if(t==='stick' && inventory.stick>0){ inventory.stick--; placed=true; }
                else if(t==='workbench' && inventory.workbench>0){ inventory.workbench--; placed=true; }
                else if(t==='chest' && inventory.chest>0){ inventory.chest--; placed=true; }
                else if(t==='bow' && inventory.bow>0){ inventory.bow--; placed=true; }
                else if(t==='apple' && inventory.apple>0){ inventory.apple--; placed=true; }
              }
              if(placed) currentBench.slots[i] = { type: backpackSelectedType };
            }
            return;
          }
        }
      } else if(chestOpen && currentChest){
        const mx = mouse.x, my = mouse.y;
        // scrollbar on chest list
        if(chestLayout && chestLayout.scrollbar){
          const sc = chestLayout.scrollbar; const withinTrack = (mx>=sc.x && mx<=sc.x+sc.w && my>=sc.y && my<=sc.y+sc.h);
          if(withinTrack){
            if(my>=sc.thumbY && my<=sc.thumbY+sc.thumbH){ scrollDrag=true; scrollDragStartY=my; scrollStartScroll=chestScroll; return; }
            const ratio = Math.max(0, Math.min(1, (my - sc.y - sc.thumbH/2) / Math.max(1, (sc.h - sc.thumbH)) ));
            chestScroll = Math.round(ratio * (sc.maxScroll||0));
            return;
          }
        }
        // list single-click selects type
        for(const it of (chestLayout.list||[])){
          if(mx>=it.x && mx<=it.x+it.w && my>=it.y && my<=it.y+it.h){ backpackSelectedType = it.type; return; }
        }
        // slots: place/take
        for(let i=0;i<chestLayout.slots.length;i++){
          const s = chestLayout.slots[i];
          if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){
            if(!currentChest.slots[i] && backpackSelectedType){
              let placed=false;
              if(typeof invDec==='function' && invDec(backpackSelectedType)) placed=true;
              else {
                const t=backpackSelectedType;
                if(t==='wood' && inventory.wood>0){ inventory.wood--; placed=true; }
                else if(t==='gem' && inventory.gem>0){ inventory.gem--; placed=true; }
                else if(t==='plank' && inventory.plank>0){ inventory.plank--; placed=true; }
                else if(t==='stick' && inventory.stick>0){ inventory.stick--; placed=true; }
                else if(t==='workbench' && inventory.workbench>0){ inventory.workbench--; placed=true; }
                else if(t==='chest' && inventory.chest>0){ inventory.chest--; placed=true; }
                else if(t==='bow' && inventory.bow>0){ inventory.bow--; placed=true; }
                else if(t==='apple' && inventory.apple>0){ inventory.apple--; placed=true; }
              }
              if(placed) currentChest.slots[i] = { type: backpackSelectedType };
            }
            return;
          }
        }
      }
    }
    if(e.button===2) cancelTreeInteraction();
  });
  canvas.addEventListener('click', (e)=>{
    // placement mode takes precedence
    if(placeMode.active){
      if(placeMode.skipClick){ placeMode.skipClick=false; return; }
      const r = canvas.getBoundingClientRect();
      const wp = toWorld(e.clientX - r.left, e.clientY - r.top);
      const sx = snapCenterX(wp.x), sy = snapCenterY(wp.y);
      // only place if valid and we have item
      if(placeMode.type==='wall' && inventory.plank>0){
        // simple checks: on land and not colliding with tree/wall; avoid duplicate at same cell
        let duplicate=false; for(const w of walls){ if(Math.abs(w.x - sx) < 1 && Math.abs(w.y - sy) < 1){ duplicate=true; break; } }
        const tooClosePlayer = Math.hypot(sx - player.x, sy - player.y) <= (cell/2 + 12);
        if(!duplicate && !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2))){
          walls.push({ x: sx, y: sy, r: cell/2, hp: 60, hpMax: 60, type: 'wood' });
          inventory.plank -= 1;
          sfxPickup();
        }
      } else if(placeMode.type==='stoneWall' && inventory.stoneWall>0){
        // 放置石墙（更坚固）
        let duplicate=false; for(const w of walls){ if(Math.abs(w.x - sx) < 1 && Math.abs(w.y - sy) < 1){ duplicate=true; break; } }
        const tooClosePlayer = Math.hypot(sx - player.x, sy - player.y) <= (cell/2 + 12);
        if(!duplicate && !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2))){
          walls.push({ x: sx, y: sy, r: cell/2, hp: 120, hpMax: 120, type: 'stone' });
          inventory.stoneWall -= 1;
          sfxPickup();
        }
      } else if(placeMode.type==='bench' && inventory.workbench>0){
        // place workbench similar checks
        let duplicate=false; for(const b of benches){ if(Math.abs(b.x - sx) < 1 && Math.abs(b.y - sy) < 1){ duplicate=true; break; } }
        const tooClosePlayer = Math.hypot(sx - player.x, sy - player.y) <= (cell/2 + 12);
        if(!duplicate && !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2))){
          benches.push({ x: sx, y: sy, r: cell/2 });
          inventory.workbench -= 1;
          sfxPickup();
        }
      } else if(placeMode.type==='chest' && inventory.chest>0){
        let duplicate=false; for(const c of chests){ if(Math.abs(c.x - sx) < 1 && Math.abs(c.y - sy) < 1){ duplicate=true; break; } }
        const tooClosePlayer = Math.hypot(sx - player.x, sy - player.y) <= (cell/2 + 12);
        if(!duplicate && !tooClosePlayer && !isWaterArea(sx, sy, cell*0.4) && !collidesTree(sx, sy, 10) && !collidesRock(sx, sy, 10) && !collidesOre(sx, sy, 10) && !collidesWall(sx, sy, Math.max(1, cell/2 - 2))){
          chests.push({ x: sx, y: sy, r: cell/2, slots: new Array(32).fill(null) });
          inventory.chest -= 1;
          sfxPickup();
        }
      }
      placeMode.active=false; placeMode.type=null;
      return;
    }
    if(backpackOpen || benchOpen || chestOpen) return;
    if(skipWorldClickOnce){ skipWorldClickOnce=false; return; }
    const r = canvas.getBoundingClientRect();
    const wp = toWorld(e.clientX - r.left, e.clientY - r.top);
    // do not trigger tree interaction while bow is charging
    if(player.bowCharging) return;
    // open bench UI when clicking near a placed bench
    {
      let bestB=null, bdB=1e9; 
      for(const b of benches){
        const dClick = Math.hypot(b.x-wp.x, b.y-wp.y);
        const dPlayer = Math.hypot(b.x-player.x, b.y-player.y);
        if(dClick<18 && dPlayer<=64 && dClick<bdB){ bestB=b; bdB=dClick; }
      }
      if(bestB){ benchOpen=true; currentBench=bestB; backpackSelectedType=null; mouse.down=false; return; }
    }
    // 地下城宝箱点击
    if(inDungeon && currentDungeonId){
      const dungeon = dungeons.get(currentDungeonId);
      if(dungeon){
        for(const chest of dungeon.chests){
          if(chest.opened) continue;
          const dClick = Math.hypot(chest.x - wp.x, chest.y - wp.y);
          const dPlayer = Math.hypot(chest.x - player.x, chest.y - player.y);
          if(dClick < 24 && dPlayer <= 60){
            // 打开宝箱并获得物品
            chest.opened = true;
            for(const item of chest.loot){
              if(inventory[item.type] !== undefined){
                inventory[item.type] = (inventory[item.type] || 0) + item.amount;
                pickupTexts.push({
                  x: chest.x, 
                  y: chest.y - 20,
                  txt: `+${item.amount} ${item.type}`,
                  color: '#fbbf24',
                  a: 1,
                  vy: -28
                });
              }
            }
            sfxPickup();
            return;
          }
        }
      }
    }
    // open chest UI when clicking near a placed chest
    {
      let bestC=null, bdC=1e9;
      for(const c of chests){
        const dClick = Math.hypot(c.x-wp.x, c.y-wp.y);
        const dPlayer = Math.hypot(c.x-player.x, c.y-player.y);
        if(dClick<18 && dPlayer<=64 && dClick<bdC){ bestC=c; bdC=dClick; }
      }
      if(bestC){ chestOpen=true; currentChest=bestC; backpackSelectedType=null; mouse.down=false; player.bowCharging=false; player.bowCharge=0; return; }
    }
    // start tree interaction (approach and chop) if clicked near a tree
    let best=null, bd=1e9;
    for(const t of trees){ const d=Math.hypot(t.x-wp.x, t.y-wp.y); if(d<18 && d<bd){ best=t; bd=d; } }
    if(best){ selectedTreeId = best.id; chop.active=false; chop.treeId=null; chop.time=0; chop.total=0; mouse.down=false; // stop shooting
      // set target slightly below canopy to stand under
      player.target = { x: best.x, y: best.y - 6 };
      return;
    }
    // start rock interaction (approach and mine) if clicked near a rock
    let bestRock=null, bdRock=1e9;
    for(const ro of rocks){ const d=Math.hypot(ro.x-wp.x, ro.y-wp.y); if(d<18 && d<bdRock){ bestRock=ro; bdRock=d; } }
    if(bestRock){ selectedRockId = bestRock.id; mine.active=false; mine.rockId=null; mine.time=0; mine.total=0; mouse.down=false;
      player.target = { x: bestRock.x, y: bestRock.y };
      return;
    }
    // start ore interaction (requires pickaxe equipped)
    let bestOre=null, bdOre=1e9;
    for(const ore of ores){ const d=Math.hypot(ore.x-wp.x, ore.y-wp.y); if(d<18 && d<bdOre){ bestOre=ore; bdOre=d; } }
    if(bestOre){
      if(player.equipped !== 'pickaxe'){
        // show hint that pickaxe is required
        const now = performance.now();
        if(now - (lastHintAt||0) > 800){
          lastHintAt = now;
          centerHints.push({ txt:'需要装备石镐才能挖掘矿石', until: now + 1200 });
        }
      } else {
        selectedOreId = bestOre.id; oreMine.active=false; oreMine.oreId=null; oreMine.time=0; oreMine.total=0; mouse.down=false;
        player.target = { x: bestOre.x, y: bestOre.y };
      }
    }
  });
  canvas.addEventListener('mouseup',(e)=>{ if(e.button===0){
    mouse.down=false;
    scrollDrag=false;
    // Release bow shot if charging
    if(player.bowCharging && !backpackOpen && !benchOpen && !chestOpen){
      // require ammo: currently using 'stick' as arrow
      if(invCount('stick')<=0){ player.bowCharging=false; player.bowCharge=0; beep(180,0.06,'square'); return; }
      const pct = Math.max(0, Math.min(1, player.bowCharge / (player.bowChargeMax||1)));
      const baseDmg = 18;
      let dmg = baseDmg * (0.5 + 0.5*pct); // scale with charge
      if(pct>=1) dmg *= 1.5; // +50% bonus at full charge
      const baseSpread = Math.PI/4; // 45 deg
      let spread = baseSpread * (1 - pct);
      const aim = Math.atan2((mouse.y+camera.y)-player.y, (mouse.x+camera.x)-player.x);
      // movement penalties/bonuses with decay
      const pen = player.movePen||0; // 0..1
      if(pen>0){ spread *= (1 + 0.5*pen); spread = Math.max(spread, (Math.PI/12)*pen); }
      const ang = aim + (Math.random()*2-1)*spread;
      const spd = 520; const vx = Math.cos(ang)*spd, vy = Math.sin(ang)*spd;
      let range = BOWCFG.range * (0.2 + 0.8*pct); // 20%..100%
      if(pen>0) range *= (1 - 0.5*pen); // up to -50%
      // consume one arrow (stick)
      invDec('stick');
      const full = (pct>=1);
      bullets.push({ x: player.x, y: player.y, vx, vy, r:3, dmg, alive:true, isArrow:true, range, dist: 0, trail: full? []: null });
      sfxShoot();
      // Decide whether to skip next world click based on mouseup position over a tree
      const r1 = canvas.getBoundingClientRect();
      const wp1 = toWorld(e.clientX - r1.left, e.clientY - r1.top);
      let overTree=false; for(const t of trees){ const d=Math.hypot(t.x-wp1.x, t.y-wp1.y); if(d<18){ overTree=true; break; } }
      player.bowCharging=false; player.bowCharge=0; skipWorldClickOnce = overTree; return;
    }
    // Handle backpack 2x2 crafting drop
    if(backpackOpen && dragItem){
      const mx=mouse.x,my=mouse.y;
      let placed=false;
      for(let i=0;i<(backpackLayout.slots?backpackLayout.slots.length:0);i++){
        const s=backpackLayout.slots[i]; if(!s) continue;
        if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y&&my<=s.y+s.h){
          if(!craftingSlots[i]){
            if(dragItem.origin==='list'){
              if(invDec(dragItem.type)){ craftingSlots[i]={type:dragItem.type}; placed=true; }
            } else if(dragItem.origin==='slot'){
              craftingSlots[i]={type:dragItem.type}; placed=true;
            }
          }
          break;
        }
      }
      if(!placed){
        // if origin was slot and not placed into any slot, return to inventory
        if(dragItem.origin==='slot'){
          if(dragItem.type==='wood') inventory.wood += 1;
          else if(dragItem.type==='gem') inventory.gem += 1;
          else if(dragItem.type==='stone') inventory.stone += 1;
          else if(dragItem.type==='plank') inventory.plank += 1;
          else if(dragItem.type==='stick') inventory.stick += 1;
          else if(dragItem.type==='workbench') inventory.workbench += 1;
        }
      }
      dragItem=null;
      return;
    }
    // Handle workbench 3x3 crafting drop
    if(benchOpen && currentBench && dragItem){
      const mx=mouse.x,my=mouse.y;
      for(let i=0;i<benchLayout.slots.length;i++){
        const s=benchLayout.slots[i];
        if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y&&my<=s.y+s.h){
          if(!currentBench.slots[i]){
            if(dragItem.origin==='list'){
              if(invDec(dragItem.type)){ currentBench.slots[i]={type:dragItem.type}; dragItem=null; return; }
            } else if(dragItem.origin==='bench'){
              currentBench.slots[i]={type:dragItem.type}; dragItem=null; return;
            } else if(dragItem.origin==='slot'){
              // from backpack craft slots into bench slot: do not allow, just return to inventory below
            }
          }
        }
      }
    }
  }});
  // Double-click to start drag (from list or occupied slots)
  canvas.addEventListener('dblclick',(e)=>{
    if(!backpackOpen && !benchOpen && !chestOpen) return;
    e.preventDefault();
    const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
    // try list drag first
    if(backpackOpen && backpackLayout && Array.isArray(backpackLayout.list)){
      for(const it of backpackLayout.list){
        if(mx>=it.x && mx<=it.x+it.w && my>=it.y && my<=it.y+it.h){ if(invCount && invCount(it.type)>0){ dragItem = { type: it.type, origin:'list' }; } return; }
      }
    }
    if(benchOpen && benchLayout && Array.isArray(benchLayout.list)){
      for(const it of benchLayout.list){
        if(mx>=it.x && mx<=it.x+it.w && my>=it.y && my<=it.y+it.h){ if(invCount && invCount(it.type)>0){ dragItem = { type: it.type, origin:'list' }; } return; }
      }
    }
    if(chestOpen && chestLayout && Array.isArray(chestLayout.list)){
      for(const it of chestLayout.list){
        if(mx>=it.x && mx<=it.x+it.w && my>=it.y && my<=it.y+it.h){ if(invCount && invCount(it.type)>0){ dragItem = { type: it.type, origin:'list' }; } return; }
      }
    }
    // then try occupied slots
    if(benchOpen && benchLayout){
      for(let i=0;i<benchLayout.slots.length;i++){ const s=benchLayout.slots[i]; if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y&&my<=s.y+s.h){ if(currentBench.slots[i]){ dragItem={type:currentBench.slots[i].type, origin:'bench', slotIndex:i}; currentBench.slots[i]=null; return; } } }
    }
    if(chestOpen && chestLayout){
      // double-click no longer returns items for chest; right-click handles it instead
    }
    if(backpackOpen && backpackLayout){
      for(let i=0;i<backpackLayout.slots.length;i++){ const s=backpackLayout.slots[i]; if(!s) continue; if(mx>=s.x&&mx<=s.x+s.w&&my>=s.y&&my<=s.y+s.h){ if(craftingSlots[i]){ dragItem={type:craftingSlots[i].type, origin:'slot', slotIndex:i}; craftingSlots[i]=null; return; } } }
    }
  });
  canvas.addEventListener('contextmenu',(e)=>{ 
    e.preventDefault();
    // Right-click cancels current UI actions
    if(backpackOpen){
      const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
      // Right-click on crafting slot to remove item and return to inventory
      if(backpackLayout && Array.isArray(backpackLayout.slots)){
        for(let i=0;i<backpackLayout.slots.length;i++){
          const s=backpackLayout.slots[i];
          if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){
            const it=craftingSlots[i];
            if(it){
              const t=it.type;
              if(t==='wood') inventory.wood+=1; else if(t==='gem') inventory.gem+=1; else if(t==='stone') inventory.stone+=1; else if(t==='plank') inventory.plank+=1; else if(t==='stick') inventory.stick+=1; else if(t==='workbench') inventory.workbench+=1; else if(t==='chest') inventory.chest+=1; else if(t==='bow') inventory.bow+=1; else if(t==='apple') inventory.apple+=1;
              craftingSlots[i]=null; sfxPickup();
              return;
            }
            break;
          }
        }
      }
      dragItem=null; listMouseDown=null; listDragArmed=false; listDragActive=false; backpackSelectedType=null; return;
    }
    if(benchOpen){
      dragItem=null; backpackSelectedType=null; return;
    }
    if(chestOpen){
      const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
      // if right-click over an occupied chest slot, return item to backpack
      if(chestLayout && Array.isArray(chestLayout.slots)){
        for(let i=0;i<chestLayout.slots.length;i++){
          const s=chestLayout.slots[i];
          if(mx>=s.x && mx<=s.x+s.w && my>=s.y && my<=s.y+s.h){
            const it=currentChest?.slots?.[i];
            if(it){
              const t=it.type;
              if(t==='wood') inventory.wood+=1; else if(t==='gem') inventory.gem+=1; else if(t==='stone') inventory.stone+=1; else if(t==='plank') inventory.plank+=1; else if(t==='stick') inventory.stick+=1; else if(t==='workbench') inventory.workbench+=1; else if(t==='chest') inventory.chest+=1; else if(t==='bow') inventory.bow+=1; else if(t==='apple') inventory.apple+=1;
              currentChest.slots[i]=null; sfxPickup();
              return;
            }
            break;
          }
        }
      }
      // otherwise just cancel selection/drag
      dragItem=null; backpackSelectedType=null; return;
    }
    // Cancel placement mode and tree interaction in world
    placeMode.active=false; placeMode.type=null;
    cancelTreeInteraction(); 
  });
  let audioCtx = null;
  function beep(freq, dur, type){ try{ if(!audioCtx) return; const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type=type||'square'; o.frequency.value=freq; o.connect(g); g.connect(audioCtx.destination); const t=audioCtx.currentTime; g.gain.setValueAtTime(0.06,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur);}catch(_){} }
  function sfxShoot(){ beep(740,0.05,'square'); }
  function sfxHit(){ beep(220,0.04,'sawtooth'); }
  function sfxPickup(){ beep(880,0.06,'triangle'); }
  function sfxSlash(){ beep(520,0.06,'triangle'); }
  canvas.addEventListener('mousedown',(e)=>{ if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(_){} }
    if(backpackOpen){
      if(backpackLayout && backpackLayout.sideBtns){
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const b1 = backpackLayout.sideBtns.bag, b2 = backpackLayout.sideBtns.skills;
        if(b1 && mx>=b1.x && mx<=b1.x+b1.w && my>=b1.y && my<=b1.y+b1.h){ uiPanel='bag'; beep(520,0.03,'square'); }
        else if(b2 && mx>=b2.x && mx<=b2.x+b2.w && my>=b2.y && my<=b2.y+b2.h){ uiPanel='skills'; beep(620,0.03,'square'); }
      }
    }
    // Bench craft button click
    if(benchOpen && benchLayout && benchLayout.craftBtn){
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const b = benchLayout.craftBtn;
      if(mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h){
        if(performBenchCraft()){
          // prevent other actions this click
          mouse.down=false; e.preventDefault(); return;
        }
      }
    }
    // Bench scrollbar interactions
    if(benchOpen && benchLayout && benchLayout.scrollbar){
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const sc = benchLayout.scrollbar; const withinTrack = (mx>=sc.x && mx<=sc.x+sc.w && my>=sc.y && my<=sc.y+sc.h);
      if(withinTrack){
        if(my>=sc.thumbY && my<=sc.thumbY+sc.thumbH){ scrollDrag=true; scrollDragStartY=my; scrollStartScroll=benchScroll; return; }
        const ratio = Math.max(0, Math.min(1, (my - sc.y - sc.thumbH/2) / Math.max(1, (sc.h - sc.thumbH)) ));
        benchScroll = Math.round(ratio * (sc.maxScroll||0));
        return;
      }
    }
  });
  if(miniMinus) miniMinus.addEventListener('click',()=>{ minimapStep = Math.max(1, minimapStep-1); beep(520,0.03,'square'); });
  if(miniPlus)  miniPlus.addEventListener('click',()=>{ minimapStep = Math.max(minimapStep, Math.min(24, minimapStep+1)); beep(620,0.03,'square'); });

  // ==========================================
  // SECTION 6: 游戏循环与更新
  // ==========================================
  
  function update(dt){
    // Pause simulation when backpack is open
    if(backpackOpen){
      camera.x = player.x - canvas.width/2; camera.y = player.y - canvas.height/2;
      return;
    }
    if(benchOpen||chestOpen){ camera.x = player.x - canvas.width/2; camera.y = player.y - canvas.height/2; return; }
    // Food-based modifiers (affect regen and movement)
    const secPerHour = dayLength/24;
    const foodPct0 = (player.foodMax? (player.food/(player.foodMax||1)) : 0);
    let hpRegenMul = 1, stamRegenMul = 1, moveMul = 1;
    if(foodPct0 < 0.5){ hpRegenMul *= 0.5; stamRegenMul *= 0.5; }
    if(foodPct0 < 0.1){ hpRegenMul = 0; stamRegenMul = 0.1; moveMul *= 0.5; }
    if((player.food||0) <= 0){ stamRegenMul = 0; }

    // estimate player moving state from position delta
    const spdNow = Math.hypot(player.x - _prevPX, player.y - _prevPY) / Math.max(1e-6, dt);
    player.moving = spdNow > 5; _prevPX = player.x; _prevPY = player.y;
    // movement penalty ramps in/out over 1.2s
    const ramp = dt / 1.2;
    if(player.moving){ player.movePen = Math.min(1, player.movePen + ramp); }
    else if(player.movePen>0){ player.movePen = Math.max(0, player.movePen - ramp); }
    // ensure world content is generated around current view
    ensureTreeChunksNear();
    // melee/ranged cooldown tick
    melee.cd = Math.max(0, melee.cd - dt);
    player.rangedCd = Math.max(0, player.rangedCd - dt);
    // bow charge tick
    if(player.equipped==='bow' && player.bowCharging && !backpackOpen && !benchOpen && !chestOpen && !placeMode.active){
      const cap = player.moving? (0.8*player.bowChargeMax) : player.bowChargeMax; // 80% cap while moving
      const pullRate = (0.2*player.bowChargeMax)/1.2; // per second to reach 80% from 100%
      // move charge towards the target cap: increase up to cap, or pull down to cap
      if(player.bowCharge < cap){
        player.bowCharge = Math.min(cap, player.bowCharge + dt);
      } else if(player.bowCharge > cap){
        player.bowCharge = Math.max(cap, player.bowCharge - pullRate*dt);
      }
    }
    // player regen: after delay without damage
    const nowMs2 = performance.now();
    if(!player.dead && player.hp < player.hpMax){
      if(nowMs2 - (player.lastHitAt||0) > player.regenDelay){
        const regen = player.regenRate * Math.max(0, hpRegenMul);
        if(regen>0) player.hp = Math.min(player.hpMax, player.hp + regen*dt);
      }
    }
    // Starvation: at 0 food, HP decays 10% per in-game hour
    if((player.food||0) <= 0 && !player.dead){
      const starveRate = (player.hpMax||1) * 0.10 / secPerHour; // per second
      player.hp = Math.max(0, player.hp - starveRate*dt);
    }
    if(player.dead){
      // cancel any interaction while dead
      player.target = null; selectedTreeId = null; chop.active=false; chop.treeId=null; chop.time=0;
      if(!player.backpackReset){
        // refund crafting slot items to inventory first, then clear inventory
        closeBackpackRefund();
        clearInventory();
        player.backpackReset = true;
      }
      player.respawn -= dt;
      if(player.respawn<=0){ player.dead=false; player.hp=player.hpMax; player.x=0; player.y=0; player.iUntil = performance.now()+1200; player.backpackReset=false; resetInventoryToStarter(); }
      camera.x = player.x - canvas.width/2; camera.y = player.y - canvas.height/2;
      return;
    }
    const shiftHeld = (keys.has('ShiftLeft')||keys.has('ShiftRight'));
    const canSprintNow = shiftHeld && (player.stamina>0);
    let spd = canSprintNow ? player.sprint : player.speed;
    spd *= moveMul; // slow movement at low food
    if(player.bowCharging) spd *= 0.5; // charging slows movement by 50%
    let dx=0, dy=0;
    if(keys.has('KeyW')){ dy-=1; player.dir='up'; }
    if(keys.has('KeyS')){ dy+=1; player.dir='down'; }
    if(keys.has('KeyA')){ dx-=1; player.dir='left'; }
    if(keys.has('KeyD')){ dx+=1; player.dir='right'; }
    const manual = (keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD'));
    if(manual){ cancelTreeInteraction(); }
    // Auto approach selected tree if no manual input and not chopping
    if(!manual && !chop.active && !mine.active && selectedTreeId){
      const t = trees.find(tr => tr.id===selectedTreeId);
      if(t){
        const dTree = Math.hypot(t.x - player.x, t.y - player.y);
        if(dTree <= CHOP_RANGE){
          const chopTime = (player.equipped==='stoneAxe' ? 1.0 : 2.0); // Stone axe 2x faster
          chop.active=true; chop.time=chopTime; chop.total=chopTime; chop.treeId=t.id; player.target=null;
        }else if(player.target){
          const tx = player.target.x, ty = player.target.y;
          const vx = tx - player.x, vy = ty - player.y; const d = Math.hypot(vx,vy)||1;
          dx = vx/d; dy = vy/d;
        }
      } else {
        // tree no longer exists
        cancelTreeInteraction();
      }
    }
    // Auto approach selected rock if no manual input and not mining
    if(!manual && !mine.active && !chop.active && !oreMine.active && selectedRockId){
      const ro = rocks.find(r => r.id===selectedRockId);
      if(ro){
        const dRock = Math.hypot(ro.x - player.x, ro.y - player.y);
        if(dRock <= MINE_RANGE){
          const mineTime = (player.equipped==='pickaxe' ? 2.0 : 4.0); // Stone pick 2x faster
          mine.active=true; mine.time=mineTime; mine.total=mineTime; mine.rockId=ro.id; player.target=null;
        }else if(player.target){
          const tx = player.target.x, ty = player.target.y;
          const vx = tx - player.x, vy = ty - player.y; const d = Math.hypot(vx,vy)||1;
          dx = vx/d; dy = vy/d;
        }
      } else {
        // rock no longer exists
        cancelTreeInteraction();
      }
    }
    // Auto approach selected ore if no manual input and not mining (requires pickaxe)
    if(!manual && !oreMine.active && !mine.active && !chop.active && selectedOreId && player.equipped === 'pickaxe'){
      const ore = ores.find(o => o.id===selectedOreId);
      if(ore){
        const dOre = Math.hypot(ore.x - player.x, ore.y - player.y);
        if(dOre <= MINE_RANGE){
          oreMine.active=true; oreMine.time=6.0; oreMine.total=6.0; oreMine.oreId=ore.id; player.target=null;
        }else if(player.target){
          const tx = player.target.x, ty = player.target.y;
          const vx = tx - player.x, vy = ty - player.y; const d = Math.hypot(vx,vy)||1;
          dx = vx/d; dy = vy/d;
        }
      } else {
        // ore no longer exists
        cancelTreeInteraction();
      }
    }
    const len = Math.hypot(dx,dy)||1; dx/=len; dy/=len;
    // attempt movement with collision detection
    const nx = player.x + dx*spd*dt;
    const ny = player.y + dy*spd*dt;
    
    if(inDungeon){
      // 地下城中只能在房间和走廊内移动
      if(isInDungeonWalkable(nx, player.y)) player.x = nx;
      if(isInDungeonWalkable(player.x, ny)) player.y = ny;
    } else {
      // 地表碰撞检测
      if(!isWater(nx, player.y) && !collidesTree(nx, player.y, 10) && !collidesRock(nx, player.y, 10) && !collidesOre(nx, player.y, 10) && !collidesWall(nx, player.y, 6)) player.x = nx;
      if(!isWater(player.x, ny) && !collidesTree(player.x, ny, 10) && !collidesRock(player.x, ny, 10) && !collidesOre(player.x, ny, 10) && !collidesWall(player.x, ny, 6)) player.y = ny;
    }
    // Stamina & Food systems
    const sprinting = canSprintNow && (dx!==0 || dy!==0);
    const chargingActive = (player.equipped==='bow' && player.bowCharging);
    const fullCharge = (player.equipped==='bow' && player.bowCharge >= (player.bowChargeMax||1) - 1e-6);
    // If out of stamina, disallow maintaining charge unless already full; cancel partial charge
    if(chargingActive && !fullCharge && (player.stamina||0) <= 0){ player.bowCharging=false; player.bowCharge=0; }
    // Stamina recovery rate: 100% over 3 in-game hours
    const stamRecPerSec = (player.staminaMax||1) / (3 * secPerHour); // = staminaMax * 8 / dayLength
    const sprintUsePerSec = stamRecPerSec * 2;
    const chargeUsePerSec = stamRecPerSec * 2;
    let recovering = false;
    // No recovery while sprinting or charging; exception: full charge recovers instead of consuming
    if((chargingActive && fullCharge) || (!sprinting && !chargingActive)) recovering = true;
    // Apply stamina changes
    let dStam = 0;
    if(sprinting) dStam -= sprintUsePerSec * dt;
    if(chargingActive && !fullCharge) dStam -= chargeUsePerSec * dt;
    if(recovering) dStam += stamRecPerSec * Math.max(0, stamRegenMul) * dt;
    const prevStam = player.stamina||0;
    if(dStam!==0){ player.stamina = Math.max(0, Math.min(player.staminaMax||0, prevStam + dStam)); }
    const recoveringNow = (player.stamina||0) > prevStam + 1e-6; // only if actually increased
    // Food decay: base 25% per day, doubled when stamina is recovering and doubled while sprinting
    const foodBasePerSec = (player.foodMax||1) * 0.25 / dayLength;
    let foodFactor = 1; if(recoveringNow) foodFactor *= 2; if(sprinting) foodFactor *= 2; if(chargingActive) foodFactor *= 2;
    const dFood = foodBasePerSec * foodFactor * dt;
    player.food = Math.max(0, (player.food||0) - dFood);
    player.foodAccel = foodFactor > 1; player.foodAccelFactor = foodFactor;
    if(keys.has('KeyR')){
      // regenerate world and reset state
      world = newWorld(0);
      if(seedView) seedView.textContent = world.seed;
      // place player at nearest land near origin
      let p = nearestLandTile(0,0,200);
      if(p && !isTreeFree(p.x, p.y, 10)){
        const alt = findClearNear(0,0, 40, 220, 30);
        if(alt) p = alt;
      }
      player.x = p? p.x : 0; player.y = p? p.y : 0;
      player.hp=player.hpMax; player.dead=false;
      enemies.length=0; bullets.length=0; particles.length=0; drops.length=0; clearInventory(); trees.length=0; regenerateTrees(); closeBackpackDelete(); resetInventoryToStarter(); player.backpackReset=false;
      timeAlive=0; dayTime=dayLength*0.5; spawnTimer=2.5;
      spawnEnemies(10);
    }

    // Camera follows
    camera.x = player.x - canvas.width/2; camera.y = player.y - canvas.height/2;

    // Chopping timer
    if(chop.active){ chop.time -= dt; if(chop.time<=0){
      // Finish chop: remove tree and drop wood
      const idx = trees.findIndex(tr=>tr.id===chop.treeId);
      if(idx>=0){ const tr=trees[idx];
        trees.splice(idx,1);
        drops.push({ x: tr.x, y: tr.y, r: 5, a: 1, val: 1+Math.floor(Math.random()*2), type:'wood' });
        if(tr.type==='apple'){
          const amt = 1 + Math.floor(Math.random()*2); // 1-2 apples
          if(amt>0) drops.push({ x: tr.x+6, y: tr.y-4, r: 5, a:1, val: amt, type:'apple' });
        }
      }
      chop.active=false; chop.treeId=null;
    } }

    // Mining timer (4 seconds for rocks)
    if(mine.active){ mine.time -= dt; if(mine.time<=0){
      // Finish mining: remove rock and drop stone
      const idx = rocks.findIndex(ro=>ro.id===mine.rockId);
      if(idx>=0){ const ro=rocks[idx];
        rocks.splice(idx,1);
        drops.push({ x: ro.x, y: ro.y, r: 5, a: 1, val: 1+Math.floor(Math.random()*2), type:'stone' });
      }
      mine.active=false; mine.rockId=null;
    } }

    // Ore mining timer (6 seconds, requires pickaxe)
    if(oreMine.active){ oreMine.time -= dt; if(oreMine.time<=0){
      // Finish mining: remove ore and drop corresponding ore type
      const idx = ores.findIndex(o=>o.id===oreMine.oreId);
      if(idx>=0){ const ore=ores[idx];
        ores.splice(idx,1);
        drops.push({ x: ore.x, y: ore.y, r: 5, a: 1, val: 1+Math.floor(Math.random()*2), type: ore.type });
      }
      oreMine.active=false; oreMine.oreId=null;
    } }

    player.cd -= dt;
    if(mouse.down && !backpackOpen && !benchOpen && !placeMode.active && !selectedTreeId && !selectedRockId && !selectedOreId){
      if(player.equipped!=='bow' && !player.bowCharging){
        // hold to chain melee; attempt only when off cooldown
        if(melee.cd<=0) attemptMelee();
      }
    }

    for(const b of bullets){ if(!b.alive) continue; 
      // trail for full-charge arrows as white particles
      if(b.isArrow && b.trail){
        b.trail.push({x:b.x,y:b.y,a:0.9});
        // fade out existing particles
        for(let i=0;i<b.trail.length;i++){ b.trail[i].a -= 2.0*dt; }
        // remove invisible particles and clamp count
        b.trail = b.trail.filter(t=>t.a>0);
        if(b.trail.length>24) b.trail.splice(0, b.trail.length-24);
      }
      b.x += b.vx*dt; b.y += b.vy*dt; const spd = Math.hypot(b.vx,b.vy); b.dist = (b.dist||0) + spd*dt; if(b.range && b.dist>=b.range) b.alive=false; if(Math.hypot(b.x-player.x, b.y-player.y)>2200) b.alive=false; }
    
    // rebuild flow-field when player moved grid or每300ms
    const now = performance.now();
    const pgx = cellOfX(player.x), pgy = cellOfY(player.y);
    if(!flowField.data || flowField.lastPgx!==pgx || flowField.lastPgy!==pgy || now - flowField.builtAt > 120){
      buildFlowField();
    }
    // Bullet → Enemy collisions (after bullets updated this frame)
    for(const e of enemies){ if(!e.alive) continue;
      for(const b of bullets){ if(!b.alive) continue;
        const dx = e.x - b.x, dy = e.y - b.y; const d = Math.hypot(dx,dy);
        if(d <= (e.r + (b.r||3))){
          b.alive=false;
          // compute damage with distance falloff for arrows
          let dmg = b.dmg;
          if(b.isArrow){ const ratio = Math.max(0, Math.min(1, (b.dist||0) / Math.max(1,(b.range||1)))); const mult = Math.max(BOWCFG.minMult, 1 - (1-BOWCFG.minMult)*ratio); dmg = b.dmg * mult; }
          const hadShield = (e.shield||0) > 0;
          const applied = applyEnemyDamage(e, dmg);
          e.showHpUntil = performance.now() + 800; if(!e.attack){ e.state='patrol'; e.patrolSince=performance.now(); }
          // particles: white if shield active, else stronger red burst
          if(hadShield){
            for(let i=0;i<8;i++){ const ang=Math.random()*Math.PI*2, sp=70+Math.random()*90; particles.push({ x:e.x, y:e.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:2, a:0.9, color:'#ffffff', fade:1.8 }); }
          } else {
            for(let i=0;i<14;i++){ const ang=Math.random()*Math.PI*2, sp=90+Math.random()*150; particles.push({ x:e.x, y:e.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:2+Math.random()*1.8, a:1.0, color:'#ff1f1f', fade:2.4 }); }
          }
          if(applied>0) damageTexts.push({ x:e.x, y:e.y - e.r - 6, vy:-28, a:1, text: `-${Math.round(applied)}` }); sfxHit();
          if(e.hp<=0){ e.alive=false; if(world.rng.float()<0.35){ const amt = 1 + world.rng.int(3); drops.push({x:e.x,y:e.y,r:6,a:1,val:amt,type:'gem'}); } }
        }
      }
    }
    for(const e of enemies){
      if(!e.alive) continue;
      e.t += dt; e.turn -= dt;
      const dxp = player.x - e.x, dyp = player.y - e.y; const dp = Math.hypot(dxp,dyp)||1;
      const alertR = e.aggro*1.5;
      const nowMs = performance.now();
      // brute group shout buff
      if(e.type==='brute'){
        if(!e.nextShoutAt) e.nextShoutAt = nowMs + 4000 + Math.random()*4000;
        if(nowMs >= e.nextShoutAt){
          e.nextShoutAt = nowMs + 6000 + Math.random()*5000;
          const rad = 220;
          for(const o of enemies){ if(!o.alive) continue; const d=Math.hypot(o.x-e.x,o.y-e.y); if(d<=rad){ o.speedBuffUntil = nowMs + 2500; o.speedBuffMul = 1.35; } }
          beep(180,0.08,'sawtooth');
        }
      }
      // state transitions
      if(e.state==='rest'){
        // hourly heal: 24h -> 60% max => per hour heal = 0.6/24 of max
        if(e.lastHealHour===undefined) e.lastHealHour = Math.floor(totalHours);
        const curHour = Math.floor(totalHours);
        if(curHour > e.lastHealHour){
          e.lastHealHour = curHour;
          const amount = e.hpMax * (0.6/24);
          e.hp = Math.min(e.hpMax, e.hp + amount);
        }
        // shield regen: requires continuous rest. After every full 3 hours in rest, restore 25% of shieldMax.
        if(e.lastRestHourStamp===undefined) e.lastRestHourStamp = totalHours;
        const dhrs = Math.max(0, totalHours - e.lastRestHourStamp);
        e.lastRestHourStamp = totalHours;
        e.restHoursForShield = (e.restHoursForShield||0) + dhrs;
        if(e.restHoursForShield >= 3){
          const cycles = Math.floor(e.restHoursForShield / 3);
          e.restHoursForShield -= cycles * 3;
          const gain = (e.shieldMax||0) * 0.25 * cycles;
          if(gain>0) e.shield = Math.min((e.shieldMax||0), (e.shield||0) + gain);
        }
        // 牛不会因为玩家靠近而进入patrol，只有被攻击才会
        if(e.type !== 'cow' && dp < alertR){ e.state='patrol'; e.patrolSince = performance.now(); }
      } else if(e.state==='patrol'){
        if(dp < e.aggro){ e.attack = true; }
        const since = performance.now() - (e.patrolSince||0);
        // 牛在patrol状态总长一些（10秒），其他敌人5秒
        const patrolDuration = (e.type === 'cow') ? 10000 : 5000;
        if(!e.attack && since > patrolDuration){ e.state='rest'; e.restHoursForShield = 0; e.lastRestHourStamp = totalHours; }
      }
      if(e.attack && dp > e.aggro*1.5){ e.attack=false; if(e.state!=='rest') e.state='patrol'; }

      if(e.attack){
        // prefer flow-field direction if available
        let dir = sampleFlowDir(e.x, e.y);
        if(e.type==='brute'){
          // handle charge behavior: fixed-direction dash for fixed distance
          if(!e.charging){
            if(!e.chargeReadyAt) e.chargeReadyAt = nowMs + 1200 + Math.random()*1200;
            if(nowMs>=e.chargeReadyAt && dp>100){
              e.charging=true; e.chargeMul=2.2; e.chargeDir = { x: dxp/dp, y: dyp/dp }; e.chargeRemain = 260; e.chargeHit=false; // dash distance (px)
            }
          }
          if(e.charging){
            // move strictly along chargeDir, ignore avoidance/blend, to rush player
            const vx = e.chargeDir.x, vy = e.chargeDir.y;
            const spdEff = getEnemySpeed(e, nowMs);
            e.vx = vx * spdEff; e.vy = vy * spdEff; e.turn = 0.05;
            // attempt movement and consume distance
            const step = spdEff * dt;
            const ex2 = e.x + e.vx*dt, ey2 = e.y + e.vy*dt; const wallRad = e.wallR||6;
            let blockedX2 = collidesWall(ex2, e.y, wallRad), blockedY2 = collidesWall(e.x, ey2, wallRad);
            const tIdx = nearestTree(e.x, e.y, 22);
            if(tIdx>=0){
              const tr = trees[tIdx];
              if(Math.hypot(tr.x - e.x, tr.y - e.y) <= e.r + 10){
                // break the tree and drop wood (reduced by 1 compared to normal)
                trees.splice(tIdx,1);
                const base = 1 + Math.floor(Math.random()*2); // normal: 1-2
                const amt = Math.max(0, base - 1); // reduced by 1 -> 0-1
                if(amt>0) drops.push({ x: tr.x, y: tr.y, r: 5, a: 1, val: amt, type:'wood' });
                if(tr.type==='apple'){
                  const abase = 1 + Math.floor(Math.random()*2); // 1-2
                  const aamt = Math.max(0, abase - 1); // reduced by 1 -> 0-1
                  if(aamt>0) drops.push({ x: tr.x+6, y: tr.y-4, r: 5, a:1, val: aamt, type:'apple' });
                }
                beep(140,0.06,'square');
              }
            }
            // charge hit vs player (once per charge), ignore normal contact damage while charging
            const contactThresh = e.r + 10;
            const dpNow = Math.hypot(player.x - e.x, player.y - e.y);
            if(!e.chargeHit && dpNow < contactThresh && nowMs > player.iUntil){
              player.hp -= 50; player.lastHitAt = nowMs; e.chargeHit = true; player.iUntil = nowMs + 250; sfxHit();
              if(player.hp<=0){ player.dead=true; player.respawn=1.5; player.target=null; selectedTreeId=null; chop.active=false; chop.treeId=null; chop.time=0; closeBackpackRefund(); inventory.gem=0; inventory.wood=0; inventory.plank=0; inventory.stick=0; player.backpackReset = true; }
            }
            // if hit wall while charging, deal damage and end charge immediately
            if(blockedX2 || blockedY2){
              const w = nearestWall(e.x, e.y, 26);
              if(w){ w.hp = Math.max(0, (w.hp!=null?w.hp:60) - 28); if(w.hp<=0){ const idx = walls.indexOf(w); if(idx>=0) walls.splice(idx,1); beep(120,0.06,'square'); } }
              e.charging=false; e.chargeReadyAt = nowMs + 5000 + Math.random()*3000; e.chargeHit=false;
              // don't move further this frame when colliding with wall
            } else {
              if(!isWater(ex2, e.y)) e.x = ex2; else { e.turn = 0; }
              if(!isWater(e.x, ey2)) e.y = ey2; else { e.turn = 0; }
              e.chargeRemain -= step;
              if(e.chargeRemain<=0){ e.charging=false; e.chargeReadyAt = nowMs + 4000 + Math.random()*3000; e.chargeHit=false; }
            }
            // brute smash handled after movement below
            continue;
          }
        }
        if(dir){
          // Move toward the center of the next cell to reduce corner sticking
          const cgx = cellOfX(e.x), cgy = cellOfY(e.y);
          const ngx = cgx + dir[0], ngy = cgy + dir[1];
          const tx = ngx*cell + cell/2, ty = ngy*cell + cell/2;
          const vtx = tx - e.x, vty = ty - e.y; const vl1 = Math.hypot(vtx,vty)||1;
          const vpx = dxp/dp, vpy = dyp/dp;
          // Blend more towards target cell, some towards player
          const kCell = 0.6, kPlayer = 0.25;
          let vx = (vtx/vl1)*kCell + vpx*kPlayer;
          let vy = (vty/vl1)*kCell + vpy*kPlayer;
          // add avoidance
          const av = avoidanceVector(e.x, e.y, e.r+cell*0.6);
          vx += av.x*0.7; vy += av.y*0.7;
          const vl = Math.hypot(vx,vy)||1; const spdEff = getEnemySpeed(e, nowMs); e.vx = vx/vl * spdEff; e.vy = vy/vl * spdEff; e.turn = 0.15;
        } else {
          // direct pursuit + avoidance
          let vx = dxp/dp, vy = dyp/dp;
          const av = avoidanceVector(e.x, e.y, e.r+cell*0.6);
          vx += av.x*0.8; vy += av.y*0.8;
          const vl = Math.hypot(vx,vy)||1; const spdEff = getEnemySpeed(e, nowMs); e.vx = vx/vl * spdEff; e.vy = vy/vl * spdEff; e.turn = 0.3;
        }
      } else if(e.state==='patrol'){
        // patrol/random walk when not attacking
        if(e.turn<=0){ const ang = (world.rng.float()*Math.PI*2); const spdEff = getEnemySpeed(e, nowMs); e.vx = Math.cos(ang)*spdEff; e.vy = Math.sin(ang)*spdEff; e.turn = 1 + world.rng.float()*2; }
      } else if(e.state==='rest'){
        // reduced speed wandering
        const rs = getEnemySpeed(e, nowMs)*0.2;
        if(e.turn<=0){ const ang = (world.rng.float()*Math.PI*2); e.vx = Math.cos(ang)*rs; e.vy = Math.sin(ang)*rs; e.turn = 1 + world.rng.float()*2; }
      }
      const ex = e.x + e.vx*dt; const ey = e.y + e.vy*dt;
      const wallRad = e.wallR||6;
      let blockedX = collidesWall(ex, e.y, wallRad), blockedY = collidesWall(e.x, ey, wallRad);
      if(!isWater(ex, e.y) && !collidesTree(ex, e.y, e.r) && !collidesRock(ex, e.y, e.r) && !collidesOre(ex, e.y, e.r) && !blockedX) e.x = ex; else { e.turn = 0; }
      if(!isWater(e.x, ey) && !collidesTree(e.x, ey, e.r) && !collidesRock(e.x, ey, e.r) && !collidesOre(e.x, ey, e.r) && !blockedY) e.y = ey; else { e.turn = 0; }
      // brute smash walls on impact while charging
      if(e.type==='brute' && e.charging && (blockedX || blockedY)){
        const w = nearestWall(e.x, e.y, 26);
        if(w){ w.hp = Math.max(0, (w.hp!=null?w.hp:60) - 28); if(w.hp<=0){ const idx = walls.indexOf(w); if(idx>=0) walls.splice(idx,1); beep(120,0.06,'square'); } }
      }
      // brute smash rocks on impact while charging (drops stone-1, min 0)
      if(e.type==='brute' && e.charging){
        let nearestRo=null, nearestD=1e9;
        for(const ro of rocks){ const d=Math.hypot(ro.x-e.x, ro.y-e.y); if(d<26 && d<nearestD){ nearestRo=ro; nearestD=d; } }
        if(nearestRo){
          const idx = rocks.indexOf(nearestRo);
          if(idx>=0){
            rocks.splice(idx,1);
            const dropAmt = Math.max(0, Math.floor(Math.random()*2)); // 0-1 stone
            if(dropAmt>0) drops.push({ x: nearestRo.x, y: nearestRo.y, r: 5, a: 1, val: dropAmt, type:'stone' });
            beep(140,0.08,'square');
          }
        }
      }
    }

    const pr = 10;
    for(const e of enemies){
      if(!e.alive) continue;
      const d = Math.hypot(e.x-player.x, e.y-player.y);
      if(d < e.r + pr){
        if(e.atkCd<=0 && performance.now()>player.iUntil){ const hitNow=performance.now(); player.hp -= e.atk; player.lastHitAt = hitNow; e.atkCd = 0.6; player.iUntil = hitNow+250; if(player.hp<=0){ player.dead=true; player.respawn=1.5; player.target=null; selectedTreeId=null; chop.active=false; chop.treeId=null; chop.time=0; closeBackpackRefund(); inventory.gem=0; inventory.wood=0; inventory.plank=0; inventory.stick=0; player.backpackReset = true; } }
      }
    }

    for(let i=enemies.length-1;i>=0;i--) if(!enemies[i].alive) enemies.splice(i,1);
    for(let i=bullets.length-1;i>=0;i--) if(!bullets[i].alive) bullets.splice(i,1);

    for(const p of particles){
      // motion-supporting particle system
      if(p.vx||p.vy){ p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt; const damp=0.92; p.vx*=damp; p.vy*=damp; }
      if(p.dr!=null) p.r += p.dr*dt;
      p.a -= (p.fade!=null? p.fade:1.2)*dt;
    }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].a<=0) particles.splice(i,1);
    // remove dead walls safety (if any reached 0 by other means)
    for(let i=walls.length-1;i>=0;i--) if(walls[i].hp!=null && walls[i].hp<=0) walls.splice(i,1);

    // damage texts
    for(const d of damageTexts){ d.y += d.vy*dt; d.a -= 1.6*dt; }
    for(let i=damageTexts.length-1;i>=0;i--) if(damageTexts[i].a<=0) damageTexts.splice(i,1);

    // Loot drops animation and pickup
    for(const d of drops){ d.a = 0.6 + 0.4*Math.sin(performance.now()/250); }
    const pickR = 10;
    for(let i=drops.length-1;i>=0;i--){ const d=drops[i]; const dist=Math.hypot(d.x-player.x,d.y-player.y); if(dist < pickR + d.r){ 
      if(d.type==='wood'){ inventory.wood += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`木材 +${d.val}`,color:'#c89b6e',a:1,vy:-28}); }
      else if(d.type==='stone'){ inventory.stone += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`石块 +${d.val}`,color:'#8a8a94',a:1,vy:-28}); }
      else if(d.type==='copper'){ inventory.copper += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`铜矿 +${d.val}`,color:'#d97706',a:1,vy:-28}); }
      else if(d.type==='tin'){ inventory.tin += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`锡矿 +${d.val}`,color:'#94a3b8',a:1,vy:-28}); }
      else if(d.type==='iron'){ inventory.iron += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`铁矿 +${d.val}`,color:'#78716c',a:1,vy:-28}); }
      else if(d.type==='silver'){ inventory.silver += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`银矿 +${d.val}`,color:'#e5e7eb',a:1,vy:-28}); }
      else if(d.type==='gold'){ inventory.gold += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`金矿 +${d.val}`,color:'#fbbf24',a:1,vy:-28}); }
      else if(d.type==='darkGold'){ inventory.darkGold += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`黑金矿 +${d.val}`,color:'#a16207',a:1,vy:-28}); }
      else if(d.type==='diamond'){ inventory.diamond += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`钻石 +${d.val}`,color:'#06b6d4',a:1,vy:-28}); }
      else if(d.type==='apple'){ inventory.apple = (inventory.apple||0) + d.val; pickupTexts.push({x:d.x,y:d.y,txt:`苹果 +${d.val}`,color:'#ef4444',a:1,vy:-28}); }
      else { inventory.gem += d.val; pickupTexts.push({x:d.x,y:d.y,txt:`宝石 +${d.val}`,color:'#f5e663',a:1,vy:-28}); }
      sfxPickup(); drops.splice(i,1); } }
    // update pickup floating texts
    for(const t of pickupTexts){ t.y += t.vy*dt; t.a -= 0.9*dt; }
    for(let i=pickupTexts.length-1;i>=0;i--) if(pickupTexts[i].a<=0) pickupTexts.splice(i,1);

    dynamicSpawn(dt);
  }

  // Pixel soldier sprite (8 directions simplified to 4)
  function drawPlayer(){
    const cx = Math.round(player.x - camera.x);
    const cy = Math.round(player.y - camera.y);
    const x = cx - 8, y = cy - 12;
    const px = (n)=>Math.round(n);

    // Colors
    const skin='#f1c27d', outline='#1b1b1b', suit='#2e4a2b', accent='#4caf50';

    // Feet
    ctx.fillStyle=outline; ctx.fillRect(px(x+1),px(y+20),5,3); ctx.fillRect(px(x+10),px(y+20),5,3);
    // Pants
    ctx.fillStyle=suit; ctx.fillRect(px(x+2),px(y+16),12,5);
    // Body
    ctx.fillStyle=suit; ctx.fillRect(px(x+1),px(y+9),14,8);
    // Shoulders
    ctx.fillStyle=accent; ctx.fillRect(px(x+1),px(y+9),3,3); ctx.fillRect(px(x+12),px(y+9),3,3);
    // Head
    ctx.fillStyle=skin; ctx.fillRect(px(x+5),px(y+4),6,6);
    // Helmet
    ctx.fillStyle=suit; ctx.fillRect(px(x+4),px(y+2),8,3);
    // Eyes
    ctx.fillStyle=outline; ctx.fillRect(px(x+6),px(y+6),1,1); ctx.fillRect(px(x+8),px(y+6),1,1);

    // Arms swinging
    ctx.fillStyle=skin;
    const t = performance.now()/200; const swing = Math.sin(t)*1;
    // left arm (draw before bow so bow overlays hand)
    ctx.fillRect(px(x+0),px(y+11+swing),3,6);
    ctx.fillRect(px(x+14),px(y+11-swing),3,6); // right

    // Bow in left hand when equipped
    if(player.equipped==='bow'){
      const bx = px(x+1), by = px(y+11+swing+3);
      ctx.strokeStyle='#c89f6a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(bx+2, by, 6, -Math.PI/2, Math.PI/2); ctx.stroke();
      ctx.strokeStyle='#ddd'; ctx.beginPath(); ctx.moveTo(bx+2, by-6); ctx.lineTo(bx+2, by+6); ctx.stroke();
    }

    // Charge bar (left of player) when charging or partially charged
    if(player.equipped==='bow' && (player.bowCharging || player.bowCharge>0)){
      const cx = Math.round(player.x - camera.x), cy = Math.round(player.y - camera.y);
      const barH = 36, barW = 6; const x0 = cx - 18 - barW, y0 = cy - (barH>>1);
      const pct = Math.max(0, Math.min(1, player.bowCharge / player.bowChargeMax));
      ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(x0-1,y0-1,barW+2,barH+2);
      ctx.fillStyle='#1f2937'; ctx.fillRect(x0,y0,barW,barH);
      const h = Math.floor(barH * pct);
      ctx.fillStyle = pct>=1? '#ffd166' : '#4ade80';
      ctx.fillRect(x0, y0 + (barH-h), barW, h);
      ctx.strokeStyle='#cbd5e1'; ctx.lineWidth=1; ctx.strokeRect(x0+0.5,y0+0.5,barW-1,barH-1);
    }
  }

  function drawEnemies(){
    for(const e of enemies){ if(!e.alive) continue;
      const ex = Math.round(e.x - camera.x), ey = Math.round(e.y - camera.y);
      
      // 牛使用图片，其他敌人使用圆形
      if(e.type === 'cow' && cowImgReady()){
        // 统一使用第一张图片的尺寸作为基准，确保两帧大小一致
        const cowScale = 2.0; // 牛的缩放系数，调整显示大小（缩小到80%）
        const baseSize = e.r * 2 * cowScale; // 基准尺寸（增加缩放）
        const imgWidth = cowImg1.naturalWidth || cowImg1.width;
        const imgHeight = cowImg1.naturalHeight || cowImg1.height;
        const aspectRatio = imgWidth / imgHeight;
        
        // 按高度为基准缩放，保持宽高比（固定使用第一张图片的比例）
        const drawHeight = baseSize;
        const drawWidth = drawHeight * aspectRatio;
        
        ctx.save();
        
        // 根据速度判断朝向
        if(e.vx > 0.1) e.facingRight = true;
        else if(e.vx < -0.1) e.facingRight = false;
        // 如果速度接近0，保持上次朝向（不改变facingRight）
        
        // 移动时的上下抖动效果（只在patrol或attack状态时）
        let bounceOffset = 0;
        if(e.state === 'patrol' || e.attack){ // 只在巡逻或攻击时抖动
          const time = performance.now() * 0.01; // 控制抖动速度
          bounceOffset = Math.sin(time) * 4; // 抖动幅度为4像素（增大一倍）
        }
        
        // 跑动动画：在patrol或attack状态时在两张图片之间切换
        let currentFrame;
        if(e.state === 'patrol' || e.attack){
          // 每200ms切换一次帧（5帧/秒）
          const frameTime = Math.floor(performance.now() / 200) % 2;
          currentFrame = frameTime === 0 ? cowImg1 : cowImg2;
        } else {
          // rest状态使用第一帧
          currentFrame = cowImg1;
        }
        
        // 无论使用哪一帧，都用统一的drawWidth和drawHeight绘制
        // 如果朝右，翻转图片
        if(e.facingRight){
          ctx.translate(ex, ey + bounceOffset);
          ctx.scale(-1, 1);
          ctx.drawImage(currentFrame, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
        } else {
          ctx.drawImage(currentFrame, ex - drawWidth/2, ey - drawHeight/2 + bounceOffset, drawWidth, drawHeight);
        }
        
        ctx.restore();
      } else {
        const c = e.color || '#c33';
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex, ey, e.r, 0, Math.PI*2); ctx.fill();
      }
      // aggro radius (toggle with G)
      if(showAggroRings){
        ctx.save();
        ctx.globalAlpha = 0.10; ctx.fillStyle = '#ff4d4d';
        ctx.beginPath(); ctx.arc(ex, ey, e.aggro, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, e.aggro, 0, Math.PI*2); ctx.stroke();
        // alert ring (1.5x aggro) in orange
        ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffa726';
        ctx.beginPath(); ctx.arc(ex, ey, e.aggro*1.5, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ffa726'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, e.aggro*1.5, 0, Math.PI*2); ctx.stroke();
        // body radius and wall-collision radius
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ex, ey, e.r, 0, Math.PI*2); ctx.stroke();
        const wr = e.wallR||6; ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ab47bc';
        ctx.beginPath(); ctx.arc(ex, ey, wr, 0, Math.PI*2); ctx.stroke();
        // label wallR
        ctx.globalAlpha = 0.8; ctx.fillStyle='#ab47bc'; ctx.font='10px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText(`wallR:${wr}`, ex, ey + (e.r+2));
        ctx.restore();
      }
      // Health/shield bars (show when not full or recently hit/shield not full)
      const pct = Math.max(0,e.hp)/e.hpMax;
      const recentlyHit = e.showHpUntil && performance.now() < e.showHpUntil;
      const sMax = Math.max(0, e.shieldMax||0), sCur = Math.max(0, Math.min(sMax, e.shield||0));
      const showShield = sMax>0 && (sCur < sMax || recentlyHit);
      if(pct < 1 || recentlyHit || showShield){
        // HP bar
        ctx.fillStyle='#222'; ctx.fillRect(ex-12, ey-14, 24, 4);
        ctx.fillStyle='#3c3'; ctx.fillRect(ex-12, ey-14, 24*pct, 4);
        // Shield bar (below HP)
        if(showShield){
          const sp = sMax>0? (sCur/sMax) : 0;
          ctx.fillStyle='#1f2937'; ctx.fillRect(ex-12, ey-9, 24, 3);
          ctx.fillStyle='#4fc3f7'; ctx.fillRect(ex-12, ey-9, 24*sp, 3);
        }
      }
    }
  }

  function drawDamageTexts(){
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.font='12px Segoe UI, Microsoft YaHei';
    for(const d of damageTexts){
      const sx = Math.round(d.x - camera.x), sy = Math.round(d.y - camera.y);
      ctx.globalAlpha = Math.max(0, d.a);
      ctx.fillStyle = d.crit? '#ffd166' : '#ff6b6b';
      ctx.fillText(d.text, sx, sy);
    }
    ctx.restore();
  }

  function drawBullets(){
    for(const b of bullets){
      const cx=Math.round(b.x-camera.x), cy=Math.round(b.y-camera.y);
      // draw trail as white particles
      if(b.isArrow && b.trail && b.trail.length){
        ctx.save();
        for(const t of b.trail){ const tx=Math.round(t.x-camera.x), ty=Math.round(t.y-camera.y); ctx.globalAlpha=Math.max(0, Math.min(1, t.a)); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(tx,ty,2,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      }
      if(b.isArrow){
        ctx.save();
        ctx.translate(cx, cy);
        const ang = Math.atan2(b.vy||0, b.vx||1);
        ctx.rotate(ang);
        // shaft
        ctx.strokeStyle='#ffd166'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(12,0); ctx.stroke();
        // arrow head
        ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(7,-3); ctx.lineTo(7,3); ctx.closePath(); ctx.fill();
        // fletching
        ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(-6,-2); ctx.moveTo(-3,0); ctx.lineTo(-6,2); ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(cx,cy,b.r||3,0,Math.PI*2); ctx.fill();
      }
    }
  }

  function drawDrops(){
    for(const d of drops){
      const cx=Math.round(d.x-camera.x), cy=Math.round(d.y-camera.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, d.a);
      if(d.type==='apple'){
        ctx.fillStyle='#ef4444';
        ctx.beginPath(); ctx.arc(cx, cy, d.r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#14532d'; ctx.fillRect(cx-1, cy-d.r-3, 3, 4);
        ctx.strokeStyle='#7f1d1d'; ctx.lineWidth=1; ctx.stroke();
      } else if(d.type==='wood'){
        ctx.fillStyle='#c89b6e';
        ctx.beginPath(); ctx.arc(cx, cy, d.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='#7a5a3a'; ctx.lineWidth=1; ctx.stroke();
      } else if(d.type==='stone'){
        ctx.fillStyle='#8a8a94';
        ctx.beginPath(); ctx.arc(cx, cy, d.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='#4a4a52'; ctx.lineWidth=1; ctx.stroke();
      } else {
        ctx.fillStyle='#f5e663';
        ctx.beginPath(); ctx.arc(cx, cy, d.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='#b39b2e'; ctx.lineWidth=1; ctx.stroke();
      }
      ctx.globalAlpha=1; ctx.restore();
    }
  }

  // Trees rendering and collision (non-passable)
  function drawTrees(){
    if(STYLE==='pixlake' && tiles.ready){
      for(const t of trees){
        const cx = Math.round(t.x - camera.x), cy = Math.round(t.y - camera.y);
        const s = 2.8; // visual scale = 70% of previous 4x
        // contact shadow proportional to scale (rx=6*s, ry=3*s, offset=3*s)
        ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(cx, cy + Math.round(3*s), Math.round(6*s), Math.round(3*s), 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        // draw scaled tree with bottom-center anchored at (cx,cy)
        ctx.drawImage(tiles.tree, cx - 8*s, cy - 12*s, 16*s, 16*s);
        // apple variant: add small red fruits around canopy ring
        if(t.type==='apple'){
          function hrand(a,b){ let s = Math.imul(73856093, (a|0)) ^ Math.imul(19349663, (b|0)); s ^= s<<13; s ^= s>>>17; s ^= s<<5; s>>>0; return (s & 0x7fffffff)/0x7fffffff; }
          const cnt = 3 + ((hrand(t.x*71,t.y*83)*3)|0); // 3..5
          const baseA = hrand(t.x*91,t.y*47)*Math.PI*2;
          ctx.fillStyle = '#ef4444';
          // canopy approximate center in world (sprite anchored at bottom-center)
          const cxCanopy = cx;
          const cyCanopy = cy - 6*s; // center a bit更靠上
          const ringR = 3.9 * s; // move fruits further inward on the canopy
          // clip fruits within canopy ellipse to guarantee they sit on leaves
          ctx.save(); ctx.beginPath(); ctx.ellipse(cxCanopy, cyCanopy, 6.2*s, 5.2*s, 0, 0, Math.PI*2); ctx.clip();
          for(let i=0;i<cnt;i++){
            const ang = baseA + i*(Math.PI*2/cnt) + (hrand(t.x+i*13,t.y-i*17)-0.5)*0.3;
            const rx = Math.cos(ang)*ringR; const ry = Math.sin(ang)*ringR*0.7; // slightly less squash
            const fx = Math.round(cxCanopy + rx) - 2;
            const fy = Math.round(cyCanopy + ry) - 2;
            ctx.fillRect(fx, fy, 3, 3);
            // small pinkish highlight on top-left pixel
            ctx.fillStyle = '#ffa0a0'; ctx.fillRect(fx, fy, 1, 1); ctx.fillStyle = '#ef4444';
          }
          ctx.restore();
        }
        if(selectedTreeId === t.id){
          const ax = cx, ay = cy - 20;
          ctx.save(); ctx.fillStyle='#e8ff77'; ctx.strokeStyle='#cbdc5a'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-7, ay-10); ctx.lineTo(ax+7, ay-10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      return;
    }
    // fallback: original blob trees
    const pal = tintedPalette();
    for(const t of trees){
      const cx = Math.round(t.x - camera.x), cy = Math.round(t.y - camera.y);
      function hrand(a,b){ let s = Math.imul(73856093, (a|0)) ^ Math.imul(19349663, (b|0)); s ^= s<<13; s ^= s>>>17; s ^= s<<5; s>>>0; return (s & 0x7fffffff)/0x7fffffff; }
      const baseR = 7; const nBlobs = 3 + ((hrand(t.x*3,t.y*5)*2)|0); const body = darken(pal.grass, 0.82);
      ctx.fillStyle = '#5a3d26'; ctx.fillRect(cx-2, cy-10, 4, 22);
      const baseAngle = hrand(t.x*31, t.y*37) * Math.PI * 2;
      for(let i=0;i<nBlobs;i++){
        const ang = baseAngle + i * (Math.PI*2/nBlobs) + (hrand(t.x+i*7, t.y-i*11)-0.5)*0.25;
        const dist = 6.5 + hrand(t.x-i*9, t.y+i*13)*2.5; const rx = Math.cos(ang) * dist; const ry = Math.sin(ang) * dist * 0.6; const lift = 0.8 + hrand(t.x*113+i*3, t.y*197-i*5)*1.2; const r  = baseR + (hrand(t.x+i*17, t.y-i*19)*2 - 1);
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx+rx, cy-12+ry - lift, r, r*2.0, 0, 0, Math.PI*2); ctx.fill();
      }
      if(t.type==='apple'){
        const cnt = 3 + ((hrand(t.x*71,t.y*83)*3)|0); const baseA = hrand(t.x*91,t.y*47)*Math.PI*2;
        for(let i=0;i<cnt;i++){ const ang = baseA + i*(Math.PI*2/cnt) + (hrand(t.x+i*13,t.y-i*17)-0.5)*0.3; const dist = 7 + hrand(t.x-i*29,t.y+i*23)*2.5; const rx = Math.cos(ang)*dist; const ry = Math.sin(ang)*dist*0.6; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cx+rx, cy-14+ry, 2.2, 0, Math.PI*2); ctx.fill(); }
      }
      if(selectedTreeId === t.id){ const ax = cx, ay = cy - 28; ctx.save(); ctx.fillStyle = '#e8ff77'; ctx.strokeStyle = '#cbdc5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 8, ay - 12); ctx.lineTo(ax + 8, ay - 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
  }

  function drawRocks(){
    if(STYLE==='pixlake' && tiles.ready){
      for(const ro of rocks){
        const cx = Math.round(ro.x - camera.x), cy = Math.round(ro.y - camera.y);
        const s = 2.24; // visual scale (80% of 2.8)
        // contact shadow
        ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(cx, cy + Math.round(3*s), Math.round(6*s), Math.round(3*s), 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        // draw scaled rock centered
        ctx.drawImage(tiles.rock, cx - 8*s, cy - 8*s, 16*s, 16*s);
        if(selectedRockId === ro.id){
          const ax = cx, ay = cy - 16;
          ctx.save(); ctx.fillStyle='#d4d4d8'; ctx.strokeStyle='#a1a1aa'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-7, ay-10); ctx.lineTo(ax+7, ay-10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      return;
    }
    // fallback: simple grey circles
    for(const ro of rocks){
      const cx = Math.round(ro.x - camera.x), cy = Math.round(ro.y - camera.y);
      ctx.fillStyle = '#6b6b73'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2; ctx.stroke();
      if(selectedRockId === ro.id){
        const ax = cx, ay = cy - 16;
        ctx.save(); ctx.fillStyle='#d4d4d8'; ctx.strokeStyle='#a1a1aa'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax-7, ay-10); ctx.lineTo(ax+7, ay-10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }

  function collidesTree(x,y,rad){
    const r = (rad||8) + 8; // approximate canopy radius buffer
    const r2 = r*r;
    for(const t of trees){ const dx=t.x-x, dy=t.y-y; if(dx*dx+dy*dy <= r2) return true; }
    return false;
  }

  function collidesRock(x,y,rad){
    const r = (rad||8) + 8; // rock collision radius
    const r2 = r*r;
    for(const ro of rocks){ const dx=ro.x-x, dy=ro.y-y; if(dx*dx+dy*dy <= r2) return true; }
    return false;
  }

  function collidesOre(x,y,rad){
    const r = (rad||8) + 8;
    const r2 = r*r;
    for(const ore of ores){ const dx=ore.x-x, dy=ore.y-y; if(dx*dx+dy*dy <= r2) return true; }
    return false;
  }

  function collidesWall(x,y,rad){
    const r2 = (rad||8);
    const rr = r2; // player radius
    for(const w of walls){ const dx=w.x-x, dy=w.y-y; const R = (w.r + rr); if(dx*dx+dy*dy <= R*R) return true; }
    for(const b of benches){ const dx=b.x-x, dy=b.y-y; const R = (b.r + rr); if(dx*dx+dy*dy <= R*R) return true; }
    return false;
  }

  function nearestWall(x,y,maxDist){
    let best=null, bd=(maxDist||32);
    for(const w of walls){ const d=Math.hypot(w.x-x, w.y-y); if(d<bd){ bd=d; best=w; } }
    return best;
  }
  function nearestTree(x,y,maxDist){
    let bestIdx=-1, bd=(maxDist||24);
    for(let i=0;i<trees.length;i++){ const t=trees[i]; const d=Math.hypot(t.x-x, t.y-y); if(d<bd){ bd=d; bestIdx=i; } }
    return bestIdx;
  }

  function avoidanceVector(wx,wy, radius){
    let ax=0, ay=0; const range = (radius||14) + cell*1.2;
    const range2 = range*range;
    for(const t of trees){ const dx=wx-t.x, dy=wy-t.y; const d2=dx*dx+dy*dy; if(d2<range2){ const d=Math.max(4, Math.hypot(dx,dy)); const push=(range - d)/range; ax += (dx/d)*push; ay += (dy/d)*push; } }
    for(const ro of rocks){ const dx=wx-ro.x, dy=wy-ro.y; const d2=dx*dx+dy*dy; if(d2<range2){ const d=Math.max(4, Math.hypot(dx,dy)); const push=(range - d)/range; ax += (dx/d)*push; ay += (dy/d)*push; } }
    for(const w of walls){ const dx=wx-w.x, dy=wy-w.y; const d2=dx*dx+dy*dy; if(d2<range2){ const d=Math.max(4, Math.hypot(dx,dy)); const push=(range - d)/range; ax += (dx/d)*push; ay += (dy/d)*push; } }
    for(const b of benches){ const dx=wx-b.x, dy=wy-b.y; const d2=dx*dx+dy*dy; if(d2<range2){ const d=Math.max(4, Math.hypot(dx,dy)); const push=(range - d)/range; ax += (dx/d)*push; ay += (dy/d)*push; } }
    const len=Math.hypot(ax,ay)||0; if(len>0){ ax/=len; ay/=len; }
    return {x:ax,y:ay};
  }

  // ===== Flow-field pathfinding (grid BFS towards player) =====
  const flowField = { data:null, gx0:0, gy0:0, w:0, h:0, builtAt:0, lastPgx:0, lastPgy:0 };
  function cellOfX(x){ return Math.floor(x / cell); }
  function cellOfY(y){ return Math.floor(y / cell); }
  function cellKey(gx,gy){ return gx+","+gy; }
  function buildFlowField(){
    const pgx = cellOfX(player.x), pgy = cellOfY(player.y);
    // Build a grid that covers camera view and ALL attacking enemies
    let gx0 = Math.floor(camera.x/cell) - 6;
    let gy0 = Math.floor(camera.y/cell) - 6;
    let gx1 = Math.floor((camera.x+canvas.width)/cell) + 6;
    let gy1 = Math.floor((camera.y+canvas.height)/cell) + 6;
    for(const e of enemies){
      if(!e.alive) continue;
      const dp = Math.hypot(e.x-player.x, e.y-player.y);
      if(e.attack || dp < e.aggro*2){
        const egx = cellOfX(e.x), egy = cellOfY(e.y);
        gx0 = Math.min(gx0, egx-10); gy0 = Math.min(gy0, egy-10);
        gx1 = Math.max(gx1, egx+10); gy1 = Math.max(gy1, egy+10);
      }
    }
    const gw = gx1 - gx0 + 1;
    const gh = gy1 - gy0 + 1;

    // blocked set: water, tree, wall
    const blocked = new Set();
    for(let y=0;y<gh;y++){
      for(let x=0;x<gw;x++){
        const gx = gx0 + x, gy = gy0 + y;
        const cx = gx*cell + cell/2, cy = gy*cell + cell/2;
        if(isWaterArea(cx,cy,cell*0.45)) { blocked.add(cellKey(gx,gy)); continue; }
      }
    }
    for(const t of trees){ blocked.add(cellKey(cellOfX(t.x), cellOfY(t.y))); }
    for(const w of walls){ blocked.add(cellKey(cellOfX(w.x), cellOfY(w.y))); }

    // distances init
    const dist = new Map();
    const q = [];
    // Seed from player cell or nearest unblocked neighbor if blocked
    const targetKey = cellKey(pgx,pgy);
    if(!blocked.has(targetKey)){
      dist.set(targetKey, 0); q.push([pgx,pgy]);
    } else {
      const n8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for(const [dx,dy] of n8){
        const nx=pgx+dx, ny=pgy+dy; const nk=cellKey(nx,ny);
        if(nx<gx0||ny<gy0||nx>gx0+gw-1||ny>gy0+gh-1) continue;
        if(!blocked.has(nk)){ dist.set(nk,0); q.push([nx,ny]); break; }
      }
    }
    // BFS 8-dir to reduce corner sticking; block diagonal corner cutting
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    while(q.length){
      const [cx,cy]=q.shift(); const cd = dist.get(cellKey(cx,cy));
      for(const [dx,dy] of dirs){
        const nx=cx+dx, ny=cy+dy;
        if(nx<gx0||ny<gy0||nx>=gx0+gw||ny>=gy0+gh) continue;
        // prevent diagonal corner cutting: both side cells must be free
        if(dx!==0 && dy!==0){
          const kx = cellKey(cx+dx, cy);
          const ky = cellKey(cx, cy+dy);
          if(blocked.has(kx) || blocked.has(ky)) continue;
        }
        const k=cellKey(nx,ny); if(blocked.has(k) || dist.has(k)) continue;
        dist.set(k, cd+1); q.push([nx,ny]);
      }
    }

    // build direction field: for each reachable cell, point to neighbor with lower dist
    const field = new Map();
    for(let y=0;y<gh;y++){
      for(let x=0;x<gw;x++){
        const gx = gx0+x, gy = gy0+y; const k=cellKey(gx,gy);
        const d = dist.get(k); if(d===undefined) continue;
        let best=null, bd=d;
        for(const [dx,dy] of dirs){
          const nk=cellKey(gx+dx,gy+dy); const nd=dist.get(nk);
          if(nd!==undefined && nd<bd){ bd=nd; best=[dx,dy]; }
        }
        if(best){ field.set(k, best); }
      }
    }
    flowField.data = field; flowField.gx0=gx0; flowField.gy0=gy0; flowField.w=gw; flowField.h=gh; flowField.builtAt = performance.now(); flowField.lastPgx=pgx; flowField.lastPgy=pgy;
  }
  function sampleFlowDir(wx,wy){
    if(!flowField.data) return null;
    const gx = cellOfX(wx), gy = cellOfY(wy); const k=cellKey(gx,gy);
    const v = flowField.data.get(k); if(!v) return null;
    return v; // [dx,dy]
  }

  function drawBackground(){
    const {noise} = world;
    const gx0 = Math.floor(camera.x / cell) - 1;
    const gy0 = Math.floor(camera.y / cell) - 1;
    const gx1 = Math.floor((camera.x + canvas.width) / cell) + 1;
    const gy1 = Math.floor((camera.y + canvas.height) / cell) + 1;

    const pal = tintedPalette();
    for(let gy=g0(gy0); gy<=gy1; gy++){
      for(let gx=g0(gx0); gx<=gx1; gx++){
        const x = gx*cell - camera.x;
        const y = gy*cell - camera.y;
        const e = (0.55*noise(gx*scale1, gy*scale1) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3) + 2)/4;
        const px = Math.round(x), py = Math.round(y);
        if(STYLE==='pixlake' && tiles.ready){
          // choose base tile by band: deep/shallow water, sand, grass
          let isSand=false;
          if(e < WATER_T - 0.04){ ctx.drawImage(tiles.waterDeep, px, py, cell, cell); }
          else if(e < WATER_T){ ctx.drawImage(tiles.waterShallow, px, py, cell, cell); }
          else if(e < SAND_T){ ctx.drawImage(tiles.sand, px, py, cell, cell); isSand=true; }
          else { ctx.drawImage(tiles.grass, px, py, cell, cell); }
          // simple 4-way shoreline: overlay sand edge when neighbor is water
          if(isSand){
            const eN = (0.55*noise(gx*scale1, (gy-1)*scale1) + 0.35*noise(gx*scale2, (gy-1)*scale2) + 0.1*noise(gx*scale3, (gy-1)*scale3) + 2)/4;
            const eS = (0.55*noise(gx*scale1, (gy+1)*scale1) + 0.35*noise(gx*scale2, (gy+1)*scale2) + 0.1*noise(gx*scale3, (gy+1)*scale3) + 2)/4;
            const eW = (0.55*noise((gx-1)*scale1, gy*scale1) + 0.35*noise((gx-1)*scale2, gy*scale2) + 0.1*noise((gx-1)*scale3, gy*scale3) + 2)/4;
            const eE = (0.55*noise((gx+1)*scale1, gy*scale1) + 0.35*noise((gx+1)*scale2, gy*scale2) + 0.1*noise((gx+1)*scale3, gy*scale3) + 2)/4;
            if(eN < WATER_T) ctx.drawImage(tiles.shoreN, px, py, cell, cell);
            if(eS < WATER_T) ctx.drawImage(tiles.shoreS, px, py, cell, cell);
            if(eW < WATER_T) ctx.drawImage(tiles.shoreW, px, py, cell, cell);
            if(eE < WATER_T) ctx.drawImage(tiles.shoreE, px, py, cell, cell);
          }
        } else {
          const color = (e < WATER_T) ? pal.water : (e < SAND_T ? pal.sand : pal.grass);
          ctx.fillStyle = color; ctx.fillRect(px, py, cell, cell);
          if(((gx*73856093 ^ gy*19349663) & 7)===0){ ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(Math.round(x+1), Math.round(y+1), 1, 1); }
        }
      }
    }
    function g0(n){ return n|0; }
  }

  // Day-night tinting utilities and palette
  function tintedPalette(){
    const baseWater = '#1f5e7a';
    const baseSand  = '#d9c28a';
    const baseGrass = '#3e8a49';
    const warm = [255,179,107]; // warm noon tint
    const cool = [107,176,255]; // cool midnight tint
    const t = (dayTime / dayLength) % 1; // [0,1)
    const c = Math.cos(t*Math.PI*2);
    const warmK = Math.max(0, -c); // 1 at noon (t=0.5), 0 at midnight (t=0)
    const coolK = 1 - warmK;
    const amount = 0.16; // overall tint strength
    function mixTint(hex){
      const b = hexToRgb(hex);
      const r = clamp(Math.round(b.r + (warm[0]-b.r)*amount*warmK + (cool[0]-b.r)*amount*coolK));
      const g = clamp(Math.round(b.g + (warm[1]-b.g)*amount*warmK + (cool[1]-b.g)*amount*coolK));
      const bl= clamp(Math.round(b.b + (warm[2]-b.b)*amount*warmK + (cool[2]-b.b)*amount*coolK));
      return rgbToHex(r,g,bl);
    }
    return { water: mixTint(baseWater), sand: mixTint(baseSand), grass: mixTint(baseGrass) };
  }
  function hexToRgb(hex){
    const h = hex.replace('#','');
    const bigint = parseInt(h,16);
    return { r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255 };
  }
  function rgbToHex(r,g,b){
    const to = (n)=> n.toString(16).padStart(2,'0');
    return '#' + to(r) + to(g) + to(b);
  }
  function darken(hex, factor){
    const c = hexToRgb(hex);
    return rgbToHex(
      clamp(Math.round(c.r * factor)),
      clamp(Math.round(c.g * factor)),
      clamp(Math.round(c.b * factor))
    );
  }
  function clamp(v){ return Math.max(0, Math.min(255, v)); }

  // ==========================================
  // SECTION 7: 主游戏循环
  // ==========================================
  
  let last=performance.now();
  function loop(now){
    const dt = Math.min(0.033,(now-last)/1000); last=now;
    update(dt);
    
    // -------------------- 渲染 --------------------
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    if(inDungeon){
      // 地下城渲染
      drawDungeon();
      drawEnemies();
      drawBullets();
      drawParticles();
      drawDamageTexts();
      drawDrops();
      drawPlayer();
      drawBowCone();
      drawMeleeFX();
      drawPickupTexts();
    } else {
      // 地表渲染
      drawBackground();
      drawGridOverlay();
      drawEnemies();
      drawBullets();
      drawParticles();
      drawDamageTexts();
      drawDrops();
      drawBenches();
      drawChests();
      drawWalls();
      drawDungeonEntrances();
      drawPlacementPreview();
      drawPickupTexts();
      drawRocks();
      drawOres();
      drawTrees();
      drawChopProgress();
      drawMineProgress();
      drawOreMineProgress();
      drawPlayer();
      drawBowCone();
      drawMeleeFX();
    }
    // hint: cancel charge
    if(player.equipped==='bow' && player.bowCharging){
      ctx.save();
      const msg='按F取消蓄力';
      ctx.font='14px Segoe UI, Microsoft YaHei'; ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillStyle='rgba(0,0,0,0.45)'; const w=140,h=28; const cx=canvas.width/2; const y=canvas.height-10; ctx.fillRect(cx-w/2, y-h+6, w, h);
      ctx.fillStyle='#e6e6e6'; ctx.fillText(msg, canvas.width/2, canvas.height-12);
      ctx.restore();
    }
    drawDayNightOverlay();
    drawCenterHints();
    drawBackpack();
    drawWorkbenchUI();
    drawChestUI();
    drawInventoryHUD();
    drawMinimap();
    setMiniTimeText();
    drawDebugPanel();
    if(player.dead){
      ctx.save();
      const cx = canvas.width/2, cy = canvas.height/2;
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(cx-160, cy-70, 320, 140);
      ctx.fillStyle='#e6e6e6'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='20px Segoe UI, Microsoft YaHei';
      ctx.fillText('你已倒下，正在复活...', cx, cy-8);
      ctx.font='12px Segoe UI, Microsoft YaHei';
      ctx.fillText('已清空物品', cx, cy+22);
      ctx.restore();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
