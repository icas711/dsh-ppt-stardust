// Shared bounded raster validation for embedded images.
import { inflateSync } from 'node:zlib'
const fail = message => { throw new Error('dsh-ppt：'+message) }

export function imageInfo(bytes, page) {
  let width, height, mime
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 45 || bytes.toString('ascii', 12, 16) !== 'IHDR') fail(`${page} PNG 文件不完整`)
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20); mime = 'image/png'
    let offset = 8, ended = false; const compressed = []
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
      if (offset + length + 12 > bytes.length) fail(`${page} PNG 数据截断`)
      if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length))
      if (type === 'IEND') { ended = true; break }
      offset += length + 12
    }
    if (!ended || compressed.length === 0) fail(`${page} PNG 缺少图像数据`)
    try { inflateSync(Buffer.concat(compressed), { maxOutputLength: 128 * 1024 * 1024 }) } catch { fail(`${page} PNG 图像数据无法解码或过大`) }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg'
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) fail(`${page} JPEG 数据截断`)
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) { height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5) }
      offset += length
    }
    if (!bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) fail(`${page} JPEG 文件不完整`)
  } else fail(`${page} 图片仅支持 PNG / JPEG，请先转换格式`)
  if (!width || !height || width > 16000 || height > 16000 || width * height > 32_000_000) fail(`${page} 图片尺寸无效或超过 3200 万像素`)
  return { width, height, mime }
}
