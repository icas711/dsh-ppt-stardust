import {templateFromSceneManifest,buildTemplateBundle,readTemplateZip,templateCreateOptions} from '../skills/dsh-ppt/scripts/deck-templates.mjs'
import {fixtures as nativeFixtures} from '../test/fixtures/pptx/generate.mjs'
import {importPptxScenes} from '../skills/dsh-ppt/scripts/deck-pptx-scenes.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { sceneFixtures, legacyFixtureStates } from '../test/fixtures/pptx/scenes.mjs'
import {semanticSceneFixtures} from '../test/fixtures/pptx/semantic-scenes.mjs'
import { legacySlidesToScenes } from '../skills/dsh-ppt/scripts/deck-legacy.mjs'
import { buildPptx, renderHtml, resolveTheme, resolveLanguage } from '../skills/dsh-ppt/scripts/deck-core.mjs'
import { createFixtureConverter } from './golden-pptx-runtime.mjs'

export const sceneFixtureTheme = () => ({...resolveTheme('data'),palette:{...resolveTheme('data').palette,bg:'#FFFFFF',fg:'#202020'},fonts:{heading:'Liberation Sans',body:'Liberation Sans'}})
export async function goldenScenes(out = resolve('.test-output/pptx-synthetic-render/scenes')) {
  mkdirSync(out,{recursive:true})
  const {converter,version} = await createFixtureConverter()
  const run = {renderer:{backend:converter.backend,version},cases:[]}
  try {
    const cases = [...sceneFixtures(),...semanticSceneFixtures()]
    for (const f of nativeFixtures().filter(f => f.id !== 'objects')) {
      const imported = await importPptxScenes(f.bytes,{strict:true})
      const extracted=templateFromSceneManifest({...imported,style:{pageSize:imported.pageSize}},{templateId:'golden-'+f.id,name:'Imported fixture'})
      const bundle=readTemplateZip(buildTemplateBundle(extracted.manifest,extracted.assets))
      const selections=bundle.manifest.style.layouts.map((layout,i)=>({layoutId:layout.id,values:Object.fromEntries(layout.slots.map(slot=>{const e=imported.slides[i].elements.find(e=>e.id===slot.elementId);return [slot.id,e.type==='text'?e.paragraphs:e.type==='image'?e.assetId:e[e.type]]}))}))
      const {create}=templateCreateOptions(bundle.manifest,bundle.assets,{title:'Imported fixture',selections,assets:imported.assets})
      cases.push({id:'import-'+f.id,source:f.bytes,manifest:{...create,language:'en'}})
    }
    for (const legacy of legacyFixtureStates()) {
      const adapted = await legacySlidesToScenes(legacy.manifest,{theme:sceneFixtureTheme()})
      cases.push({id:legacy.id,source:buildPptx(legacy.manifest,sceneFixtureTheme(),resolveLanguage('en')),manifest:{...legacy.manifest,assets:adapted.assets,slides:adapted.slides},allowMatchingFontSubstitutions:true})
    }
    for (const fixture of cases) {
      const dir = join(out,fixture.id)
      mkdirSync(dir,{recursive:true})
      const actual = buildPptx(fixture.manifest,sceneFixtureTheme(),resolveLanguage('en'))
      writeFileSync(join(dir,'source.pptx'),fixture.source)
      writeFileSync(join(dir,'actual.pptx'),actual)
      writeFileSync(join(dir,'scene.json'),JSON.stringify(fixture.manifest,null,2))
      writeFileSync(join(dir,'actual.html'),renderHtml(fixture.manifest,sceneFixtureTheme(),resolveLanguage('en')))
      const missingFonts = {}
      for (const name of ['source','actual']) {
        const result = await converter.renderImages({inputPath:join(dir,name+'.pptx'),outputDir:join(dir,`${name}-render-${Date.now()}`),dpi:96,pages:'all',maxPages:1,maxDimension:2048})
        assert.equal(result.images.length,1)
        missingFonts[name] = result.missingFonts
        if (!fixture.allowMatchingFontSubstitutions) assert.deepEqual(result.missingFonts,[],`${fixture.id}/${name}: missing fonts`)
        copyFileSync(result.images[0].path,join(dir,name+'.png'))
      }
      assert.deepEqual(missingFonts.actual,missingFonts.source,`${fixture.id}: adapter must preserve font requirements`)
      run.cases.push({id:fixture.id,missingFonts,pageSize:fixture.manifest.style.pageSize,regions:fixture.manifest.slides[0].elements.filter(e=>e.type !== 'group' && e.frame.h > 0).map(e=>({id:e.id,...e.frame}))})
      console.log('Rendered scene fidelity: '+fixture.id)
    }
  } finally { await converter.dispose() }
  writeFileSync(join(out,'run.json'),JSON.stringify(run,null,2))
  execFileSync(process.env.DSH_PPT_GOLDEN_PYTHON ?? 'python',[fileURLToPath(new URL('./golden-pptx-scenes-metrics.py',import.meta.url)),out],{stdio:'inherit',timeout:120000})
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await goldenScenes()
