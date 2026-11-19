// Physical slide dimensions in EMU. Absent in legacy templates: use the screen default.
export const DEFAULT_PAGE = { width: 12192000, height: 6858000 }
export function normalizePageSize(value) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || !['width', 'height'].every(key => Number.isSafeInteger(value[key]) && value[key] > 0 && value[key] <= 51206400)) {
    throw new Error('style.pageSize: width и height должны быть положительными целыми EMU (не более 56 дюймов)')
  }
  return { width: value.width, height: value.height }
}
export function pageSize(manifest) { return normalizePageSize(manifest.style?.pageSize) ?? DEFAULT_PAGE }

// Generated content starts in the default coordinate system. Layout artwork is added
// later directly in the physical page coordinates, preserving its original proportions.
export function resizeSlideXml(xml, size) {
  const sx = size.width / DEFAULT_PAGE.width, sy = size.height / DEFAULT_PAGE.height
  if (sx === 1 && sy === 1) return xml
  return xml.replace(/<(a:off|a:ext|p:off|p:ext) (x|cx)="(-?\d+)" (y|cy)="(-?\d+)"\s*\/>/g,
    (_, tag, x, a, y, b) => `<${tag} ${x}="${Math.round(Number(a) * sx)}" ${y}="${Math.round(Number(b) * sy)}"/>`)
    .replace(/<a:gridCol w="(\d+)"\/>/g, (_, w) => `<a:gridCol w="${Math.round(Number(w) * sx)}"/>`)
    .replace(/<a:tr h="(\d+)"/g, (_, h) => `<a:tr h="${Math.round(Number(h) * sy)}"`)
}

// 页面类型 → 模板背景类型；deck-advanced 的样式规范化复用同一映射。
export const TEMPLATE_BACKGROUND_TYPES = ['cover', 'section', 'content', 'closing']
const BG_LAYOUT_MAP = { cover: 'cover', section: 'section', closing: 'closing', bullets: 'content', statement: 'content', quote: 'content', table: 'content', image: 'content', 'image-left': 'content', 'image-right': 'content', chart: 'content' }
export function backgroundTypeOfLayout(layout) { return BG_LAYOUT_MAP[layout] ?? 'content' }
