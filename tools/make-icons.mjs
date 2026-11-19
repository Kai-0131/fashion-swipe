// Draws the app icons (two stacked cards on denim) as PNG without dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) row.set(pixel(x / size, y / size), 1 + x * 4);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const inRound = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r); const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const BG = [0x3b, 0x58, 0x84, 255]; const BACK = [0xe3, 0xe9, 0xf2, 255]; const FRONT = [255, 255, 255, 255]; const DOT = [0xa2, 0x40, 0x2f, 255];

const pixel = (x, y) => {
  const rx = (x - 0.5) * Math.cos(0.12) - (y - 0.5) * Math.sin(0.12) + 0.5;
  const ry = (x - 0.5) * Math.sin(0.12) + (y - 0.5) * Math.cos(0.12) + 0.5;
  if ((x - 0.56) ** 2 + (y - 0.66) ** 2 < 0.0049) return DOT;
  if (inRound(x, y, 0.3, 0.24, 0.7, 0.78, 0.05)) return FRONT;
  if (inRound(rx, ry, 0.3, 0.2, 0.7, 0.74, 0.05)) return BACK;
  return BG;
};

for (const size of [192, 512]) writeFileSync(`docs/icon-${size}.png`, png(size, pixel));
console.log('icons written');
