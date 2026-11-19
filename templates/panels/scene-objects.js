function PptSceneObjects({elements,onChange,disabled,assets={},label,notes,onMeta,onAsset,onPending,onError,uploadGeneration}){
 const localGeneration=React.useRef(0),generation=uploadGeneration??localGeneration,mounted=React.useRef(true);React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;onPending?.(false)}},[]);
 const upload=async(event,elementId)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024){onError?.('PNG/JPEG ≤ 5 MiB');return}
  const token=++generation.current;onPending?.(true);
  try{
   const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),id='img-'+Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
   if(!mounted.current||token!==generation.current)return;
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Cannot read image'));reader.readAsDataURL(file)});
   const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Invalid raster image'));img.src=data});
   if(image.naturalWidth>16000||image.naturalHeight>16000||image.naturalWidth*image.naturalHeight>32000000)throw new Error('Image dimensions exceed the limit');
   if(mounted.current&&token===generation.current)onAsset(elementId,id,{mime:file.type,width:image.naturalWidth,height:image.naturalHeight,data});
  }catch(error){if(mounted.current&&token===generation.current)onError?.(error.message)}finally{if(mounted.current&&token===generation.current)onPending?.(false)}
 };
 const [selected,setSelected]=React.useState(elements[0]?.id??'');
 const e=elements.find(e=>e.id===selected)??elements[0];
 const ru=languageOf()==='ru',L=(a,b)=>ru?a:b;
 const change=patch=>onChange(elements.map(item=>item.id===e.id?{...item,...patch}:item));
 const input=(label,value,update,type='text')=>h('label',null,label,h('input',{type,value:value??'',disabled,onChange:event=>update(type==='number'?Number(event.target.value):event.target.value)}));
 const paragraphs=(ps,update)=>ps.map((p,pi)=>{
  const updateRun=(ri,patch)=>update(ps.map((p,j)=>j===pi?{...p,runs:p.runs.map((r,k)=>k===ri?{...r,...patch}:r)}:p));
  const runs=p.runs.map((run,ri)=>{
   if(run.break)return h('br',{key:ri});
   const changeStyle=patch=>{const style={...run.style,...patch};if(Object.hasOwn(patch,'color'))delete style.colorSpec;if(Object.hasOwn(patch,'fontFamily')){delete style.sourceTypeface;delete style.fontHints;style.scriptFonts={eastAsian:patch.fontFamily,complexScript:patch.fontFamily};}updateRun(ri,{style});};
   const styleInputs=['fontFamily','size','color'].map(key=>input(key,run.style?.[key]??e.textStyle?.[key],value=>changeStyle({[key]:value}),key==='size'?'number':'text'));
   const flags=['bold','italic'].map(key=>h('label',{key},h('input',{type:'checkbox',checked:run.style?.[key]??e.textStyle?.[key]??false,disabled,onChange:event=>changeStyle({[key]:event.target.checked})}),key==='bold'?L('Жирный','Bold'):L('Курсив','Italic')));
   return h('div',{key:ri},h('textarea',{'aria-label':L('Текст','Text')+' '+(pi+1)+'.'+(ri+1),value:run.text,rows:2,disabled,onChange:event=>updateRun(ri,{text:event.target.value})}),h('details',null,h('summary',null,L('Оформление фрагмента','Run formatting')),...styleInputs,...flags));
  });
  const align=h('label',null,L('Выравнивание','Alignment'),h('select',{value:p.style?.align??'left',disabled,onChange:event=>update(ps.map((p,j)=>j===pi?{...p,style:{...p.style,align:event.target.value}}:p))},['left','center','right','justify'].map(value=>h('option',{key:value,value},value))));
  return h('div',{key:pi},...runs,align);
 });
 return h('section',{className:'ppt-scene-objects'},h('h3',null,L('Объекты слайда','Slide objects')),
  onMeta?h('div',null,input(L('Название слайда','Slide label'),label,value=>onMeta({label:value})),h('label',null,L('Заметки докладчика','Speaker notes'),h('textarea',{value:notes??'',disabled,onChange:event=>onMeta({notes:event.target.value})}))):null,
  h('select',{'aria-label':L('Объект','Object'),value:e?.id??'',disabled,onChange:event=>setSelected(event.target.value)},elements.map(item=>h('option',{key:item.id,value:item.id},(item.name??item.id)+' · '+item.type))),
  !e?null:h(React.Fragment,null,
   h('label',null,L('Назначение','Role'),h('select',{value:e.role??'content',disabled,onChange:event=>change({role:event.target.value})},h('option',{value:'content'},L('Контент','Content')),h('option',{value:'decor'},L('Оформление / логотип','Decoration / logo')))),
   h('details',null,h('summary',null,L('Положение и размер, мм','Position and size, mm')),...['x','y','w','h'].map(key=>input(key,e.frame[key]/36000,value=>{const frame={...e.frame,[key]:Math.round(value*36000)},patch={frame};if(e.type==='table'&&['w','h'].includes(key)){const axis=key==='w'?'columns':'rows',sizes=e.table[axis],next=[];for(let i=0;i<sizes.length;i++)next.push(i===sizes.length-1?frame[key]-next.reduce((a,b)=>a+b,0):Math.max(1,Math.round(sizes[i]*frame[key]/e.frame[key])));patch.table={...e.table,[axis]:next}}change(patch)},'number'))),
   e.type==='shape'?h('div',null,h('label',null,L('Фигура','Shape'),h('select',{value:e.preset,disabled,onChange:event=>change({preset:event.target.value})},['rect','roundRect','ellipse','triangle','diamond'].map(value=>h('option',{key:value,value},value)))),h('label',null,h('input',{type:'checkbox',checked:!!e.fill,disabled,onChange:event=>change({fill:event.target.checked?{color:'#FFFFFF'}:undefined})}),L('Заливка','Fill')),e.fill?input(L('Цвет заливки','Fill color'),e.fill.color,value=>change({fill:{...e.fill,color:value}}),'color'):null):null,
   ['shape','line'].includes(e.type)?h('div',null,e.type==='shape'?h('label',null,h('input',{type:'checkbox',checked:!!e.stroke,disabled,onChange:event=>change({stroke:event.target.checked?{color:'#000000',width:1}:undefined})}),L('Контур','Outline')):null,e.stroke?h('div',null,input(L('Цвет линии','Line color'),e.stroke.color,value=>change({stroke:{...e.stroke,color:value}}),'color'),input(L('Толщина, pt','Width, pt'),e.stroke.width,value=>change({stroke:{...e.stroke,width:value}}),'number'),h('label',null,L('Линия','Line'),h('select',{value:e.stroke.dash??'solid',disabled,onChange:event=>change({stroke:{...e.stroke,dash:event.target.value}})},['solid','dash','dot'].map(value=>h('option',{key:value,value},value))))):null):null,
   e.type==='text'?paragraphs(e.paragraphs,value=>change({paragraphs:value})):null,
   e.type==='chart'?h('div',null,h('label',null,L('Тип диаграммы','Chart kind'),h('select',{value:e.chart.kind,disabled,onChange:event=>change({chart:{...e.chart,kind:event.target.value}})},['column','bar','line','pie','doughnut','area'].map(kind=>h('option',{key:kind,value:kind},kind)))),
    h('table',null,h('thead',null,h('tr',null,h('th',null,L('Категория','Category')),...e.chart.series.map((s,i)=>h('th',{key:i},input(L('Ряд','Series'),s.name,value=>change({chart:{...e.chart,series:e.chart.series.map((s,j)=>j===i?{...s,name:value}:s)}})))))),
     h('tbody',null,e.chart.categories.map((category,i)=>h('tr',{key:i},h('td',null,input(L('Категория','Category'),category,value=>change({chart:{...e.chart,categories:e.chart.categories.map((c,j)=>j===i?value:c)}}))),...e.chart.series.map((s,j)=>h('td',{key:j},input(s.name,s.values[i],value=>{if(Number.isFinite(value))change({chart:{...e.chart,series:e.chart.series.map((s,k)=>k===j?{...s,values:s.values.map((n,q)=>q===i?value:n)}:s)}})},'number')))))))):null,
   e.type==='table'?e.table.cells.map((cell,i)=>h('details',{key:i},h('summary',null,L('Ячейка','Cell')+` ${cell.row+1}:${cell.col+1} (${cell.rowSpan}×${cell.colSpan})`),paragraphs(cell.paragraphs,value=>change({table:{...e.table,cells:e.table.cells.map((c,j)=>j===i?{...c,paragraphs:value}:c)}})))):null,
   e.type==='image'?h('label',null,L('Изображение','Image'),onAsset?h('input',{type:'file',accept:'image/png,image/jpeg',disabled,onChange:event=>upload(event,e.id)}):null,h('label',null,L('Размещение','Image fit'),h('select',{value:e.fit??'contain',disabled,onChange:event=>change({fit:event.target.value})},['contain','cover','fill'].map(value=>h('option',{key:value,value},value)))),assets[e.assetId]?.data?h('img',{className:'image-preview',src:assets[e.assetId].data,alt:e.alt??''}):null,h('select',{value:e.assetId,disabled,onChange:event=>change({assetId:event.target.value})},Object.entries(assets).filter(([,a])=>a.mime?.startsWith('image/')).map(([id])=>h('option',{key:id,value:id},id))),input(L('Описание','Description'),e.alt,value=>change({alt:value}))):null,
   e.type==='unsupported'?h('p',{role:'status'},e.sourceKind+': '+e.reason):null,
   h('div',{className:'tools'},h('button',{disabled:disabled||elements.some(e=>e.type==='group')||elements.indexOf(e)===0,onClick:()=>{const next=[...elements],i=next.indexOf(e);[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next)}},L('Назад по слоям','Move backward')),h('button',{disabled:disabled||elements.some(e=>e.type==='group')||elements.indexOf(e)===elements.length-1,onClick:()=>{const next=[...elements],i=next.indexOf(e);[next[i+1],next[i]]=[next[i],next[i+1]];onChange(next)}},L('Вперёд по слоям','Move forward')))
  ));
}
