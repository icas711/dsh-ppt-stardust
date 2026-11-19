// Pure affine geometry in EMU. [a,b,c,d,e,f] maps (x,y) to
// (a*x+c*y+e,b*x+d*y+f). Screen coordinates grow right and down.
export const IDENTITY_TRANSFORM = Object.freeze([1, 0, 0, 1, 0, 0])

function finite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid geometry: ${field} must be finite`)
  return value
}
function matrix(value) {
  if (!Array.isArray(value) || value.length !== 6) throw new Error('Invalid geometry: transform needs six numbers')
  value.forEach((number, index) => finite(number, `transform[${index}]`))
  return value
}
function frame(value, field, allowZero = false) {
  if (!value || typeof value !== 'object') throw new Error(`Invalid geometry: ${field} needs a frame`)
  for (const key of ['x', 'y', 'w', 'h']) finite(value[key], `${field}.${key}`)
  if (allowZero ? value.w < 0 || value.h < 0 : value.w <= 0 || value.h <= 0) throw new Error(`Invalid geometry: ${field} dimensions must be ${allowZero ? 'nonnegative' : 'positive'}`)
  return value
}

// Apply inner first, then outer; compose once when flattening nested groups.
export function composeTransforms(outer, inner) {
  const [a, b, c, d, e, f] = matrix(outer), [g, h, i, j, k, l] = matrix(inner)
  return matrix([a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f])
}

export function transformPoint(point, transform = IDENTITY_TRANSFORM) {
  finite(point?.x, 'point.x'); finite(point?.y, 'point.y')
  const [a, b, c, d, e, f] = matrix(transform)
  return { x: finite(a*point.x+c*point.y+e, 'result.x'), y: finite(b*point.x+d*point.y+f, 'result.y') }
}

export function transformedBounds(value, transform = IDENTITY_TRANSFORM) {
  const { x, y, w, h } = frame(value, 'frame', true)
  const points = [[x,y], [x+w,y], [x+w,y+h], [x,y+h]].map(([x,y]) => transformPoint({x,y}, transform))
  const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y))
  return { x: left, y: top, w: finite(Math.max(...points.map(p => p.x))-left, 'bounds.w'), h: finite(Math.max(...points.map(p => p.y))-top, 'bounds.h') }
}

// Rotation is clockwise degrees around the outer frame's centre; reflection
// precedes rotation. No rounding/clamping: callers round only at serialization.
export function frameTransform(value, { rotation = 0, flipH = false, flipV = false } = {}) {
  const { x, y, w, h } = frame(value, 'frame', true)
  finite(rotation, 'rotation')
  if (typeof flipH !== 'boolean' || typeof flipV !== 'boolean') throw new Error('Invalid geometry: reflections must be boolean')
  const angle = (rotation % 360) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  const sx = flipH ? -1 : 1, sy = flipV ? -1 : 1
  const a = cos*sx, b = sin*sx, c = -sin*sy, d = cos*sy, cx = x+w/2, cy = y+h/2
  return matrix([a,b,c,d,cx-a*cx-c*cy,cy-b*cx-d*cy])
}

export function groupTransform({ outer, inner, rotation = 0, flipH = false, flipV = false }) {
  frame(outer, 'outer', true); frame(inner, 'inner')
  const sx = outer.w / inner.w, sy = outer.h / inner.h
  const placement = matrix([sx,0,0,sy,outer.x-inner.x*sx,outer.y-inner.y*sy])
  return composeTransforms(frameTransform(outer, { rotation, flipH, flipV }), placement)
}
