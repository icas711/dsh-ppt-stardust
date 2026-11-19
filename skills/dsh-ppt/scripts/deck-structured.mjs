// Pure structured objects shared by server and browser.
function fail(code,path,message) { const e=new Error(`dsh-ppt: ${code} at ${path}: ${message}`); e.code=code;e.path=path;throw e }
const object=(v,p,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid-object',p,'Expected object');for(const k of Object.keys(v))if(!keys.includes(k))fail('unknown-field',p+'.'+k,k)}
const number=(v,p,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('invalid-number',p,'Out of range');return v}
const integer=(v,p,min,max)=>{number(v,p,min,max);if(!Number.isInteger(v))fail('invalid-number',p,'Expected integer');return v}
const string=(v,p)=>{if(typeof v!=='string'||v.length>4096)fail('invalid-string',p,'Expected string up to 4096 characters');return v}
const color=(v,p)=>{if(!/^#[a-f0-9]{6}$/i.test(v))fail('invalid-color',p,'Expected #RRGGBB');return v.toUpperCase()}
const choice=(v,p,values)=>{if(!values.includes(v))fail('invalid-choice',p,'Expected '+values.join(', '));return v}
export const SCENE_CHART_KINDS=Object.freeze(['column','bar','line','pie','doughnut','area'])
function textStyle(v,p){object(v,p,['font','fontComplexScript','sizePt','color','bold','italic']);const o={};if(v.font!==undefined)o.font=string(v.font,p+'.font');if(v.fontComplexScript!==undefined)o.fontComplexScript=string(v.fontComplexScript,p+'.fontComplexScript');if(v.sizePt!==undefined)o.sizePt=number(v.sizePt,p+'.sizePt',1,400);if(v.color!==undefined)o.color=color(v.color,p+'.color');for(const k of ['bold','italic'])if(v[k]!==undefined){if(typeof v[k]!=='boolean')fail('invalid-boolean',p+'.'+k,k);o[k]=v[k]}return o}
function labels(v,p){
 object(v,p,['showValue','showCategory','showSeriesName','showPercent','showLeaderLines','showBubbleSize','showLegendKey','numberFormat','textStyle','position','separator','fillColor','text'])
 const out={}
 for(const [k,x]of Object.entries(v)){
  if(k==='textStyle')out[k]=textStyle(x,p+'.textStyle')
  else if(k==='fillColor')out[k]=color(x,p+'.fillColor')
  else if(k==='position')out[k]=choice(x,p+'.position',['bestFit','b','ctr','inBase','inEnd','l','outEnd','r','t'])
  else if(['numberFormat','separator','text'].includes(k))out[k]=string(x,p+'.'+k)
  else{if(typeof x!=='boolean')fail('invalid-boolean',p+'.'+k,k);out[k]=x}
 }
 return out
}
export function normalizeSceneChart(v,p='chart') {
 object(v,p,['kind','categories','series','title','titleStyle','chartAreaFill','plotAreaFill','legend','dataLabels','valueAxis','categoryAxisLabelStyle','valueAxisLabelStyle','grouping','holeSizePct','firstSliceAngleDeg','valueAxisMajorGridlines','valueAxisMinorGridlines','categoryAxisOrientation','valueAxisOrientation','valueAxisCrosses','varyColors','dispBlanksAs','language','plotAreaLayout','gapWidthPct','overlapPct','categoryAxisHidden','valueAxisHidden','valueAxisMajorTickMark','valueAxisMinorTickMark','valueAxisTickLabelPos','categoryAxisMajorTickMark','categoryAxisMinorTickMark','categoryAxisTickLabelPos','categoryAxisLabelAlign','valueAxisCrossBetween'])
 const out={kind:choice(v.kind,p+'.kind',SCENE_CHART_KINDS)}
 if(!Array.isArray(v.categories)||!v.categories.length||v.categories.length>256)fail('chart-categories',p+'.categories','Expected 1–256 categories')
 out.categories=Array.from(v.categories,(s,i)=>string(s,`${p}.categories[${i}]`))
 if(!Array.isArray(v.series)||!v.series.length||v.series.length>32)fail('chart-series',p+'.series','Expected 1–32 series')
 out.series=Array.from(v.series,(s,i)=>{const at=`${p}.series[${i}]`;object(s,at,['name','values','color','pointColors','lineWidthEmu','dataLabels','pointDataLabels']);if(!Array.isArray(s.values)||s.values.length!==out.categories.length)fail('chart-values',at,'Each series must match categories');const r={name:string(s.name,at+'.name'),values:Array.from(s.values,(n,j)=>number(n,`${at}.values[${j}]`,-1e100,1e100))};if(s.color!==undefined)r.color=color(s.color,at+'.color');if(s.pointColors!==undefined){if(!Array.isArray(s.pointColors)||s.pointColors.length>out.categories.length)fail('chart-colors',at,'Colors must match categories');r.pointColors=Array.from({length:out.categories.length},(_,j)=>s.pointColors[j]==null?null:color(s.pointColors[j],`${at}.pointColors[${j}]`))}if(s.lineWidthEmu!==undefined)r.lineWidthEmu=integer(s.lineWidthEmu,at+'.lineWidthEmu',0,1270000);if(s.dataLabels!==undefined)r.dataLabels=labels(s.dataLabels,at+'.dataLabels');if(s.pointDataLabels!==undefined){if(!Array.isArray(s.pointDataLabels)||s.pointDataLabels.length!==out.categories.length)fail('chart-labels',at,'Point labels must match categories');r.pointDataLabels=s.pointDataLabels.map((x,j)=>x===null?null:labels(x,at+'.pointDataLabels['+j+']'))}return r})
 const circular=['pie','doughnut'].includes(out.kind)
 if(circular&&(out.series.length!==1||out.series[0].values.some(n=>n<0)||out.series[0].values.reduce((a,b)=>a+b,0)<=0))fail('chart-circular-data',p,'Circular charts need one non-negative series with a positive total')
 for(const key of ['title'])if(v[key]!==undefined)out[key]=string(v[key],p+'.'+key)
 for(const key of ['chartAreaFill','plotAreaFill'])if(v[key]!==undefined)out[key]=color(v[key],p+'.'+key)
 for(const key of ['titleStyle','categoryAxisLabelStyle','valueAxisLabelStyle'])if(v[key]!==undefined)out[key]=textStyle(v[key],p+'.'+key)
 if(v.grouping!==undefined){if(circular||out.kind==='line')fail('chart-grouping',p,'Grouping is only supported on bar, column and area');out.grouping=choice(v.grouping,p+'.grouping',['standard','clustered','stacked','percentStacked'])}
 if(v.holeSizePct!==undefined){if(out.kind!=='doughnut')fail('chart-hole',p,'Hole is only for doughnut');out.holeSizePct=integer(v.holeSizePct,p+'.holeSizePct',10,90)}
 if(v.firstSliceAngleDeg!==undefined){if(!circular)fail('chart-angle',p,'Slice angle is only for circular charts');out.firstSliceAngleDeg=integer(v.firstSliceAngleDeg,p+'.firstSliceAngleDeg',0,360)}
 if(v.legend!==undefined){object(v.legend,p+'.legend',['position','textStyle']);out.legend={position:choice(v.legend.position,p+'.legend.position',['b','t','l','r','tr','none'])};if(v.legend.textStyle!==undefined)out.legend.textStyle=textStyle(v.legend.textStyle,p+'.legend.textStyle')}
 if(v.dataLabels!==undefined)out.dataLabels=labels(v.dataLabels,p+'.dataLabels')
 if(['area','doughnut'].includes(out.kind)&&[out.dataLabels,...out.series.flatMap(s=>[s.dataLabels,...(s.pointDataLabels??[])])].some(l=>l?.position!==undefined))fail('chart-label-position',p,'Explicit label positions for area/doughnut are not supported by the native exporter; omit position and review automatic placement')
 if(v.valueAxis!==undefined){if(circular)fail('chart-axis',p,'Circular charts have no value axis');object(v.valueAxis,p+'.valueAxis',['min','max','majorUnit','numberFormat']);out.valueAxis={};for(const [k,x]of Object.entries(v.valueAxis))out.valueAxis[k]=k==='numberFormat'?string(x,p+'.valueAxis.'+k):number(x,p+'.valueAxis.'+k,k==='majorUnit'?Number.MIN_VALUE:-1e100,1e100);if(out.valueAxis.min!==undefined&&out.valueAxis.max!==undefined&&out.valueAxis.min>=out.valueAxis.max)fail('chart-axis',p,'min must be less than max')}
 for(const k of ['valueAxisMajorGridlines','valueAxisMinorGridlines','varyColors','categoryAxisHidden','valueAxisHidden'])if(v[k]!==undefined){if(typeof v[k]!=='boolean')fail('invalid-boolean',p+'.'+k,k);out[k]=v[k]}
 for(const k of ['categoryAxisOrientation','valueAxisOrientation'])if(v[k]!==undefined)out[k]=choice(v[k],p+'.'+k,['minMax','maxMin'])
 if(v.valueAxisCrosses!==undefined)out.valueAxisCrosses=choice(v.valueAxisCrosses,p+'.valueAxisCrosses',['autoZero','min','max'])
 for(const k of ['gapWidthPct','overlapPct'])if(v[k]!==undefined)out[k]=number(v[k],p+'.'+k,k==='overlapPct'?-100:0,k==='overlapPct'?100:500)
 for(const k of ['language'])if(v[k]!==undefined)out[k]=string(v[k],p+'.'+k)
 for(const [k,values]of Object.entries({dispBlanksAs:['gap','zero','span'],valueAxisMajorTickMark:['cross','in','out','none'],valueAxisMinorTickMark:['cross','in','out','none'],categoryAxisMajorTickMark:['cross','in','out','none'],categoryAxisMinorTickMark:['cross','in','out','none'],categoryAxisTickLabelPos:['high','low','nextTo','none'],valueAxisTickLabelPos:['high','low','nextTo','none'],categoryAxisLabelAlign:['ctr','l','r'],valueAxisCrossBetween:['between','midCat']}))if(v[k]!==undefined)out[k]=choice(v[k],p+'.'+k,values)
 if(v.plotAreaLayout!==undefined){object(v.plotAreaLayout,p+'.plotAreaLayout',['x','y','w','h','target']);out.plotAreaLayout={};for(const k of ['x','y','w','h'])out.plotAreaLayout[k]=number(v.plotAreaLayout[k],p+'.plotAreaLayout.'+k,k==='x'||k==='y'?-1:0,1);if(v.plotAreaLayout.target!==undefined)out.plotAreaLayout.target=choice(v.plotAreaLayout.target,p+'.plotAreaLayout.target',['inner','outer'])}
 return out
}
export function normalizeSceneTable(v,p,normalizeText) {
 object(v,p,['columns','rows','cells'])
 if(!Array.isArray(v.columns)||!v.columns.length||v.columns.length>32||!Array.isArray(v.rows)||!v.rows.length||v.rows.length>100)fail('table-dimensions',p,'Expected 1–32 columns and 1–100 rows')
 const columns=v.columns.map((n,i)=>integer(n,`${p}.columns[${i}]`,1,51206400)),rows=v.rows.map((n,i)=>integer(n,`${p}.rows[${i}]`,1,51206400))
 if(!Array.isArray(v.cells)||v.cells.length>3200)fail('table-cells',p,'Expected at most 3200 cells')
 const covered=new Set()
 const cells=v.cells.map((c,i)=>{const at=`${p}.cells[${i}]`;object(c,at,['row','col','rowSpan','colSpan','paragraphs','textStyle','textFrame','fill','borders']);const row=integer(c.row,at+'.row',0,rows.length-1),col=integer(c.col,at+'.col',0,columns.length-1),rowSpan=integer(c.rowSpan??1,at+'.rowSpan',1,rows.length-row),colSpan=integer(c.colSpan??1,at+'.colSpan',1,columns.length-col);for(let r=row;r<row+rowSpan;r++)for(let k=col;k<col+colSpan;k++){const key=r+':'+k;if(covered.has(key))fail('table-overlap',at,'Merged cells overlap');covered.add(key)}const out={row,col,rowSpan,colSpan,...normalizeText(c,at)};if(c.fill!==undefined)out.fill=color(c.fill,at+'.fill');if(c.borders!==undefined){object(c.borders,at+'.borders',['left','right','top','bottom']);out.borders={};for(const [side,b]of Object.entries(c.borders)){object(b,at+'.borders.'+side,['color','width']);out.borders[side]={color:color(b.color,at+'.borders.'+side+'.color'),width:number(b.width??1,at+'.borders.'+side+'.width',0,100)}}}return out})
 if(covered.size!==rows.length*columns.length)fail('table-gap',p,'Every grid position must belong to exactly one cell')
 return {columns,rows,cells}
}
