// Pure structured objects shared by server and browser.
function fail(code,path,message) { const e=new Error(`dsh-ppt: ${code} at ${path}: ${message}`); e.code=code;e.path=path;throw e }
const object=(v,p,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid-object',p,'Expected object');for(const k of Object.keys(v))if(!keys.includes(k))fail('unknown-field',p+'.'+k,k)}
const number=(v,p,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('invalid-number',p,'Out of range');return v}
const integer=(v,p,min,max)=>{number(v,p,min,max);if(!Number.isInteger(v))fail('invalid-number',p,'Expected integer');return v}
const string=(v,p)=>{if(typeof v!=='string'||v.length>4096)fail('invalid-string',p,'Expected string up to 4096 characters');return v}
const color=(v,p)=>{if(!/^#[a-f0-9]{6}$/i.test(v))fail('invalid-color',p,'Expected #RRGGBB');return v.toUpperCase()}
const choice=(v,p,values)=>{if(!values.includes(v))fail('invalid-choice',p,'Expected '+values.join(', '));return v}
export const SCENE_CHART_KINDS=Object.freeze(['column','bar','line','pie','doughnut','area'])
function textStyle(v,p){object(v,p,['font','sizePt','color','bold','italic']);const o={};if(v.font!==undefined)o.font=string(v.font,p+'.font');if(v.sizePt!==undefined)o.sizePt=number(v.sizePt,p+'.sizePt',1,400);if(v.color!==undefined)o.color=color(v.color,p+'.color');for(const k of ['bold','italic'])if(v[k]!==undefined){if(typeof v[k]!=='boolean')fail('invalid-boolean',p+'.'+k,k);o[k]=v[k]}return o}
export function normalizeSceneChart(v,p='chart') {
 object(v,p,['kind','categories','series','title','titleStyle','chartAreaFill','plotAreaFill','legend','dataLabels','valueAxis','categoryAxisLabelStyle','valueAxisLabelStyle','grouping','holeSizePct','firstSliceAngleDeg'])
 const out={kind:choice(v.kind,p+'.kind',SCENE_CHART_KINDS)}
 if(!Array.isArray(v.categories)||!v.categories.length||v.categories.length>256)fail('chart-categories',p+'.categories','Expected 1–256 categories')
 out.categories=v.categories.map((s,i)=>string(s,`${p}.categories[${i}]`))
 if(!Array.isArray(v.series)||!v.series.length||v.series.length>32)fail('chart-series',p+'.series','Expected 1–32 series')
 out.series=v.series.map((s,i)=>{const at=`${p}.series[${i}]`;object(s,at,['name','values','color','pointColors']);if(!Array.isArray(s.values)||s.values.length!==out.categories.length)fail('chart-values',at,'Each series must match categories');const r={name:string(s.name,at+'.name'),values:s.values.map((n,j)=>number(n,`${at}.values[${j}]`,-1e100,1e100))};if(s.color!==undefined)r.color=color(s.color,at+'.color');if(s.pointColors!==undefined){if(!Array.isArray(s.pointColors)||s.pointColors.length!==out.categories.length)fail('chart-colors',at,'Colors must match categories');r.pointColors=s.pointColors.map((c,j)=>color(c,`${at}.pointColors[${j}]`))}return r})
 const circular=['pie','doughnut'].includes(out.kind)
 if(circular&&(out.series.length!==1||out.series[0].values.some(n=>n<0)||out.series[0].values.reduce((a,b)=>a+b,0)<=0))fail('chart-circular-data',p,'Circular charts need one non-negative series with a positive total')
 for(const key of ['title'])if(v[key]!==undefined)out[key]=string(v[key],p+'.'+key)
 for(const key of ['chartAreaFill','plotAreaFill'])if(v[key]!==undefined)out[key]=color(v[key],p+'.'+key)
 for(const key of ['titleStyle','categoryAxisLabelStyle','valueAxisLabelStyle'])if(v[key]!==undefined)out[key]=textStyle(v[key],p+'.'+key)
 if(v.grouping!==undefined){if(circular||out.kind==='line')fail('chart-grouping',p,'Grouping is only supported on bar, column and area');out.grouping=choice(v.grouping,p+'.grouping',['standard','clustered','stacked','percentStacked'])}
 if(v.holeSizePct!==undefined){if(out.kind!=='doughnut')fail('chart-hole',p,'Hole is only for doughnut');out.holeSizePct=integer(v.holeSizePct,p+'.holeSizePct',10,90)}
 if(v.firstSliceAngleDeg!==undefined){if(!circular)fail('chart-angle',p,'Slice angle is only for circular charts');out.firstSliceAngleDeg=integer(v.firstSliceAngleDeg,p+'.firstSliceAngleDeg',0,360)}
 if(v.legend!==undefined){object(v.legend,p+'.legend',['position','textStyle']);out.legend={position:choice(v.legend.position,p+'.legend.position',['b','t','l','r','tr','none'])};if(v.legend.textStyle!==undefined)out.legend.textStyle=textStyle(v.legend.textStyle,p+'.legend.textStyle')}
 if(v.dataLabels!==undefined){object(v.dataLabels,p+'.dataLabels',['showValue','showCategory','showSeriesName','showPercent','numberFormat','textStyle']);out.dataLabels={};for(const [k,x]of Object.entries(v.dataLabels)){if(k==='textStyle')out.dataLabels[k]=textStyle(x,p+'.dataLabels.textStyle');else if(k==='numberFormat')out.dataLabels[k]=string(x,p+'.dataLabels.numberFormat');else{if(typeof x!=='boolean')fail('invalid-boolean',p+'.dataLabels.'+k,k);out.dataLabels[k]=x}}}
 if(v.valueAxis!==undefined){if(circular)fail('chart-axis',p,'Circular charts have no value axis');object(v.valueAxis,p+'.valueAxis',['min','max','majorUnit','numberFormat']);out.valueAxis={};for(const [k,x]of Object.entries(v.valueAxis))out.valueAxis[k]=k==='numberFormat'?string(x,p+'.valueAxis.'+k):number(x,p+'.valueAxis.'+k,k==='majorUnit'?Number.MIN_VALUE:-1e100,1e100);if(out.valueAxis.min!==undefined&&out.valueAxis.max!==undefined&&out.valueAxis.min>=out.valueAxis.max)fail('chart-axis',p,'min must be less than max')}
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
