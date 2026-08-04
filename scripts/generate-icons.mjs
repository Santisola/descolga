/**
 * Renders the manifest PNG icons from the same shapes as public/icon.svg.
 *
 * Android needs real PNGs for a reliable install prompt, and this box has no
 * rasterizer (no rsvg/ImageMagick/sharp), so the drawing is done by hand and
 * encoded with node:zlib. Re-run with `node scripts/generate-icons.mjs` after
 * changing the mark.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const GROUND = [0x16, 0x18, 0x26]
const RING = [0x5d, 0x52, 0x94]
const ACCENT = [0x91, 0x84, 0xd9]

const SAMPLES = 3 // 3x3 supersampling is enough at these sizes

/** Distance from the centre of a rounded rectangle's inner region. */
function insideRoundedRect(x, y, size, radius) {
  const min = radius
  const max = size - radius
  const cx = x < min ? min : x > max ? max : x
  const cy = y < min ? min : y > max ? max : y
  if (cx === x && cy === y) return true
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function blend(base, layer, alpha) {
  return [
    Math.round(base[0] + (layer[0] - base[0]) * alpha),
    Math.round(base[1] + (layer[1] - base[1]) * alpha),
    Math.round(base[2] + (layer[2] - base[2]) * alpha),
  ]
}

/**
 * @param {number} size    output pixel size
 * @param {boolean} maskable  full-bleed background with the mark inside the
 *                            80% safe zone, per the maskable icon spec
 */
function render(size, maskable) {
  const scale = size / 512
  const cornerRadius = maskable ? 0 : 112 * scale
  const markScale = maskable ? 0.72 : 1
  const centre = size / 2

  const glowR = 186 * scale * markScale
  const ringR = 150 * scale * markScale
  const ringHalf = 5 * scale * markScale
  const dotR = 66 * scale * markScale

  const raw = Buffer.alloc(size * (size * 3 + 1))
  let cursor = 0

  for (let y = 0; y < size; y += 1) {
    raw[cursor] = 0 // PNG filter type: none
    cursor += 1
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let covered = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) / SAMPLES
          const py = y + (sy + 0.5) / SAMPLES

          if (cornerRadius > 0 && !insideRoundedRect(px, py, size, cornerRadius)) {
            // Outside the squircle: transparent, so skip without accumulating.
            continue
          }

          const distance = Math.hypot(px - centre, py - centre)
          let colour = GROUND

          if (distance < glowR) {
            colour = blend(colour, ACCENT, 0.55 * (1 - distance / glowR))
          }
          if (Math.abs(distance - ringR) <= ringHalf) {
            colour = RING
          }
          if (distance <= dotR) {
            colour = ACCENT
          }

          r += colour[0]
          g += colour[1]
          b += colour[2]
          covered += 1
        }
      }

      const total = SAMPLES * SAMPLES
      if (covered === 0) {
        // Fully outside the squircle. PNG here is opaque RGB, so paint the
        // ground colour rather than leaving a black hole.
        raw[cursor] = GROUND[0]
        raw[cursor + 1] = GROUND[1]
        raw[cursor + 2] = GROUND[2]
      } else {
        // Partially covered edges blend toward the ground colour.
        const missing = total - covered
        raw[cursor] = Math.round((r + GROUND[0] * missing) / total)
        raw[cursor + 1] = Math.round((g + GROUND[1] * missing) / total)
        raw[cursor + 2] = Math.round((b + GROUND[2] * missing) / total)
      }
      cursor += 3
    }
  }

  return encodePng(size, size, raw)
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, raw) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour type: truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]

for (const [name, size, maskable] of targets) {
  const png = render(size, maskable)
  writeFileSync(join(PUBLIC_DIR, name), png)
  console.log(`${name} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`)
}
