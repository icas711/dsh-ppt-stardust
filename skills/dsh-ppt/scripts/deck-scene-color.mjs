// DrawingML colour transforms, in their original order. Preserve the source
// specification in PPTX; resolve the same colour for CSS previews.
const clamp = value => Math.max(0, Math.min(1, value))
const linear = value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4
const srgb = value => value <= .0031308 ? 12.92*value : 1.055*value**(1/2.4)-.055
function hsl([r,g,b]) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2
  if(!d)return [0,0,l]
  const h=max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4
  return [h/6,d/(1-Math.abs(2*l-1)),l]
}
function rgb([h,s,l]) {
  h=((h%1)+1)%1;s=clamp(s);l=clamp(l)
  const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))}
  return [f(0),f(8),f(4)]
}
export function sceneTextColor(style) {
  const spec=style.colorSpec
  if(!spec)return {color:style.color,opacity:1}
  let channels=[1,3,5].map(i=>parseInt(spec.base.slice(i,i+2),16)/255),opacity=1
  for(const {name,value} of spec.transforms??[]){
    const amount=value/100000
    if(name.startsWith('alpha')){opacity=clamp(name==='alpha'?amount:name==='alphaMod'?opacity*amount:opacity+amount);continue}
    if(name==='tint'){channels=channels.map(v=>srgb(clamp(linear(v)*amount+1-amount)));continue}
    if(name==='shade'){channels=channels.map(v=>srgb(clamp(linear(v)*amount)));continue}
    const channel={red:0,green:1,blue:2}[name.replace(/Mod|Off/,'')]
    if(channel!==undefined){channels[channel]=srgb(clamp(name.endsWith('Mod')?linear(channels[channel])*amount:linear(channels[channel])+amount));continue}
    const values=hsl(channels),index=name.startsWith('hue')?0:name.startsWith('sat')?1:2
    values[index]=name.endsWith('Mod')?values[index]*amount:values[index]+(index===0?value/21600000:amount)
    if(index!==0)values[index]=clamp(values[index])
    channels=rgb(values)
  }
  return {color:'#'+channels.map(v=>Math.round(clamp(v)*255).toString(16).padStart(2,'0')).join('').toUpperCase(),opacity}
}
