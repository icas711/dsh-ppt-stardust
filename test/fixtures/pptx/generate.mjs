// Independent OOXML fixtures: deliberately do not import the product exporter.
import { zipSync, strToU8 } from 'fflate'
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const page = { width: 9906000, height: 6858000 }
const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const c = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const xml = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const rels = items => xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${r}/${type}" Target="${target}"/>`).join('')}</Relationships>`)
const transform = (x, y, w, h) => `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`
const nv = (id, name) => `<p:nvSpPr><p:cNvPr id="${id}" name="${escape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
const run = (text, attrs = '', color = '202020') => `<a:r><a:rPr lang="en-US" sz="1800" ${attrs}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Liberation Sans"/></a:rPr><a:t>${escape(text)}</a:t></a:r>`
const paragraph = content => `<a:p><a:pPr algn="l"/>${content}<a:endParaRPr lang="en-US" sz="1800"/></a:p>`
const body = content => `<p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>${content}</p:txBody>`
function text(id, name, x, y, w, h, value, rich) {
  return `<p:sp>${nv(id, name)}<p:spPr>${transform(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>${body(rich ?? paragraph(run(value)))}</p:sp>`
}
function picture(id, x, y, w, h) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Logo ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rImage"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${transform(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}
function plate(id, x, y, w, h, color) {
  return `<p:sp>${nv(id, `Plate ${id}`)}<p:spPr>${transform(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`
}
function group(id, name, outer, inner, children) {
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${outer[0]}" y="${outer[1]}"/><a:ext cx="${outer[2]}" cy="${outer[3]}"/><a:chOff x="${inner[0]}" y="${inner[1]}"/><a:chExt cx="${inner[2]}" cy="${inner[3]}"/></a:xfrm></p:grpSpPr>${children}</p:grpSp>`
}
const tree = children => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${children}</p:spTree>`
const title = text(2, 'Title', 500000, 250000, 8800000, 600000, 'Synthetic fixture')
const white = '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
const themeFill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
// DrawingML requires three entries in each theme style list.
const themeFormats = `<a:fmtScheme name="Synthetic"><a:fillStyleLst>${themeFill.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${[9525, 25400, 38100].map(w => `<a:ln w="${w}">${themeFill}<a:prstDash val="solid"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${themeFill.repeat(3)}</a:bgFillStyleLst></a:fmtScheme>`
const theme = xml(`<a:theme xmlns:a="${a}" name="Synthetic"><a:themeElements><a:clrScheme name="Synthetic">${[['dk1', '202020'], ['lt1', 'FFFFFF'], ['dk2', '303030'], ['lt2', 'EEEEEE'], ['accent1', 'CF1F2F'], ['accent2', '2864B4'], ['accent3', '507C34'], ['accent4', '987135'], ['accent5', '703090'], ['accent6', '308080'], ['hlink', '0000FF'], ['folHlink', '800080']].map(([key, val]) => `<a:${key}><a:srgbClr val="${val}"/></a:${key}>`).join('')}</a:clrScheme><a:fontScheme name="Synthetic"><a:majorFont><a:latin typeface="Liberation Sans"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Liberation Sans"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>${themeFormats}</a:themeElements></a:theme>`)
export function packageDeck(children, extras = {}, relationships = [], types = []) {
  const entries = {
    '[Content_Types].xml': xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/>${[
      ['/ppt/presentation.xml', 'presentationml.presentation.main'], ['/ppt/slides/slide1.xml', 'presentationml.slide'], ['/ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster'], ['/ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout'], ['/ppt/theme/theme1.xml', 'theme'], ...types,
    ].map(([part, type]) => `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join('')}</Types>`),
    '_rels/.rels': rels([['rOffice', 'officeDocument', 'ppt/presentation.xml']]),
    'ppt/presentation.xml': xml(`<p:presentation xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rMaster"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rSlide"/></p:sldIdLst><p:sldSz cx="${page.width}" cy="${page.height}" type="A4"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': rels([['rMaster', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rSlide', 'slide', 'slides/slide1.xml']]),
    'ppt/slides/slide1.xml': xml(`<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}" xmlns:c="${c}"><p:cSld>${white}${tree(children)}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`),
    'ppt/slides/_rels/slide1.xml.rels': rels([['rLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ...relationships]),
    'ppt/slideLayouts/slideLayout1.xml': xml(`<p:sldLayout xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}" type="blank" preserve="1"><p:cSld name="Synthetic">${tree('')}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': rels([['rMaster', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
    'ppt/slideMasters/slideMaster1.xml': xml(`<p:sldMaster xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld>${white}${tree('')}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rLayout"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rLayout', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rTheme', 'theme', '../theme/theme1.xml']]),
    'ppt/theme/theme1.xml': theme,
    ...extras,
  }
  // Fixed timestamps make fixture hashes reproducible across platforms/runs.
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, [typeof value === 'string' ? strToU8(value) : value, { mtime: new Date(2020, 0, 1) }]]))))
}
function graphic(id, name, x, y, w, h, uri, content) {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></p:xfrm><a:graphic><a:graphicData uri="${uri}">${content}</a:graphicData></a:graphic></p:graphicFrame>`
}

export function fixtures() {
  const dense = Array.from({ length: 12 }, (_, i) => text(10 + i, `Block ${i + 1}`, 500000 + i % 3 * 3000000, 1300000 + Math.floor(i / 3) * 1200000, 2600000, 800000, `Independent block ${i + 1}`)).join('')
  const nested = group(20, 'Nested group', [1350000, 800000, 1000000, 1200000], [100000, 200000, 500000, 600000], text(21, 'Nested text', 150000, 300000, 350000, 160000, 'Nested'))
  const grouped = group(10, 'Outer group', [1000000, 1400000, 6000000, 3600000], [100000, 200000, 3000000, 2400000], text(11, 'Grouped text', 350000, 400000, 1000000, 400000, 'Grouped') + nested)
  const png = new PNG({ width: 32, height: 16 }); for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 207; png.data[i + 1] = 31; png.data[i + 2] = 47; png.data[i + 3] = 255 }
  const image = PNG.sync.write(png)
  const imageRel = [['rImage', 'image', '../media/preview.png']]
  const pictures = Array.from({ length: 13 }, (_, i) => picture(10 + i, 300000 + i % 7 * 1300000, 1200000 + Math.floor(i / 7) * 1400000, 900000, 500000)).join('')
  const line = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="90" name="Connector"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${transform(500000, 5000000, 7000000, 0)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="25400"><a:solidFill><a:srgbClr val="CF1F2F"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
  const chart = xml(`<c:chartSpace xmlns:c="${c}" xmlns:a="${a}" xmlns:r="${r}"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Series</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="CF1F2F"/></a:solidFill></c:spPr><c:cat><c:strLit><c:ptCount val="2"/><c:pt idx="0"><c:v>A</c:v></c:pt><c:pt idx="1"><c:v>B</c:v></c:pt></c:strLit></c:cat><c:val><c:numLit><c:formatCode>0</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>12</c:v></c:pt><c:pt idx="1"><c:v>8</c:v></c:pt></c:numLit></c:val></c:ser><c:axId val="100"/><c:axId val="200"/></c:barChart><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="200"/><c:crosses val="autoZero"/></c:catAx><c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:numFmt formatCode="0" sourceLinked="0"/><c:crossAx val="100"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`)
  const cell = (value, attrs = '') => `<a:tc ${attrs}><a:txBody><a:bodyPr/><a:lstStyle/>${paragraph(run(value))}</a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEEEEE"/></a:solidFill></a:tcPr></a:tc>`
  const table = `<a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="1000000"/><a:gridCol w="1000000"/></a:tblGrid><a:tr h="600000">${cell('Merged', 'gridSpan="2"')}${cell('', 'hMerge="1"')}${cell('Vertical', 'rowSpan="2"')}</a:tr><a:tr h="600000">${cell('A')}${cell('B')}${cell('', 'vMerge="1"')}</a:tr></a:tbl>`
  const ole = `<p:oleObj r:id="rOle" imgW="2000000" imgH="1000000" progId="Synthetic.Inert"><p:embed/>${picture(52, 5500000, 4000000, 2000000, 1000000)}</p:oleObj>`
  const objects = graphic(30, 'Native chart', 500000, 1300000, 4000000, 3500000, c, '<c:chart r:id="rChart"/>') + graphic(40, 'Merged table', 5500000, 1500000, 3000000, 1200000, a.replace('/main', '/table'), table) + graphic(50, 'OLE preview', 5500000, 4000000, 2000000, 1000000, p.replace('/main', '/ole'), ole)
  return [
    { id: 'dense', bytes: packageDeck(title + dense) },
    { id: 'groups', bytes: packageDeck(title + grouped + text(30, 'Grouped text', 500000, 5300000, 3000000, 600000, 'Same name, different ID')) },
    { id: 'typography', bytes: packageDeck(text(2, 'Title', 500000, 800000, 8000000, 1600000, '', paragraph(run('Bold red', 'b="1"', 'CF1F2F') + '<a:br/>' + run('Second line')) + paragraph(run('New paragraph', 'i="1"')))) },
    { id: 'artwork', bytes: packageDeck(title + pictures + line, { 'ppt/media/preview.png': image }, imageRel) },
    { id: 'layers', bytes: packageDeck(title + plate(10, 1000000, 2000000, 5000000, 3000000, 'CF1F2F') + plate(11, 3000000, 3000000, 5000000, 2000000, '2864B4')) },
    { id: 'objects', bytes: packageDeck(title + objects, { 'ppt/media/preview.png': image, 'ppt/charts/chart1.xml': chart, 'ppt/embeddings/inert.bin': Buffer.from('SYNTHETIC-OLE-DO-NOT-COPY') }, [...imageRel, ['rChart', 'chart', '../charts/chart1.xml'], ['rOle', 'oleObject', '../embeddings/inert.bin']], [['/ppt/charts/chart1.xml', 'drawingml.chart']]) },
  ]
}

// Capacity inputs use the same independent package writer, not the exporter.
export function capacityFixture({ blocks = 0, images = 0, depth = 0 } = {}) {
  const columns = Math.ceil(Math.sqrt(Math.max(1, blocks)))
  const cellW = Math.floor(9000000 / columns), cellH = Math.floor(5400000 / columns)
  let content = Array.from({ length: blocks }, (_, i) => text(10 + i, `Block ${i}`, 400000 + i % columns * cellW, 1100000 + Math.floor(i / columns) * cellH, cellW - 10000, cellH - 10000, `Block ${i}`)).join('')
  // Identity transforms isolate depth/traversal cost from geometric scaling.
  for (let level = 0; level < depth; level++) content = group(1000 + level, `Level ${level}`, [0, 0, page.width, page.height], [0, 0, page.width, page.height], content)
  content += Array.from({ length: images }, (_, i) => picture(2000 + i, 200000 + i % 16 * 580000, 1100000 + Math.floor(i / 16) * 500000, 400000, 200000)).join('')
  const png = new PNG({ width: 32, height: 16 }); png.data.fill(255)
  return packageDeck(title + content, images ? { 'ppt/media/preview.png': PNG.sync.write(png) } : {}, images ? [['rImage', 'image', '../media/preview.png']] : [])
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = resolve(process.argv[2] ?? '.test-output/pptx-fixtures')
  mkdirSync(out, { recursive: true })
  for (const fixture of fixtures()) writeFileSync(join(out, `${fixture.id}.pptx`), fixture.bytes)
  console.log(`Wrote synthetic PPTX fixtures to ${out}`)
}
