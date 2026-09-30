const stage=document.getElementById('stage');

const DATE_POOL=['date.png','date-2.png','date3.png','date4.png','date5.png'];
const LINEUP_POOL=['lineup.png','lineup-2.png','lineup3.png','lineup4.png'];
const POW_POOL=['pow.png','small-pow.png','pow4.png'];
const POW_RARE='pow3.png';
const RSVP_POOL=['rsvp.png','rsvp2.png','rsvp3.png','rsvp4.png','rsvp5.png','rsvp6.png','rsvp7.png'];

const specs=[
  {id:'icbm',src:'icbm.png',kind:'icbm',always:true,min:380,max:.88,stretch:false,mediumLarge:true},
  {id:'boiler',src:'braindead.png',kind:'boiler',always:true,min:90,max:.42,stretch:true}
];

function rand(min,max){return min+Math.random()*(max-min)}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function shuffled(arr){return [...arr].sort(()=>Math.random()-.5)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

const icbmLayerRoll=Math.random();
const icbmLayer=icbmLayerRoll<.69?'top3':(icbmLayerRoll<.845?'top2':'top1');
specs[0].layer=icbmLayer;

const chosen=[
  ...specs,
  {id:'date',src:pick(DATE_POOL),kind:'date',min:130,max:.76,stretch:true},
  {id:'lineup',src:pick(LINEUP_POOL),kind:'lineup',min:150,max:.72,stretch:true},
  {id:'rsvp',src:pick(RSVP_POOL),kind:'rsvp',min:120,max:.78,stretch:true,rsvpExtreme:true}
];

const powCount=Math.random()<.5?2:3;
const powCandidates=shuffled(POW_POOL);
if(Math.random()<.22) powCandidates.splice(Math.floor(Math.random()*(powCandidates.length+1)),0,POW_RARE);
powCandidates.slice(0,powCount).forEach((src,i)=>{
  const r=Math.random();
  const layer=r<.40?'back':(r<.75?'middle':'top');
  chosen.push({
    id:'pow-'+i,
    src,
    kind:'pow',
    min:100,
    max:.62,
    stretch:true,
    heroHuge:Math.random()<.32,
    layer
  });
});

// Sometimes one date / lineup / POW starts nearly full-screen.
if(Math.random()<.38){
  const candidates=chosen.filter(x=>x.kind==='date'||x.kind==='lineup'||x.kind==='pow');
  pick(candidates).heroHuge=true;
}

const objects=[];
let idle=false;
let idleTimer=null;
let raf=null;
let last=performance.now();
let globallyPaused=false;

let marbleChaosMode='none';
let marbleChaosObjects=[];
let marbleChaosLayer=null;
let marbleChaosRaf=null;
let marbleChaosLast=performance.now();

function innerBounds(){
  const edge=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge-size'))||54;
  return {
    edge,
    left:edge,
    top:edge,
    right:window.innerWidth-edge,
    bottom:window.innerHeight-edge,
    width:Math.max(100,window.innerWidth-edge*2),
    height:Math.max(100,window.innerHeight-edge*2)
  };
}

function randomWidth(spec,naturalW,naturalH){
  const b=innerBounds();
  const aspect=naturalW/naturalH;

  if(spec.mediumLarge){
    const minW=Math.min(b.width*.46,Math.max(300,spec.min));
    const maxW=Math.min(b.width*.86,b.height*aspect*.86);
    const lo=Math.min(minW,maxW);
    const hi=Math.max(minW,maxW);
    const t=Math.pow(Math.random(),0.55); // bias strongly toward larger sizes
    return lo+(hi-lo)*t;
  }

  if(spec.heroHuge){
    const fullness=spec.kind==='pow'?rand(.94,1):rand(.88,1);
    const full=Math.min(b.width*.98,b.height*aspect*.98);
    return Math.max(spec.min,full*fullness);
  }

  if(spec.rsvpExtreme){
    const maxByViewport=Math.max(spec.min,Math.min(b.width*.82,b.height*aspect*.82));
    const minW=Math.min(spec.min,maxByViewport);
    return rand(minW,maxByViewport);
  }

  const maxByViewport=Math.max(spec.min,Math.min(
    b.width*(typeof spec.max==='number'?spec.max:.7),
    b.height*aspect*.9
  ));
  const minW=Math.min(spec.min,maxByViewport);
  const t=Math.random()**1.15;
  return minW+(maxByViewport-minW)*t;
}

function placeRandom(o){
  const b=innerBounds();
  const w=o.baseW*o.sx;
  const h=o.baseH*o.sy;
  o.x=rand(b.left,Math.max(b.left,b.right-w));

  const maxY=Math.max(b.top,b.bottom-h);
  if(o.spec.kind==='pow'){
    const lowerStart=b.top+(b.height*.52);
    o.y=rand(Math.min(lowerStart,maxY),maxY);
  }else{
    o.y=rand(b.top,maxY);
  }
}

function apply(o){
  o.el.style.left=o.x+'px';
  o.el.style.top=o.y+'px';
  o.el.style.width=o.baseW+'px';
  o.el.style.transform='scale('+o.sx+','+o.sy+')';
}

function makeObject(spec){
  return new Promise(resolve=>{
    const img=new Image();
    img.src=spec.src;
    img.alt=spec.kind;
    img.className='poster-object '+spec.kind+(spec.layer?' layer-'+spec.layer:'');
    img.draggable=false;
    img.onload=()=>{
      const baseW=randomWidth(spec,img.naturalWidth,img.naturalHeight);
      const baseH=baseW*(img.naturalHeight/img.naturalWidth);

      // Oversized POW graphics should never sit on the very top layer.
      if(spec.kind==='pow' && spec.layer==='top'){
        const b=innerBounds();
        const hugeThreshold=b.width*.62;
        if(baseW>=hugeThreshold || spec.heroHuge){
          spec.layer=Math.random()<.6?'back':'middle';
        }
      }
      const mobile=window.innerWidth<=700;
      const vx=(Math.random()<.5?-1:1)*rand(mobile?24:70,mobile?58:145);
      const vy=(spec.kind==='pow'?1:(Math.random()<.5?-1:1))*rand(mobile?24:70,mobile?58:145);
      const o={
        spec,el:img,
        baseW,baseH,
        x:0,y:0,
        vx,vy,
        sx:1,sy:1,
        tx:1,ty:1,
        nextStretch:performance.now()+rand(550,1500)
      };
      stage.appendChild(img);
      placeRandom(o);
      apply(o);

      objects.push(o);
      resolve();
    };
  });
}

function chooseStretch(o,now){
  const b=innerBounds();

  if(o.spec.kind==='pow' && o.spec.layer==='top'){
    const currentW=o.baseW*o.sx;
    if(currentW>=b.width*.62){
      o.spec.layer=Math.random()<.6?'back':'middle';
      o.el.classList.remove('layer-top');
      o.el.classList.add('layer-'+o.spec.layer);
    }
  }
  if(!o.spec.stretch){
    o.tx=1;
    o.ty=1;
  }else{
    const mobile=window.innerWidth<=700;

    if(o.spec.rsvpExtreme){
      const maxSx=Math.max(.3,Math.min(mobile?2.2:3.4,(b.width/o.baseW)*1.05));
      const maxSy=Math.max(.3,Math.min(mobile?2.2:3.4,(b.height/o.baseH)*1.05));
      o.tx=rand(mobile?.45:.28,maxSx);
      o.ty=rand(mobile?.45:.28,maxSy);
    }else{
      const maxSx=Math.max(.45,Math.min(mobile?1.35:1.85,b.width/o.baseW));
      const maxSy=Math.max(.45,Math.min(mobile?1.35:1.85,b.height/o.baseH));

      const canHero=o.spec.kind==='date'||o.spec.kind==='lineup'||o.spec.kind==='pow';
      if(canHero && Math.random()<.09){
        o.tx=Math.max(.55,maxSx*rand(.9,1));
        o.ty=Math.max(.55,maxSy*rand(.9,1));
      }else{
        o.tx=rand(mobile?.7:.52,maxSx);
        o.ty=rand(mobile?.7:.52,maxSy);
      }
    }
  }
  o.nextStretch=now+rand(600,1500);
}

function keepInside(o){
  const b=innerBounds();
  const w=o.baseW*o.sx;
  const h=o.baseH*o.sy;
  const maxX=Math.max(b.left,b.right-w);
  const maxY=Math.max(b.top,b.bottom-h);

  if(o.x<=b.left){o.x=b.left;o.vx=Math.abs(o.vx)}
  if(o.y<=b.top){o.y=b.top;o.vy=Math.abs(o.vy)}
  if(o.x>=maxX){o.x=maxX;o.vx=-Math.abs(o.vx)}
  if(o.y>=maxY){o.y=maxY;o.vy=-Math.abs(o.vy)}
}

function tick(now){
  const dt=Math.min(.035,(now-last)/1000||0);
  last=now;

  if(idle){
    for(const o of objects){
      if(globallyPaused) continue;

      if(now>=o.nextStretch) chooseStretch(o,now);

      const ease=Math.min(1,dt*3.2);
      o.sx+=(o.tx-o.sx)*ease;
      o.sy+=(o.ty-o.sy)*ease;

      o.x+=o.vx*dt;
      o.y+=o.vy*dt;
      keepInside(o);
      apply(o);
    }
  }

  raf=requestAnimationFrame(tick);
}

function armIdle(){
  if(idle || globallyPaused) return; // once DVD mode starts, mouse movement does not cancel it
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    idle=true;
    const now=performance.now();
    objects.forEach(o=>chooseStretch(o,now));
  },1400);
}

// Before DVD mode: movement keeps delaying the 5-second timer.
// During DVD mode: movement is allowed so hover can pause individual objects.
addEventListener('mousemove',()=>{ if(!idle && !globallyPaused) armIdle(); },{passive:true});
addEventListener('touchmove',()=>{ if(!idle && !globallyPaused) armIdle(); },{passive:true});
addEventListener('pointerdown',e=>{
  globallyPaused=!globallyPaused;
  document.body.classList.toggle('all-paused',globallyPaused);

  // If DVD mode has not started yet, clicking only toggles the global pause state.
  // When unpaused before idle begins, keep the 5-second timer running.
  if(!idle && !globallyPaused) armIdle();
},{passive:true});

addEventListener('keydown',()=>{ if(!idle && !globallyPaused) armIdle(); });

addEventListener('resize',()=>{
  buildMarbleBorder();
  for(const o of objects){
    keepInside(o);
    apply(o);
  }
});

function buildMarbleBorder(){
  const order=['red-circle.png','green-circle.png','blue-circle.png','orange-circle.png'];
  const target=window.innerWidth<=700?34:54;
  const vw=window.innerWidth;
  const vh=window.innerHeight;

  const horizontalCount=Math.max(4,Math.ceil(vw/target/4)*4);
  const edgeSize=vw/horizontalCount;
  document.documentElement.style.setProperty('--edge-size',edgeSize+'px');

  const verticalAvailable=Math.max(0,vh-edgeSize*2);
  const verticalCount=Math.max(1,Math.floor(verticalAvailable/edgeSize));
  const verticalOffset=Math.max(0,(verticalAvailable-verticalCount*edgeSize)/2);

  const make=(src,left,top,w,h)=>{
    const img=document.createElement('img');
    img.src=src; img.alt=''; img.draggable=false;
    img.style.left=left+'px';
    img.style.top=top+'px';
    img.style.width=w+'px';
    img.style.height=h+'px';
    return img;
  };

  const top=document.querySelector('.marble-top');
  const bottom=document.querySelector('.marble-bottom');
  const left=document.querySelector('.marble-left');
  const right=document.querySelector('.marble-right');
  [top,bottom,left,right].forEach(edge=>edge.replaceChildren());

  top.style.height=edgeSize+'px';
  bottom.style.height=edgeSize+'px';
  left.style.width=edgeSize+'px';
  right.style.width=edgeSize+'px';

  for(let i=0;i<horizontalCount;i++){
    const x=i*edgeSize;
    top.appendChild(make(order[i%4],x,0,edgeSize,edgeSize));
    bottom.appendChild(make(order[i%4],x,0,edgeSize,edgeSize));
  }

  for(let i=0;i<verticalCount;i++){
    const y=verticalOffset+i*edgeSize;
    left.appendChild(make(order[i%4],0,y,edgeSize,edgeSize));
    right.appendChild(make(order[i%4],0,y,edgeSize,edgeSize));
  }
}

function setupMarbleChaos(){
  // About 1 in 7 page loads: all border marbles detach and float
  // in zero-gravity, bouncing around like DVD logos.
  if(Math.random()>=1/7){
    marbleChaosMode='none';
    return;
  }
  marbleChaosMode='dvd';

  const source=[...document.querySelectorAll('.marble-edge img')];
  if(!source.length)return;

  marbleChaosLayer=document.createElement('div');
  marbleChaosLayer.className='marble-chaos-layer';
  document.body.appendChild(marbleChaosLayer);

  const size=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge-size'))||54;

  source.forEach((img,i)=>{
    const r=img.getBoundingClientRect();
    const clone=img.cloneNode(true);
    clone.className='marble-chaos-ball';
    clone.style.left=r.left+'px';
    clone.style.top=r.top+'px';
    clone.style.width=r.width+'px';
    clone.style.height=r.height+'px';
    marbleChaosLayer.appendChild(clone);

    const mobile=window.innerWidth<=700;
    let vx=(Math.random()<.5?-1:1)*rand(mobile?22:55,mobile?58:130);
    let vy=(Math.random()<.5?-1:1)*rand(mobile?22:55,mobile?58:130);

    const cols=Math.max(1,Math.floor(window.innerWidth/size));
    const row=Math.floor(i/cols);
    const col=i%cols;
    const targetX=col*size;
    const targetY=window.innerHeight-size*(row+1);

    marbleChaosObjects.push({
      el:clone,
      x:r.left,
      y:r.top,
      vx,vy,
      targetX,
      targetY,
      settled:false,
      delay:rand(0,700),
      born:performance.now()
    });
  });

  document.querySelector('.marble-frame').style.visibility='hidden';

  marbleChaosLast=performance.now();
  marbleChaosRaf=requestAnimationFrame(tickMarbles);
}

function tickMarbles(now){
  if(marbleChaosMode==='none')return;
  const dt=Math.min(.035,(now-marbleChaosLast)/1000||0);
  marbleChaosLast=now;

  if(!globallyPaused){
    for(const o of marbleChaosObjects){
      if(now-o.born<o.delay)continue;

      if(marbleChaosMode==='dvd'){
        o.x+=o.vx*dt;
        o.y+=o.vy*dt;
        const w=o.el.offsetWidth,h=o.el.offsetHeight;
        if(o.x<=0){o.x=0;o.vx=Math.abs(o.vx)}
        if(o.y<=0){o.y=0;o.vy=Math.abs(o.vy)}
        if(o.x+w>=innerWidth){o.x=Math.max(0,innerWidth-w);o.vx=-Math.abs(o.vx)}
        if(o.y+h>=innerHeight){o.y=Math.max(0,innerHeight-h);o.vy=-Math.abs(o.vy)}
      }

      o.el.style.left=o.x+'px';
      o.el.style.top=o.y+'px';
    }
  }

  marbleChaosRaf=requestAnimationFrame(tickMarbles);
}

(async()=>{
  buildMarbleBorder();
  setupMarbleChaos();
  for(const spec of chosen) await makeObject(spec);
  armIdle();
  cancelAnimationFrame(raf);
  last=performance.now();
  raf=requestAnimationFrame(tick);
})();

// Background music: autoplay when allowed, otherwise start on the first user interaction.
const bgMusic=document.getElementById('bg-music');
if(bgMusic){
  bgMusic.volume=0.85;

  const tryPlayMusic=()=>{
    const p=bgMusic.play();
    if(p&&typeof p.catch==='function') p.catch(()=>{});
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',tryPlayMusic,{once:true});
  }else{
    tryPlayMusic();
  }

  const unlockMusic=()=>{
    tryPlayMusic();
    ['pointerdown','touchstart','keydown'].forEach(evt=>{
      window.removeEventListener(evt,unlockMusic);
    });
  };

  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    window.addEventListener(evt,unlockMusic,{passive:true});
  });
}
