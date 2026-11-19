// In-memory preparation of the legacy project envelope. This deliberately does
// not convert content to scene or opt files into a future schema version.
export const PROJECT_SCHEMA_VERSION = 1
export const MAX_PROJECT_HISTORY = 20

function projectError(code, path, message) {
  const error = new Error('dsh-ppt：' + message)
  error.code = code; error.path = path
  throw error
}
function schema(value, path) {
  if (value !== undefined && value !== PROJECT_SCHEMA_VERSION) projectError('unsupported-project-schema', path, '未知工程 schemaVersion，请升级插件后再修改')
}
export function nextProjectRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) projectError('invalid-revision', 'revision', '工程 revision 无效或已达到安全上限')
  return value + 1
}
function slideIds(slides, path) {
  if (!Array.isArray(slides) || !slides.length || slides.length > 120) projectError('invalid-project-slides', path, '工程页数需为 1–120')
  const used = new Set()
  slides.forEach((slide, index) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) projectError('invalid-project-slide', `${path}[${index}]`, '工程页面必须是对象')
    if (slide.id === undefined || slide.id === null || slide.id === '') return
    if (typeof slide.id !== 'string') projectError('invalid-slide-id', `${path}[${index}].id`, '工程页面 ID 必须为字符串')
    if (used.has(slide.id)) projectError('duplicate-slide-id', `${path}[${index}].id`, '工程含有重复页面 ID')
    used.add(slide.id)
  })
  slides.forEach((slide, index) => {
    if (slide.id) return
    const base = `legacy-slide-${index+1}`
    let id = base, suffix = 1
    while (used.has(id)) id = `${base}-${suffix++}`
    slide.id = id
    used.add(id)
  })
}

export function normalizeLegacyProjectEnvelope(input, {fingerprint} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.title !== 'string' || !Array.isArray(input.slides) || !input.slides.length) projectError('invalid-project', 'project', '这不是有效的 dsh-ppt JSON 工程')
  schema(input.schemaVersion, 'schemaVersion')
  const document = structuredClone(input)
  if (document.deckId === undefined || document.deckId === null || document.deckId === '') {
    if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) projectError('missing-source-fingerprint', 'deckId', '旧工程缺少 ID：需要源文件 fingerprint，不能生成随机身份')
    document.deckId = 'legacy-' + fingerprint.slice(0,32)
  }
  if (typeof document.deckId !== 'string') projectError('invalid-deck-id', 'deckId', '工程 deckId 必须为字符串')
  document.revision ??= 0
  if (!Number.isSafeInteger(document.revision) || document.revision < 0) projectError('invalid-revision', 'revision', '工程 revision 无效')
  document.assets ??= {}; document.history ??= []
  if (typeof document.assets !== 'object' || Array.isArray(document.assets)) projectError('invalid-project-assets', 'assets', '工程图片资产无效')
  if (!Array.isArray(document.history) || document.history.length > MAX_PROJECT_HISTORY) projectError('invalid-project-history', 'history', '工程历史无效')
  slideIds(document.slides, 'slides')
  document.history.forEach((state, index) => {
    const path = `history[${index}]`
    if (!state || typeof state !== 'object' || Array.isArray(state)) projectError('invalid-project-history', path, '工程历史无效')
    schema(state.schemaVersion, `${path}.schemaVersion`)
    slideIds(state.slides, `${path}.slides`)
  })
  return document
}
