import { open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const MAX_BYTES = 32 * 1024 * 1024
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
function fail(message: string): never { throw new Error('dsh-ppt: requestFile: ' + message) }

/** Read a caller-selected local JSON request without passing its text through the model. */
export async function readCreateRequest(wrapper: Record<string, unknown>, cwd: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (Object.keys(wrapper).some(k => !['title','requestFile','requestSha256'].includes(k))) fail('cannot be combined with inline arguments other than the matching title')
  if (typeof wrapper.requestFile !== 'string' || !wrapper.requestFile.trim() || wrapper.requestFile.includes('\0')) fail('provide a local JSON file path')
  if (typeof wrapper.requestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(wrapper.requestSha256)) fail('provide the original file SHA-256 as requestSha256')
  const file = await open(resolve(cwd, wrapper.requestFile), 'r')
  let bytes: Buffer
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) fail('expected a regular file of 1–33554432 bytes')
    // Bounded read also detects growth/truncation after stat without allocating an unbounded file.
    const buffer = Buffer.alloc(stat.size + 1)
    let offset = 0
    while (offset < buffer.length) {
      signal?.throwIfAborted()
      const read = await file.read(buffer, offset, buffer.length - offset, null)
      if (!read.bytesRead) break
      offset += read.bytesRead
    }
    if (offset !== stat.size) fail('file changed while reading; use the original verified file')
    bytes = buffer.subarray(0, offset)
  } finally { await file.close() }
  signal?.throwIfAborted()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== wrapper.requestSha256) fail('file SHA-256 mismatch; do not replace its checksum')
  let input: unknown
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { fail('expected valid UTF-8 JSON') }
  if (!record(input)) fail('expected one JSON object')
  if (Object.hasOwn(input, 'requestFile') || Object.hasOwn(input, 'requestSha256')) fail('nested file requests are not allowed')
  if (typeof wrapper.title !== 'string' || input.title !== wrapper.title) fail('title must exactly match the title in the file')
  const hasTable = Object.hasOwn(input, 'tableSpec'), hasVisual = Object.hasOwn(input, 'visualSpec')
  if (hasTable === hasVisual) fail('file must contain exactly one tableSpec or visualSpec')
  const spec = hasTable ? input.tableSpec : input.visualSpec
  if (!record(spec) || typeof spec.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(spec.contentHash)) fail('the prepared spec must contain its original contentHash')
  return { input, receipt: { sha256, bytes: bytes.length } }
}
