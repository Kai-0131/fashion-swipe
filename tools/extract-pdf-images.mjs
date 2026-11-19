// Pulls the photos out of a PDF whose images are FlateDecode (raw pixels), writing PNG files.
// Usage: node tools/extract-pdf-images.mjs <pdf> <outDir>     (owner's PC only; output goes to private/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

export function pngFrom({ width, height, channels, idat }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 3 ? 2 : 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Raw rows -> PNG scanlines (filter byte 0 in front of every row), recompressed.
export function rawToIdat(raw, width, height, channels) {
  const stride = width * channels;
  const out = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) raw.copy(out, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return deflateSync(out);
}

export function findImages(buf) {
  const s = buf.toString('latin1');
  const objs = [];
  const smasks = new Set();
  const re = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const dict = m[2];
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    const num = (k) => Number((dict.match(new RegExp(`/${k}\\s+(\\d+)`)) || [])[1]);
    const len = num('Length');
    const start = m.index + m[0].length;
    const sm = dict.match(/\/SMask\s+(\d+) 0 R/);
    if (sm) smasks.add(Number(sm[1]));
    objs.push({
      id: Number(m[1]), width: num('Width'), height: num('Height'), bpc: num('BitsPerComponent'),
      gray: /\/ColorSpace\s*\/DeviceGray/.test(dict), flate: /\/FlateDecode/.test(dict),
      predictor: num('Predictor') || 1, start, len,
    });
  }
  return objs.filter((o) => !smasks.has(o.id));
}

function main([pdf, outDir]) {
  const buf = readFileSync(pdf);
  const out = resolve(outDir);
  if (!out.includes(`${resolve('private')}`)) throw new Error('outDir must be inside private/');
  mkdirSync(out, { recursive: true });
  const imgs = findImages(buf);
  let n = 0;
  for (const im of imgs) {
    if (!im.flate || im.bpc !== 8 || !im.len) { console.log(`skip obj ${im.id} (unsupported)`); continue; }
    const data = buf.subarray(im.start, im.start + im.len);
    const channels = im.gray ? 1 : 3;
    const idat = im.predictor >= 10 ? data : rawToIdat(inflateSync(data), im.width, im.height, channels);
    n++;
    writeFileSync(join(out, `photo-${String(n).padStart(3, '0')}.png`), pngFrom({ width: im.width, height: im.height, channels, idat }));
  }
  console.log(`wrote ${n} photos (of ${imgs.length} images)`);
}

if (process.argv[1]?.endsWith('extract-pdf-images.mjs')) main(process.argv.slice(2));
