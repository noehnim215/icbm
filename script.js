const stage=document.getElementById('stage');

const DATE_POOL=['date.png','date-2.png','date3.png','date4.png','date5.png'];
const LINEUP_POOL=['lineup.png','lineup-2.png','lineup3.png','lineup4.png'];
const POW_POOL=['pow.png','small-pow.png','pow3.png','pow4.png'];

const specs=[
  {id:'icbm',src:'icbm.png',kind:'icbm',always:true,min:150,max:.82,stretch:false},
  {id:'boiler',src:'logo-boiler.png',kind:'boiler',always:true,min:90,max:.42,stretch:true}
];

function rand(min,max){return min+Math.random()*(max-min)}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function shuffled(arr){return [...arr].sort(()=>Math.random()-.5)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

const chosen=[
  ...specs,
  {id:'date',src:pick(DATE_POOL),kind:'date',min:130,max:.76,stretch:true},
  {id:'lineup',src:pick(LINEUP_POOL),kind:'lineup',min:150,max:.72,stretch:true}
];

const powCount=Math.random()<.5?2:3;
shuffled(POW_POOL).slice(0,powCount).forEach((src,i)=>{
  chosen.push({id:'pow-'+i,src,kind:'pow',min:100,max:.48,stretch:true});
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

  if(spec.heroHuge){
    const full=Math.min(b.width*.97,b.height*aspect*.97);
    return Math.max(spec.min,full*rand(.88,1));
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
  o.y=rand(b.top,Math.max(b.top,b.bottom-h));
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
    img.className='poster-object '+spec.kind;
    img.draggable=false;
    img.onload=()=>{
      const baseW=randomWidth(spec,img.naturalWidth,img.naturalHeight);
      const baseH=baseW*(img.naturalHeight/img.naturalWidth);
      const vx=(Math.random()<.5?-1:1)*rand(70,145);
      const vy=(Math.random()<.5?-1:1)*rand(70,145);
      const o={
        spec,el:img,
        baseW,baseH,
        x:0,y:0,
        vx,vy,
        sx:1,sy:1,
        tx:1,ty:1,
        hovered:false,
        pinned:false,
        nextStretch:performance.now()+rand(550,1500)
      };
      stage.appendChild(img);
      placeRandom(o);
      apply(o);

      img.addEventListener('mouseenter',()=>{
        o.hovered=true;
        img.classList.add('is-hovered');
      });
      img.addEventListener('mouseleave',()=>{
        o.hovered=false;
        img.classList.remove('is-hovered');
      });

      img.addEventListener('click',e=>{
        e.stopPropagation();
        o.pinned=true;
        o.tx=o.sx;
        o.ty=o.sy;
        img.classList.add('is-pinned');
      });

      objects.push(o);
      resolve();
    };
  });
}

function chooseStretch(o,now){
  const b=innerBounds();
  if(!o.spec.stretch){
    o.tx=1;
    o.ty=1;
  }else{
    const maxSx=Math.max(.45,Math.min(1.85,b.width/o.baseW));
    const maxSy=Math.max(.45,Math.min(1.85,b.height/o.baseH));

    const canHero=o.spec.kind==='date'||o.spec.kind==='lineup'||o.spec.kind==='pow';
    if(canHero && Math.random()<.09){
      o.tx=Math.max(.55,maxSx*rand(.9,1));
      o.ty=Math.max(.55,maxSy*rand(.9,1));
    }else{
      o.tx=rand(.52,maxSx);
      o.ty=rand(.52,maxSy);
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
      if(o.hovered || o.pinned) continue;

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
  if(idle) return; // once DVD mode starts, mouse movement does not cancel it
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    idle=true;
    const now=performance.now();
    objects.forEach(o=>chooseStretch(o,now));
  },5000);
}

// Before DVD mode: movement keeps delaying the 5-second timer.
// During DVD mode: movement is allowed so hover can pause individual objects.
addEventListener('mousemove',()=>{ if(!idle) armIdle(); },{passive:true});
addEventListener('touchmove',()=>{ if(!idle) armIdle(); },{passive:true});
addEventListener('pointerdown',()=>{ if(!idle) armIdle(); },{passive:true});
addEventListener('keydown',()=>{ if(!idle) armIdle(); });

addEventListener('resize',()=>{
  buildMarbleBorder();
  for(const o of objects){
    keepInside(o);
    apply(o);
  }
});

function buildMarbleBorder(){
  const order=['red-circle.png','green-circle.png','blue-circle.png','orange-circle.png'];
  const target=54;
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

(async()=>{
  buildMarbleBorder();
  for(const spec of chosen) await makeObject(spec);
  armIdle();
  cancelAnimationFrame(raf);
  last=performance.now();
  raf=requestAnimationFrame(tick);
})();