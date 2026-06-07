#!/usr/bin/env node
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf, s, e) {
  let c = 0xFFFFFFFF;
  for (let i = s; i < e; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG Encoder ───────────────────────────────────────────────────────────
function pngEncode(w, h, rgba) {
  const stride = w * 4;
  const rows = new Uint8Array(h * (1 + stride));
  for (let y = 0; y < h; y++) {
    rows[y * (1 + stride)] = 0;
    rows.set(rgba.subarray(y * stride, (y + 1) * stride), y * (1 + stride) + 1);
  }
  const compressed = zlib.deflateSync(Buffer.from(rows));

  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const d = data || Buffer.alloc(0);
    const lenB = Buffer.allocUnsafe(4); lenB.writeUInt32BE(d.length, 0);
    const body = Buffer.concat([typeB, d]);
    const crcBuf = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc32(body, 0, body.length), 0);
    return Buffer.concat([lenB, body, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND'),
  ]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────
function setPixel(buf, W, H, x, y, r, g, b, a) {
  x = x | 0; y = y | 0;
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  const fa = a / 255, ba = buf[i + 3] / 255;
  const oa = fa + ba * (1 - fa);
  if (oa <= 0) return;
  buf[i]     = ((r * fa + buf[i]     * ba * (1 - fa)) / oa + 0.5) | 0;
  buf[i + 1] = ((g * fa + buf[i + 1] * ba * (1 - fa)) / oa + 0.5) | 0;
  buf[i + 2] = ((b * fa + buf[i + 2] * ba * (1 - fa)) / oa + 0.5) | 0;
  buf[i + 3] = (oa * 255 + 0.5) | 0;
}

function fillAll(buf, r, g, b, a = 255) {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  }
}

function fillRoundedRect(buf, W, H, rx, ry, rw, rh, cr, r, g, b, a = 255) {
  for (let py = Math.max(0, ry | 0); py < Math.min(H, (ry + rh) | 0); py++) {
    for (let px = Math.max(0, rx | 0); px < Math.min(W, (rx + rw) | 0); px++) {
      const lx = px - rx, ly = py - ry;
      let alpha = a, dist = -1;

      if      (lx < cr && ly < cr)          dist = Math.hypot(lx - cr, ly - cr);
      else if (lx >= rw - cr && ly < cr)    dist = Math.hypot(lx - (rw - cr), ly - cr);
      else if (lx < cr && ly >= rh - cr)    dist = Math.hypot(lx - cr, ly - (rh - cr));
      else if (lx >= rw - cr && ly >= rh - cr) dist = Math.hypot(lx - (rw - cr), ly - (rh - cr));

      if (dist >= 0) {
        if (dist > cr + 0.5) continue;
        if (dist > cr - 0.5) alpha = ((cr + 0.5 - dist) * a) | 0;
      }
      setPixel(buf, W, H, px, py, r, g, b, alpha);
    }
  }
}

function fillCircle(buf, W, H, cx, cy, radius, r, g, b, a = 255) {
  const minX = Math.max(0, (cx - radius - 1) | 0);
  const maxX = Math.min(W - 1, (cx + radius + 1) | 0);
  const minY = Math.max(0, (cy - radius - 1) | 0);
  const maxY = Math.min(H - 1, (cy + radius + 1) | 0);
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const d = Math.hypot(px - cx, py - cy);
      if (d < radius - 0.5)      setPixel(buf, W, H, px, py, r, g, b, a);
      else if (d < radius + 0.5) setPixel(buf, W, H, px, py, r, g, b, ((radius + 0.5 - d) * a) | 0);
    }
  }
}

function drawThickLine(buf, W, H, x1, y1, x2, y2, t, r, g, b, a = 255) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return;
  const minX = Math.max(0, (Math.min(x1, x2) - t - 1) | 0);
  const maxX = Math.min(W - 1, (Math.max(x1, x2) + t + 1) | 0);
  const minY = Math.max(0, (Math.min(y1, y2) - t - 1) | 0);
  const maxY = Math.min(H - 1, (Math.max(y1, y2) + t + 1) | 0);
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const s = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      const nearX = x1 + s * dx, nearY = y1 + s * dy;
      const d = Math.hypot(px - nearX, py - nearY);
      if (d < t - 0.5)      setPixel(buf, W, H, px, py, r, g, b, a);
      else if (d < t + 0.5) setPixel(buf, W, H, px, py, r, g, b, ((t + 0.5 - d) * a) | 0);
    }
  }
}

// ── Logo 512×512 ──────────────────────────────────────────────────────────
function generateLogo() {
  const S = 512;
  const buf = new Uint8Array(S * S * 4);

  // Dark background
  fillAll(buf, 10, 11, 15);

  // Subtle radial teal glow before the card layer
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const d = Math.hypot(px - 256, py - 256);
      const maxD = 215;
      if (d < maxD) {
        const intensity = (Math.pow(1 - d / maxD, 2) * 18) | 0;
        setPixel(buf, S, S, px, py, 0, 229, 192, intensity);
      }
    }
  }

  // Card — 2-pixel border then fill
  fillRoundedRect(buf, S, S, 24, 24, 464, 464, 52, 31, 34, 45);  // #1f2233 border
  fillRoundedRect(buf, S, S, 26, 26, 460, 460, 50, 19, 21, 29);  // #13151d card

  // W letterform in #00e5c0
  // Stroke center path: A(86,110) → B(180,400) → C(256,220) → D(332,400) → E(426,110)
  const [wr, wg, wb] = [0, 229, 192];
  const wt = 34;

  drawThickLine(buf, S, S,  86, 110, 180, 400, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 180, 400, 256, 220, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 256, 220, 332, 400, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 332, 400, 426, 110, wt, wr, wg, wb);

  fillCircle(buf, S, S, 180, 400, wt, wr, wg, wb);
  fillCircle(buf, S, S, 256, 220, wt, wr, wg, wb);
  fillCircle(buf, S, S, 332, 400, wt, wr, wg, wb);

  return pngEncode(S, S, buf);
}

// ── Favicon 32×32 ────────────────────────────────────────────────────────
function generateFavicon() {
  const S = 32;
  const buf = new Uint8Array(S * S * 4);

  fillAll(buf, 10, 11, 15);

  // Subtle teal glow
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const d = Math.hypot(px - 16, py - 16);
      if (d < 16) {
        const intensity = (Math.pow(1 - d / 16, 2) * 22) | 0;
        setPixel(buf, S, S, px, py, 0, 229, 192, intensity);
      }
    }
  }

  // W at 32×32: A(5,4) B(11,28) C(16,13) D(21,28) E(27,4)
  const [wr, wg, wb] = [0, 229, 192];
  const wt = 2.3;

  drawThickLine(buf, S, S,  5,  4, 11, 28, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 11, 28, 16, 13, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 16, 13, 21, 28, wt, wr, wg, wb);
  drawThickLine(buf, S, S, 21, 28, 27,  4, wt, wr, wg, wb);

  fillCircle(buf, S, S, 11, 28, wt, wr, wg, wb);
  fillCircle(buf, S, S, 16, 13, wt, wr, wg, wb);
  fillCircle(buf, S, S, 21, 28, wt, wr, wg, wb);

  return pngEncode(S, S, buf);
}

// ── Run ───────────────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(path.join(publicDir, 'logo.png'), generateLogo());
console.log('generated logo.png (512x512)');

fs.writeFileSync(path.join(publicDir, 'favicon.png'), generateFavicon());
console.log('generated favicon.png (32x32)');
