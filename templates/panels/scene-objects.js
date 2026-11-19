function PptSceneObjects({elements,onChange,disabled,assets={},label,notes,onMeta}){
 const [selected,setSelected]=React.useState(elements[0]?.id??'');
 const e=elements.find(e=>e.id===selected)??elements[0];
 const ru=languageOf()==='ru',L=(a,b)=>ru?a:b;
 const change=patch=>onChange(elements.map(item=>item.id===e.id?{...item,...patch}:item));
 const input=(label,value,update,type='text')=>h('label',null,label,h('input',{type,value:value??'',disabled,onChange:event=>update(type==='number'?Number(event.target.value):event.target.value)}));
 const paragraphs=(ps,update)=>ps.map((p,pi)=>{
  const updateRun=(ri,patch)=>update(ps.map((p,j)=>j===pi?{...p,runs:p.runs.map((r,k)=>k===ri?{...r,...patch}:r)}:p));
  const runs=p.runs.map((run,ri)=>{
   if(run.break)return h('br',{key:ri});
   const changeStyle=patch=>{const style={...run.style,...patch};if(Object.hasOwn(patch,'color'))delete style.colorSpec;updateRun(ri,{style});};
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
   h('details',null,h('summary',null,L('Положение и размер, мм','Position and size, mm')),...['x','y','w','h'].map(key=>input(key,e.frame[key]/36000,value=>change({frame:{...e.frame,[key]:Math.round(value*36000)}}),'number'))),
   e.type==='text'?paragraphs(e.paragraphs,value=>change({paragraphs:value})):null,
   e.type==='chart'?h('div',null,h('label',null,L('Тип диаграммы','Chart kind'),h('select',{value:e.chart.kind,disabled,onChange:event=>change({chart:{...e.chart,kind:event.target.value}})},['column','bar','line','pie','doughnut','area'].map(kind=>h('option',{key:kind,value:kind},kind)))),
    h('table',null,h('thead',null,h('tr',null,h('th',null,L('Категория','Category')),...e.chart.series.map((s,i)=>h('th',{key:i},input(L('Ряд','Series'),s.name,value=>change({chart:{...e.chart,series:e.chart.series.map((s,j)=>j===i?{...s,name:value}:s)}})))))),
     h('tbody',null,e.chart.categories.map((category,i)=>h('tr',{key:i},h('td',null,input(L('Категория','Category'),category,value=>change({chart:{...e.chart,categories:e.chart.categories.map((c,j)=>j===i?value:c)}}))),...e.chart.series.map((s,j)=>h('td',{key:j},input(s.name,s.values[i],value=>{if(Number.isFinite(value))change({chart:{...e.chart,series:e.chart.series.map((s,k)=>k===j?{...s,values:s.values.map((n,q)=>q===i?value:n)}:s)}})},'number')))))))):null,
   e.type==='table'?e.table.cells.map((cell,i)=>h('details',{key:i},h('summary',null,L('Ячейка','Cell')+` ${cell.row+1}:${cell.col+1} (${cell.rowSpan}×${cell.colSpan})`),paragraphs(cell.paragraphs,value=>change({table:{...e.table,cells:e.table.cells.map((c,j)=>j===i?{...c,paragraphs:value}:c)}})))):null,
   e.type==='image'?h('label',null,L('Изображение','Image'),h('select',{value:e.assetId,disabled,onChange:event=>change({assetId:event.target.value})},Object.entries(assets).filter(([,a])=>a.mime?.startsWith('image/')).map(([id])=>h('option',{key:id,value:id},id))),input(L('Описание','Description'),e.alt,value=>change({alt:value}))):null,
   e.type==='unsupported'?h('p',{role:'status'},e.sourceKind+': '+e.reason):null,
   h('div',{className:'tools'},h('button',{disabled:disabled||elements.some(e=>e.type==='group')||elements.indexOf(e)===0,onClick:()=>{const next=[...elements],i=next.indexOf(e);[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next)}},L('Назад по слоям','Move backward')),h('button',{disabled:disabled||elements.some(e=>e.type==='group')||elements.indexOf(e)===elements.length-1,onClick:()=>{const next=[...elements],i=next.indexOf(e);[next[i+1],next[i]]=[next[i],next[i+1]];onChange(next)}},L('Вперёд по слоям','Move forward')))
  ));
}
