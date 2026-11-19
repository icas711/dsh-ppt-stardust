import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { CallerIdentity } from './identity.js'
// @ts-ignore Shared bundled ESM typography helpers.
import { fontInfo, fontBytesFromUri, normalizeFontRefs } from '../skills/dsh-ppt/scripts/deck-fonts.mjs'

export interface LibraryFont {
  id: string; owner: string; family: string; variant: string; file: string
  data: string; size: number; warnings: string[]
}
const hash = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex')
export const fontKey = (face: { family: string; variant?: string }): string => face.family.toLowerCase() + ':' + (face.variant ?? 'regular')
export function templateFontFamilies(manifest: Record<string, any>): Set<string> {
  const style = manifest.style ?? {}, families = new Set<string>()
  const add = (name: unknown) => { if (typeof name === 'string' && name.trim() && !name.startsWith('+')) families.add(name.trim().toLowerCase()) }
  add(style.brand?.fontFamily)
  for (const face of style.fonts ?? []) add(face.family)
  for (const styles of [style.textStyles, ...(style.layouts ?? []).map((layout: any) => layout.textStyles)]) {
    for (const value of Object.values(styles ?? {}) as any[]) add(value.fontFamily)
  }
  for(const name of Object.values(style.themeFonts??{})) add(name)
  for(const layout of [...(style.layouts??[]),...(style.sceneLayouts??[])]) for(const e of layout.elements??[]) {
    const texts=[e,...(e.table?.cells??[])]
    for(const text of texts) {add(text.textStyle?.fontFamily);for(const p of text.paragraphs??[])for(const r of p.runs??[])add(r.style?.fontFamily)}
    for(const value of [e.chart?.titleStyle,e.chart?.categoryAxisLabelStyle,e.chart?.valueAxisLabelStyle,e.chart?.legend?.textStyle,e.chart?.dataLabels?.textStyle])add(value?.font)
  }
  return families
}

/** Only canonical, validated font data is persisted; browser-supplied paths are never read. */
export class PptFontLibrary {
  constructor(private root: string) {}
  private owner(identity: CallerIdentity): string {
    if (!identity.login) throw new Error('Личная библиотека шрифтов доступна только вошедшим пользователям')
    return identity.login
  }
  private dir(owner: string): string { return join(this.root, hash(owner)) }
  list(identity: CallerIdentity): LibraryFont[] {
    const owner = this.owner(identity), dir = this.dir(owner)
    if (!existsSync(dir)) return []
    return readdirSync(dir).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).map(name => {
      const entry = JSON.parse(readFileSync(join(dir, name), 'utf8')) as LibraryFont
      if (entry.owner !== owner || entry.id + '.json' !== name) throw new Error('Повреждена библиотека шрифтов')
      return entry
    })
  }
  prepare(input: { family: unknown; variant: unknown; data: unknown }, identity: CallerIdentity): LibraryFont {
    const owner = this.owner(identity)
    const face = normalizeFontRefs([{ family: input.family, variant: input.variant, file: 'upload.ttf' }])[0]
    const bytes = fontBytesFromUri(input.data), info = fontInfo(bytes)
    if (!['font/ttf', 'font/otf'].includes(info.mime)) throw new Error('Загрузите шрифт в формате TTF или OTF')
    const entry: LibraryFont = {
      id: hash(fontKey(face)), owner, family: face.family, variant: face.variant,
      file: 'font-' + hash(bytes).slice(0, 24) + (info.mime === 'font/otf' ? '.otf' : '.ttf'),
      data: input.data as string, size: bytes.length,
      warnings: info.fsType ? [`Шрифт «${face.family}»: ограничения встраивания fsType=0x${info.fsType.toString(16)}.`] : [],
    }
    const next = [...this.list(identity).filter(font => font.id !== entry.id), entry]
    if (next.length > 64 || next.reduce((sum, font) => sum + font.size, 0) > 32 * 1024 * 1024) throw new Error('Личная библиотека: не больше 64 начертаний и 32 MiB')
    return entry
  }
  put(entry: LibraryFont): void {
    const dir = this.dir(entry.owner)
    mkdirSync(dir, { recursive: true })
    const path = join(dir, entry.id + '.json'), temp = path + '.' + randomUUID() + '.tmp'
    try { writeFileSync(temp, JSON.stringify(entry)); renameSync(temp, path) }
    finally { rmSync(temp, { force: true }) }
  }
  adminList(identity: CallerIdentity): Omit<LibraryFont, 'data'>[] {
    if (!identity.admin) throw new Error('Управлять библиотеками шрифтов может только администратор')
    if (!existsSync(this.root)) return []
    return readdirSync(this.root).filter(name => /^[a-f0-9]{64}$/.test(name)).flatMap(name => {
      const dir = join(this.root, name)
      return readdirSync(dir).filter(file => /^[a-f0-9]{64}\.json$/.test(file)).map(file => {
        const { data, ...entry } = JSON.parse(readFileSync(join(dir, file), 'utf8')) as LibraryFont
        return entry
      })
    }).sort((a, b) => a.owner.localeCompare(b.owner) || a.family.localeCompare(b.family) || a.variant.localeCompare(b.variant))
  }
  delete(owner: unknown, id: unknown, identity: CallerIdentity): void {
    if (!identity.admin) throw new Error('Удалять шрифты из библиотек может только администратор')
    if (typeof owner !== 'string' || !owner || typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new Error('Недопустимый шрифт')
    rmSync(join(this.dir(owner), id + '.json'), { force: true })
  }
}
