/**
 * Generates build/icon.ico: the letter S in the accent blue on the chrome grey,
 * at 16, 32, 48 and 256 px. Pure Node (zlib only) so no image library is pulled
 * in for one placeholder asset. Replace build/icon.ico with a real icon any time;
 * nothing else needs to change.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x25, 0x25, 0x26];
const FG = [0x56, 0x9c, 0xd6];

// A coarse 12x16 bitmap of "S". 1 = ink.
const GLYPH = [
  '............',
  '............',
  '...######...',
  '..########..',
  '.###....###.',
  '.###........',
  '..####......',
  '...#####....',
  '.....#####..',
  '.......####.',
  '........###.',
  '.###....###.',
  '..########..',
  '...######...',
  '............',
  '............',
];
const GW = GLYPH[0].length;
const GH = GLYPH.length;

function renderRGBA(size) {
  const px = Buffer.alloc(size * size * 4);
  // Glyph box: centred, 62% of the icon height.
  const scale = (size * 0.62) / GH;
  const gw = GW * scale;
  const gh = GH * scale;
  const ox = (size - gw) / 2;
  const oy = (size - gh) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      const gx = Math.floor((x - ox) / scale);
      const gy = Math.floor((y - oy) / scale);
      if (gx >= 0 && gx < GW && gy >= 0 && gy < GH && GLYPH[gy][gx] === '#') color = FG;
      const i = (y * size + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace

  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ICO container holding PNG-encoded images (supported since Windows Vista).
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);            // type 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir[o] = img.size >= 256 ? 0 : img.size;      // 0 means 256
    dir[o + 1] = img.size >= 256 ? 0 : img.size;
    dir[o + 2] = 0;                                // palette colours
    dir[o + 3] = 0;                                // reserved
    dir.writeUInt16LE(1, o + 4);                   // colour planes
    dir.writeUInt16LE(32, o + 6);                  // bits per pixel
    dir.writeUInt32LE(img.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.png.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.png)]);
}

const sizes = [16, 32, 48, 256];
const images = sizes.map((size) => ({ size, png: toPng(size, renderRGBA(size)) }));
const ico = toIco(images);

const out = path.join(__dirname, '..', 'build', 'icon.ico');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ico);

// A copy in public/ rides along into dist/, where the tray icon is loaded from.
const pub = path.join(__dirname, '..', 'public', 'icon.ico');
fs.mkdirSync(path.dirname(pub), { recursive: true });
fs.writeFileSync(pub, ico);

console.log('wrote ' + out + ' (' + ico.length + ' bytes, ' + sizes.join('/') + ')');
