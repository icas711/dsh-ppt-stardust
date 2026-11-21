// Generated amount labels stay bound to the current native chart values.
export function refreshAmountLabels(chart){
 if(!chart.amountLabels)return chart
 const {unit,showPercent=false}=chart.amountLabels,series=chart.series[0]
 const joinedUnit=unit.replace(/[ \t\r\n\u202f]+/g,'\u00a0'),total=series.values.reduce((a,b)=>a+b,0)
 const base={...chart.dataLabels,...series.dataLabels,showValue:false,showPercent:false,showCategory:false}
 series.dataLabels={...base}
 series.pointDataLabels=series.values.map((value,i)=>({...base,...series.pointDataLabels?.[i],showValue:false,showPercent:false,showCategory:false,text:`${chart.categories[i]}: ${value}\u00a0${joinedUnit}${showPercent?` (${(value/total*100).toFixed(0)}%)`:''}`}))
 return chart
}
