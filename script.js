
// Custom cursor
const cursor=document.createElement('div');
cursor.className='cursor';
document.body.appendChild(cursor);
addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});

// Visual editor
const items=[
  ['.title-art','ICBM title'],
  ['.lineup-art','Lineup'],
  ['.pow.cyan','Cyan POW'],
  ['.pow.pink','Pink POW'],
  ['.date-art','Date / location'],
  ['.boiler','Boiler Room']
].map(([selector,name])=>({el:document.querySelector(selector),selector,name})).filter(x=>x.el);

items.forEach(x=>x.el.classList.add('editor-item'));

const toggle=document.createElement('button');
toggle.className='editor-toggle';
toggle.textContent='EDIT';
document.body.appendChild(toggle);

const panel=document.createElement('div');
panel.className='editor-panel';
panel.innerHTML=`
  <strong>POSTER EDITOR</strong>
  <select class="editor-select"></select>
  <div class="row">
    <label>X %<input class="ex" type="number" step=".1"></label>
    <label>Y %<input class="ey" type="number" step=".1"></label>
    <label>W %<input class="ew" type="number" step=".1" min="1"></label>
  </div>
  <button class="copy-css">COPY CSS</button>
  <button class="reset-layout">RESET LOCAL EDITS</button>
  <p class="hint">이미지를 드래그해서 이동. 노란 점을 드래그해서 크기 조절. 수정값은 이 브라우저에 자동 저장됨.</p>
`;
document.body.appendChild(panel);

const handle=document.createElement('div');
handle.className='resize-handle';
document.querySelector('main').appendChild(handle);

const toast=document.createElement('div');
toast.className='editor-toast';
toast.textContent='CSS copied';
document.body.appendChild(toast);

const select=panel.querySelector('.editor-select');
items.forEach((x,i)=>select.add(new Option(x.name,String(i))));
const ex=panel.querySelector('.ex'),ey=panel.querySelector('.ey'),ew=panel.querySelector('.ew');
let selected=null,editing=false,drag=null,resize=null;
const key='icbm-layout-v2';

function pct(n){return Math.round(n*10)/10}
function values(el){
  const main=document.querySelector('main'),m=main.getBoundingClientRect(),r=el.getBoundingClientRect();
  return {x:pct((r.left-m.left)/m.width*100),y:pct((r.top-m.top)/m.height*100),w:pct(r.width/m.width*100)};
}
function apply(el,v){
  if(v.x!=null)el.style.left=v.x+'%';
  if(v.y!=null)el.style.top=v.y+'%';
  if(v.w!=null)el.style.width=v.w+'%';
}
function saved(){
  try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}
}
function save(){
  const data={};items.forEach(x=>data[x.selector]=values(x.el));
  localStorage.setItem(key,JSON.stringify(data));
}
function load(){
  const data=saved();items.forEach(x=>{if(data[x.selector])apply(x.el,data[x.selector])});
}
function updateHandle(){
  if(!editing||!selected){handle.classList.remove('active');return}
  const main=document.querySelector('main'),m=main.getBoundingClientRect(),r=selected.el.getBoundingClientRect();
  handle.style.left=(r.right-m.left)+'px';handle.style.top=(r.bottom-m.top)+'px';
  handle.classList.add('active');
  const v=values(selected.el);ex.value=v.x;ey.value=v.y;ew.value=v.w;
  select.value=String(items.indexOf(selected));
}
function choose(item){
  items.forEach(x=>x.el.classList.remove('selected'));
  selected=item; if(item)item.el.classList.add('selected'); updateHandle();
}
function setEditing(on){
  editing=on;document.body.classList.toggle('edit-mode',on);
  toggle.textContent=on?'DONE':'EDIT';
  if(on&&!selected)choose(items[0]); else updateHandle();
}
load();

toggle.addEventListener('click',()=>setEditing(!editing));
select.addEventListener('change',()=>choose(items[+select.value]));

items.forEach(item=>{
  item.el.addEventListener('pointerdown',e=>{
    if(!editing)return;
    e.preventDefault();choose(item);
    const m=document.querySelector('main').getBoundingClientRect(),v=values(item.el);
    drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,v,m};
    item.el.setPointerCapture(e.pointerId);
  });
  item.el.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId||selected!==item)return;
    apply(item.el,{x:drag.v.x+(e.clientX-drag.sx)/drag.m.width*100,y:drag.v.y+(e.clientY-drag.sy)/drag.m.height*100,w:drag.v.w});
    updateHandle();
  });
  item.el.addEventListener('pointerup',e=>{if(drag&&drag.id===e.pointerId){drag=null;save();updateHandle()}});
});

handle.addEventListener('pointerdown',e=>{
  if(!editing||!selected)return;
  e.preventDefault();
  const m=document.querySelector('main').getBoundingClientRect(),v=values(selected.el);
  resize={id:e.pointerId,sx:e.clientX,v,m};
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove',e=>{
  if(!resize||resize.id!==e.pointerId||!selected)return;
  const w=Math.max(3,resize.v.w+(e.clientX-resize.sx)/resize.m.width*100);
  apply(selected.el,{x:resize.v.x,y:resize.v.y,w});updateHandle();
});
handle.addEventListener('pointerup',e=>{if(resize&&resize.id===e.pointerId){resize=null;save();updateHandle()}});

function inputApply(){
  if(!selected)return;
  apply(selected.el,{x:+ex.value,y:+ey.value,w:+ew.value});save();updateHandle();
}
[ex,ey,ew].forEach(i=>i.addEventListener('change',inputApply));

panel.querySelector('.reset-layout').addEventListener('click',()=>{
  localStorage.removeItem(key);items.forEach(x=>{x.el.style.left='';x.el.style.top='';x.el.style.width=''});updateHandle();
});
panel.querySelector('.copy-css').addEventListener('click',async()=>{
  const out=items.map(x=>{const v=values(x.el);return `${x.selector}{left:${v.x}%;top:${v.y}%;width:${v.w}%;}`}).join('\n');
  try{await navigator.clipboard.writeText(out);toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1200)}
  catch{prompt('Copy this CSS:',out)}
});
addEventListener('resize',updateHandle);


// Build an exact-fit marble border: red -> green -> blue -> orange.
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
  const verticalStep=edgeSize;
  const verticalOffset=Math.max(0,(verticalAvailable-verticalCount*edgeSize)/2);

  const make=(src,left,top,w,h)=>{
    const img=document.createElement('img');
    img.src=src; img.alt=''; img.draggable=false;
    img.style.left=left+'px'; img.style.top=top+'px';
    img.style.width=w+'px'; img.style.height=h+'px';
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
    const y=verticalOffset+i*verticalStep;
    left.appendChild(make(order[i%4],0,y,edgeSize,verticalStep));
    right.appendChild(make(order[i%4],0,y,edgeSize,verticalStep));
  }
}
buildMarbleBorder();
let borderResizeTimer;
addEventListener('resize',()=>{
  clearTimeout(borderResizeTimer);
  borderResizeTimer=setTimeout(buildMarbleBorder,60);
});

// 10-second idle DVD-style screensaver.
const idleDelay=10000;
let idleTimer=null;
let idleActive=false;
let idleRaf=null;
let idleLast=0;
let idleObjects=[];

const idleLayer=document.createElement('div');
idleLayer.className='idle-layer';
document.body.appendChild(idleLayer);

function rand(min,max){return min+Math.random()*(max-min)}

function startIdle(){
  if(idleActive || document.body.classList.contains('edit-mode')) return;
  idleActive=true;
  document.body.classList.add('idle-active');
  idleLayer.replaceChildren();
  idleObjects=[];

  items.forEach((item,index)=>{
    const src=item.el;
    const r=src.getBoundingClientRect();
    const clone=src.cloneNode(true);
    clone.classList.remove('editor-item','selected');
    clone.classList.add('idle-clone');
    clone.style.width=r.width+'px';
    clone.style.height=r.height+'px';
    clone.style.left=r.left+'px';
    clone.style.top=r.top+'px';
    clone.style.transformOrigin='top left';
    idleLayer.appendChild(clone);

    const speed=rand(85,150);
    const angle=rand(0,Math.PI*2);
    const stretchable=!src.classList.contains('title-art');
    idleObjects.push({
      el:clone,
      x:Math.max(54,Math.min(r.left,window.innerWidth-r.width-54)),
      y:Math.max(54,Math.min(r.top,window.innerHeight-r.height-54)),
      w:r.width,h:r.height,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
      sx:1,sy:1,tx:1,ty:1,
      stretchable,
      nextStretch:performance.now()+rand(700,1800)
    });
  });

  idleLast=performance.now();
  idleRaf=requestAnimationFrame(tickIdle);
}

function tickIdle(now){
  if(!idleActive)return;
  const dt=Math.min(.04,(now-idleLast)/1000||0);
  idleLast=now;
  const vw=window.innerWidth, vh=window.innerHeight;

  idleObjects.forEach(o=>{
    const edge=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge-size'))||54;
    const minX=edge, minY=edge, maxW=Math.max(80,vw-edge*2), maxH=Math.max(80,vh-edge*2);

    if(o.stretchable && now>=o.nextStretch){
      const maxSx=Math.max(.45,Math.min(1.45,maxW/o.w));
      const maxSy=Math.max(.45,Math.min(1.45,maxH/o.h));
      o.tx=rand(.55,maxSx);
      o.ty=rand(.55,maxSy);
      o.nextStretch=now+rand(700,1800);
    }
    const ease=Math.min(1,dt*3.4);
    o.sx+= (o.tx-o.sx)*ease;
    o.sy+= (o.ty-o.sy)*ease;

    const rw=o.w*o.sx, rh=o.h*o.sy;
    o.x+=o.vx*dt; o.y+=o.vy*dt;

    const maxX=Math.max(minX,minX+maxW-rw);
    const maxY=Math.max(minY,minY+maxH-rh);
    if(o.x<=minX){o.x=minX;o.vx=Math.abs(o.vx)}
    if(o.y<=minY){o.y=minY;o.vy=Math.abs(o.vy)}
    if(o.x>=maxX){o.x=maxX;o.vx=-Math.abs(o.vx)}
    if(o.y>=maxY){o.y=maxY;o.vy=-Math.abs(o.vy)}

    o.el.style.left=o.x+'px';
    o.el.style.top=o.y+'px';
    o.el.style.transform='scale('+o.sx+','+o.sy+')';
  });

  idleRaf=requestAnimationFrame(tickIdle);
}

function stopIdle(){
  if(!idleActive)return;
  idleActive=false;
  document.body.classList.remove('idle-active');
  cancelAnimationFrame(idleRaf);
  idleLayer.replaceChildren();
  idleObjects=[];
}

function armIdle(){
  stopIdle();
  clearTimeout(idleTimer);
  idleTimer=setTimeout(startIdle,idleDelay);
}
['mousemove','pointerdown','keydown','wheel','touchstart'].forEach(evt=>{
  addEventListener(evt,armIdle,{passive:true});
});
armIdle();
