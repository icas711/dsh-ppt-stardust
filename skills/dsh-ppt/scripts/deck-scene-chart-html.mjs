import {escapeHtml as esc} from './deck-text.mjs'
/** Offline, data-preserving SVG preview; Office remains authoritative for chart layout. */
export function renderSceneChartSvg(c,theme) {
 const colors=c.series.map((s,i)=>s.color??[theme.palette.accent,theme.palette.accent2,'#55B5AA','#A580D3'][i%4])
 const circular=['pie','doughnut'].includes(c.kind),W=1000,H=600,x0=90,y0=60,pw=840,ph=430
 const out=[`<rect width="1000" height="600" fill="${c.chartAreaFill??theme.palette.bg}"/>`]
 const text=(x,y,s,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${theme.palette.fg}" font-family="${esc(c.titleStyle?.font??'sans-serif')}" font-size="18">${esc(s)}</text>`
 if(c.title)out.push(text(500,30,c.title))
 if(circular){const values=c.series[0].values,total=values.reduce((a,b)=>a+b,0);let a=(c.firstSliceAngleDeg??0)*Math.PI/180-Math.PI/2
 values.forEach((v,i)=>{const b=a+v/total*Math.PI*2,col=c.series[0].pointColors?.[i]??[theme.palette.accent,theme.palette.accent2,'#55B5AA','#A580D3'][i%4],r=200,cx=370,cy=280;if(v===total)out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`);else if(v>0)out.push(`<path d="M ${cx} ${cy} L ${cx+r*Math.cos(a)} ${cy+r*Math.sin(a)} A ${r} ${r} 0 ${b-a>Math.PI?1:0} 1 ${cx+r*Math.cos(b)} ${cy+r*Math.sin(b)} Z" fill="${col}"/>`);out.push(text(650,90+i*28,c.categories[i]+': '+v,'start'));a=b})
 if(c.kind==='doughnut')out.push(`<circle cx="370" cy="280" r="${200*(c.holeSizePct??50)/100}" fill="${c.plotAreaFill??c.chartAreaFill??theme.palette.bg}"/>`)
 }else{
 const stacked=['stacked','percentStacked'].includes(c.grouping),percent=c.grouping==='percentStacked',totals=c.categories.map((_,i)=>c.series.reduce((a,s)=>a+Math.max(0,s.values[i]),0)),negative=c.categories.map((_,i)=>c.series.reduce((a,s)=>a+Math.min(0,s.values[i]),0))
 const lo=c.valueAxis?.min??(percent?0:Math.min(0,...(stacked?negative:c.series.flatMap(s=>s.values)))),hi=c.valueAxis?.max??(percent?1:Math.max(0,...(stacked?totals:c.series.flatMap(s=>s.values))))
 const range=hi-lo||1,scale=v=>(v-lo)/range,bar=c.kind==='bar',n=c.categories.length,step=(bar?ph:pw)/n
 out.push(`<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" fill="${c.plotAreaFill??'none'}" stroke="${theme.palette.muted}"/>`)
 const positive=Array(n).fill(0),neg=Array(n).fill(0)
 c.series.forEach((s,si)=>{const points=[];s.values.forEach((raw,i)=>{const v=percent?(totals[i]?raw/totals[i]:0):raw,from=stacked?(v>=0?positive[i]:neg[i]):0,to=from+v;if(v>=0)positive[i]=to;else neg[i]=to
 const lane=stacked?step*.7:step*.7/c.series.length,offset=step*.15+(stacked?0:si*lane)
 if(c.kind==='bar')out.push(`<rect x="${x0+Math.min(scale(from),scale(to))*pw}" y="${y0+i*step+offset}" width="${Math.abs(v/range*pw)}" height="${lane}" fill="${colors[si]}"/>`)
 else if(c.kind==='column')out.push(`<rect x="${x0+i*step+offset}" y="${y0+(1-Math.max(scale(from),scale(to)))*ph}" width="${lane}" height="${Math.abs(v/range*ph)}" fill="${colors[si]}"/>`)
 else points.push([x0+(i+.5)*step,y0+(1-scale(to))*ph,y0+(1-scale(from))*ph])
 if(si===0)out.push(bar?text(x0-10,y0+(i+.5)*step,c.categories[i],'end'):text(x0+(i+.5)*step,y0+ph+28,c.categories[i]))
 if(c.dataLabels?.showValue)out.push(text(bar?x0+scale(to)*pw+25:x0+(i+.5)*step,bar?y0+(i+.5)*step:y0+(1-scale(to))*ph-10,raw))
 });if(points.length){if(c.kind==='area')out.push(`<polygon points="${[...points.map(p=>p.slice(0,2)),...points.toReversed().map(p=>[p[0],p[2]])].map(p=>p.join(',')).join(' ')}" fill="${colors[si]}" fill-opacity="0.65"/>`);else out.push(`<polyline points="${points.map(p=>p.slice(0,2).join(',')).join(' ')}" fill="none" stroke="${colors[si]}" stroke-width="3"/>`)}})
 if(c.legend?.position!=='none')c.series.forEach((s,i)=>out.push(`<rect x="${100+i*200}" y="555" width="15" height="15" fill="${colors[i]}"/>`+text(122+i*200,570,s.name,'start')))
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label="${esc(c.title??'Chart')}">${out.join('')}</svg>`
}
