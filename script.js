
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


// Build marble border using actual PNGs, no spacing.
function buildMarbleBorder(){
  const order=['red-circle.png','green-circle.png','blue-circle.png','orange-circle.png'];
  const size=54;
  document.querySelectorAll('.marble-edge').forEach(edge=>{
    const horizontal=edge.classList.contains('marble-top')||edge.classList.contains('marble-bottom');
    const length=horizontal?window.innerWidth:(window.innerHeight-size*2);
    const count=Math.ceil(length/size)+1;
    edge.replaceChildren(...Array.from({length:count},(_,i)=>{
      const img=document.createElement('img');
      img.src=order[i%order.length];
      img.alt='';
      img.draggable=false;
      return img;
    }));
  });
}
buildMarbleBorder();
addEventListener('resize',buildMarbleBorder);
