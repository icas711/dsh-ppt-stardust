// Reusable content slots of imported slides. The same distribution is used by
// HTML and native PPTX so column variants do not collapse into a single box.
export function zoneContents(slide, layout) {
  if (!layout?.familyId || !layout.textZones?.length) return undefined
  const zones = layout.textZones
  const bodyCount = zones.filter(z => z.kind === 'body').length
  const body = Array.isArray(slide.bullets) && slide.bullets.length ? slide.bullets : [slide.subtitle || slide.text || ''].filter(Boolean)
  const perZone = Math.max(1, Math.ceil(body.length / Math.max(1, bodyCount)))
  let bodyIndex = 0, titleIndex = 0, imageIndex = 0
  return zones.map(zone => {
    if (zone.kind === 'title') return { zone, role: 'title', lines: titleIndex++ === 0 ? [slide.title || ''] : [] }
    if (zone.kind === 'image') return { zone, role: 'image', filled: Boolean(slide.image) && imageIndex++ === 0, lines: ['Заполнить: изображение'] }
    const lines = body.slice(bodyIndex * perZone, ++bodyIndex * perZone)
    return { zone, role: slide.layout === 'cover' || slide.layout === 'closing' ? 'subtitle' : 'body', lines }
  })
}
