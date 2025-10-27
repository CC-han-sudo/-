(()=>{
  const gridEl = document.getElementById('grid');
  const sizeEl = document.getElementById('size');
  const cellsEl = document.getElementById('cells');
  const countEl = document.getElementById('count');
  const seedEl = document.getElementById('seed');
  const genBtn = document.getElementById('gen');
  const dlAllBtn = document.getElementById('dlAll');

  function seededRNG(seed){
    let s = seed|0; if(!s) s = (Math.random()*0x7fffffff)|0;
    return { s,
      next(){ s = (s*1664525 + 1013904223) >>> 0; return s; },
      float(){ return (this.next()>>>8)/0xFFFFFF; },
      int(n){ return this.next()%n; }
    };
  }

  // Simplex-like 2D value noise
  function makeNoise(seed){
    const rng = seededRNG(seed);
    const perm = new Uint8Array(512);
    for(let i=0;i<256;i++) perm[i]=i;
    for(let i=255;i>0;i--){ const j=rng.int(i+1); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
    for(let i=0;i<256;i++) perm[256+i]=perm[i];
    function fade(t){ return t*t*t*(t*(t*6-15)+10); }
    function lerp(a,b,t){ return a+(b-a)*t; }
    function grad(h,x,y){
      switch(h&3){
        case 0: return  x+y;
        case 1: return -x+y;
        case 2: return  x-y;
        default:return -x-y;
      }
    }
    return function noise2(x,y){
      const X=Math.floor(x)&255, Y=Math.floor(y)&255;
      x-=Math.floor(x); y-=Math.floor(y);
      const u=fade(x), v=fade(y);
      const aa=perm[X+perm[Y]], ab=perm[X+perm[Y+1]];
      const ba=perm[X+1+perm[Y]], bb=perm[X+1+perm[Y+1]];
      const gaa=grad(aa,x,y), gab=grad(ab,x,y-1);
      const gba=grad(ba,x-1,y), gbb=grad(bb,x-1,y-1);
      return lerp(lerp(gaa,gba,u), lerp(gab,gbb,u), v); // [-2,2]
    };
  }

  function palette(kind){
    if(kind==='tropical') return {
      deep:'#1a2a4f', water:'#224b7a', shore:'#2c7da0', sand:'#d2b48c',
      grass:'#3e8a49', forest:'#2f6b3a', hill:'#6c6e2e', rock:'#6f6f7a', snow:'#e7eef4'
    };
    if(kind==='desert') return {
      deep:'#2a1c0f', water:'#3a2612', shore:'#5e3b1a', sand:'#d7b98b',
      grass:'#9aa06a', forest:'#7f8658', hill:'#c49a6c', rock:'#8c7a6a', snow:'#efe6d9'
    };
    return {
      deep:'#0b2033', water:'#143b5a', shore:'#1f5e7a', sand:'#d9c28a',
      grass:'#3e8a49', forest:'#2b6a3a', hill:'#7a6e3a', rock:'#6e6e78', snow:'#eef2f6'
    };
  }

  function generateTerrainCanvas(pxSize, cells, rngSeed){
    const seedVal = rngSeed? parseInt(rngSeed,10) : (Math.random()*1e9)|0;
    const rng = seededRNG(seedVal);
    const noise = makeNoise(seedVal);
    const canvas = document.createElement('canvas');
    canvas.width = pxSize; canvas.height = pxSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const cell = Math.floor(pxSize / cells);
    const scale1 = 1/32, scale2 = 1/96, scale3 = 1/12;
    const palKinds = ['default','tropical','desert'];
    const pal = palette(palKinds[rng.int(palKinds.length)]);

    function drawTile(gx,gy){
      const x=gx*cell, y=gy*cell;
      // 多层噪声——海拔与湿度
      const nx = gx*scale1, ny = gy*scale1;
      const elevation = 0.55*noise(nx,ny) + 0.35*noise(gx*scale2, gy*scale2) + 0.1*noise(gx*scale3, gy*scale3);
      const moisture  = 0.5 + 0.5*noise(gx*scale2+50, gy*scale2-30);
      const e = (elevation+2)/4; // 到 [0,1]

      let color;
      if(e < 0.42)      color = pal.deep;   // 深海
      else if(e < 0.48) color = pal.water;  // 海水
      else if(e < 0.50) color = pal.shore;  // 浅海/礁石
      else if(e < 0.53) color = pal.sand;   // 沙滩
      else {
        // 陆地按海拔和湿度分配
        if(e > 0.88) color = pal.snow;
        else if(e > 0.78) color = pal.rock;
        else if(e > 0.65) color = pal.hill;
        else color = (moisture>0.55 ? pal.forest : pal.grass);
      }

      // 画底色
      ctx.fillStyle = color;
      ctx.fillRect(x,y,cell,cell);
      // 像素质感：少量颗粒
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      const dots = 2 + (rng.int(3));
      for(let i=0;i<dots;i++){
        const dx = x + 1 + rng.int(Math.max(1,cell-2));
        const dy = y + 1 + rng.int(Math.max(1,cell-2));
        ctx.fillRect(dx,dy,1,1);
      }
    }

    for(let gy=0; gy<cells; gy++){
      for(let gx=0; gx<cells; gx++) drawTile(gx,gy);
    }

    // 岛屿遮罩（可选）：让边缘更容易是海
    const grad = ctx.createRadialGradient(pxSize/2,pxSize/2, pxSize*0.2, pxSize/2,pxSize/2, pxSize*0.7);
    grad.addColorStop(0,'rgba(0,0,0,0)');
    grad.addColorStop(1,'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,pxSize,pxSize);

    return { canvas, seed: seedVal, palName: Object.keys(palette())[0] };
  }

  function renderMany(){
    gridEl.innerHTML = '';
    const pxSize = +sizeEl.value;
    const cells = +cellsEl.value;
    const count = +countEl.value;
    const seed = seedEl.value.trim();
    for(let i=0;i<count;i++){
      const {canvas, seed: usedSeed} = generateTerrainCanvas(pxSize, cells, seed? (seed+i) : 0);
      const card = document.createElement('div'); card.className='card';
      const row = document.createElement('div'); row.className='row';
      const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `seed:${usedSeed}  size:${pxSize}  cells:${cells}`;
      const btns = document.createElement('div');
      const dl = document.createElement('button'); dl.textContent='下载'; dl.onclick=()=>{
        const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=`terrain_${usedSeed}.png`; a.click();
      };
      btns.appendChild(dl);
      row.appendChild(meta); row.appendChild(btns);
      card.appendChild(row); card.appendChild(canvas);
      gridEl.appendChild(card);
    }
  }

  genBtn.onclick = renderMany;
  dlAllBtn.onclick = ()=>{
    const canvases = gridEl.querySelectorAll('canvas');
    canvases.forEach((c,i)=>{
      const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=`terrain_${i+1}.png`; a.click();
    });
  };

  renderMany();
})();
