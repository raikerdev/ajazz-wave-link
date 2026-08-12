/**
 * Draws the plugin's PNG icons from scratch — no image dependencies.
 *
 * Shapes are defined as coverage functions over a unit square and rasterised
 * with 4x4 supersampling, which is what gives the edges their antialiasing.
 * Run with: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Minimal PNG writer (RGBA, 8 bit, no interlacing)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, pixels) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type: RGBA
    const rowLen = size * 4;
    const raw = Buffer.alloc((rowLen + 1) * size);
    for (let y = 0; y < size; y++) {
        const rowStart = y * (rowLen + 1);
        raw[rowStart] = 0; // filter: none
        pixels.copy(raw, rowStart + 1, y * rowLen, (y + 1) * rowLen);
    }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

// ---------------------------------------------------------------------------
// Geometry helpers, all in a unit square where (0,0) is the top-left corner
// ---------------------------------------------------------------------------

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

/** Distance from a point to a line segment — the basis for every rounded stroke. */
function segmentDist(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

const circle = (x, y, cx, cy, r) => dist(x, y, cx, cy) <= r;
const ring = (x, y, cx, cy, r, halfWidth) => Math.abs(dist(x, y, cx, cy) - r) <= halfWidth;
const capsule = (x, y, x1, y1, x2, y2, halfWidth) => segmentDist(x, y, x1, y1, x2, y2) <= halfWidth;

/** Inside when the point is within `radius` of the rect shrunk by `radius` on every side. */
function roundedRect(x, y, left, top, right, bottom, radius) {
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    return dist(x, y, cx, cy) <= radius;
}

/** A speaker cone: a rectangular waveguide plus the trapezoid that flares out of it. */
function speaker(x, y) {
    if (x >= 0.20 && x <= 0.36 && Math.abs(y - 0.5) <= 0.12) return true;
    if (x >= 0.36 && x <= 0.58) {
        const flare = 0.12 + ((x - 0.36) / 0.22) * 0.18;
        return Math.abs(y - 0.5) <= flare;
    }
    return false;
}

/** One of the arcs radiating from the speaker, clipped to the cone's right side. */
function soundWave(x, y, radius) {
    return x > 0.60 && ring(x, y, 0.52, 0.5, radius, 0.035);
}

// ---------------------------------------------------------------------------
// Rasteriser
// ---------------------------------------------------------------------------

const WHITE = [255, 255, 255];
const TEAL = [45, 190, 185];
const RED = [226, 78, 78];
const SLATE = [88, 106, 220];
const DARK = [38, 40, 46];

/** Standard source-over compositing, with both colours premultiplied on the fly. */
function over(dst, src, srcAlpha) {
    const outAlpha = srcAlpha + dst[3] * (1 - srcAlpha);
    if (outAlpha === 0) return [0, 0, 0, 0];
    return [
        (src[0] * srcAlpha + dst[0] * dst[3] * (1 - srcAlpha)) / outAlpha,
        (src[1] * srcAlpha + dst[1] * dst[3] * (1 - srcAlpha)) / outAlpha,
        (src[2] * srcAlpha + dst[2] * dst[3] * (1 - srcAlpha)) / outAlpha,
        outAlpha
    ];
}

/**
 * `layers` is an ordered list of `[colour, coverageFn]`, painted back to front.
 * A coverage function returns true when the point is inside that layer's shape.
 */
function render(size, layers, samples = 4) {
    const pixels = Buffer.alloc(size * size * 4);
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let r = 0, g = 0, b = 0, a = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const x = (px + (sx + 0.5) / samples) / size;
                    const y = (py + (sy + 0.5) / samples) / size;
                    let sample = [0, 0, 0, 0];
                    for (const [colour, inside, alpha = 1] of layers) {
                        if (inside(x, y)) sample = over(sample, colour, alpha);
                    }
                    r += sample[0] * sample[3];
                    g += sample[1] * sample[3];
                    b += sample[2] * sample[3];
                    a += sample[3];
                }
            }
            const total = samples * samples;
            const offset = (py * size + px) * 4;
            // Un-premultiply back to straight alpha for the PNG.
            pixels[offset] = a ? r / a : 0;
            pixels[offset + 1] = a ? g / a : 0;
            pixels[offset + 2] = a ? b / a : 0;
            pixels[offset + 3] = (a / total) * 255;
        }
    }
    return pixels;
}

// ---------------------------------------------------------------------------
// The icons
// ---------------------------------------------------------------------------

/**
 * Backing plate for the action icons. Without it a white glyph on transparent
 * disappears against the light backgrounds of the app's own action list, even
 * though it reads fine on the black key face of the device.
 */
const PLATE = [DARK, (x, y) => roundedRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.20)];

/** A dial: outer ring, pointer at twelve o'clock, hub in the middle. */
const KNOB = [
    PLATE,
    [TEAL, (x, y) => ring(x, y, 0.5, 0.5, 0.30, 0.06)],
    [WHITE, (x, y) => capsule(x, y, 0.5, 0.22, 0.5, 0.40, 0.042)],
    [WHITE, (x, y) => circle(x, y, 0.5, 0.5, 0.09)]
];

/** Unmuted: speaker plus two sound waves. */
const MUTE = [
    PLATE,
    [WHITE, speaker],
    [WHITE, (x, y) => soundWave(x, y, 0.17)],
    [WHITE, (x, y) => soundWave(x, y, 0.27)]
];

/** Muted: the same speaker in red, crossed out. */
const MUTE_ACTIVE = [
    PLATE,
    [RED, speaker],
    [RED, (x, y) => capsule(x, y, 0.66, 0.36, 0.86, 0.64, 0.045)],
    [RED, (x, y) => capsule(x, y, 0.86, 0.36, 0.66, 0.64, 0.045)]
];

/** Audio effect: a waveform passing through, the middle band lifted. */
const AUDIO_EFFECT = [
    PLATE,
    [TEAL, (x, y) => roundedRect(x, y, 0.20, 0.44, 0.28, 0.56, 0.04)],
    [TEAL, (x, y) => roundedRect(x, y, 0.32, 0.34, 0.40, 0.66, 0.04)],
    [WHITE, (x, y) => roundedRect(x, y, 0.44, 0.18, 0.52, 0.82, 0.04)],
    [TEAL, (x, y) => roundedRect(x, y, 0.56, 0.30, 0.64, 0.70, 0.04)],
    [TEAL, (x, y) => roundedRect(x, y, 0.68, 0.44, 0.76, 0.56, 0.04)]
];

/** Volume from a key: a chevron up over a chevron down. */
const VOLUME_BUTTON = [
    PLATE,
    [TEAL, (x, y) => capsule(x, y, 0.30, 0.44, 0.50, 0.24, 0.042)],
    [TEAL, (x, y) => capsule(x, y, 0.50, 0.24, 0.70, 0.44, 0.042)],
    [WHITE, (x, y) => capsule(x, y, 0.30, 0.56, 0.50, 0.76, 0.042)],
    [WHITE, (x, y) => capsule(x, y, 0.50, 0.76, 0.70, 0.56, 0.042)]
];

/** Routing: two arrows swapping direction, for sending an output to another mix. */
const OUTPUT_MIX = [
    PLATE,
    // Upper arrow, pointing right.
    [TEAL, (x, y) => capsule(x, y, 0.22, 0.38, 0.74, 0.38, 0.038)],
    [TEAL, (x, y) => capsule(x, y, 0.66, 0.30, 0.76, 0.38, 0.038)],
    [TEAL, (x, y) => capsule(x, y, 0.66, 0.46, 0.76, 0.38, 0.038)],
    // Lower arrow, pointing left.
    [WHITE, (x, y) => capsule(x, y, 0.26, 0.62, 0.78, 0.62, 0.038)],
    [WHITE, (x, y) => capsule(x, y, 0.34, 0.54, 0.24, 0.62, 0.038)],
    [WHITE, (x, y) => capsule(x, y, 0.34, 0.70, 0.24, 0.62, 0.038)]
];

/** Plugin and category badge: a mixer with three faders at different levels. */
const BADGE = [
    [SLATE, (x, y) => roundedRect(x, y, 0.06, 0.06, 0.94, 0.94, 0.22)],
    [WHITE, (x, y) => capsule(x, y, 0.30, 0.24, 0.30, 0.76, 0.035), 0.45],
    [WHITE, (x, y) => capsule(x, y, 0.50, 0.24, 0.50, 0.76, 0.035), 0.45],
    [WHITE, (x, y) => capsule(x, y, 0.70, 0.24, 0.70, 0.76, 0.035), 0.45],
    [WHITE, (x, y) => roundedRect(x, y, 0.22, 0.56, 0.38, 0.66, 0.05)],
    [WHITE, (x, y) => roundedRect(x, y, 0.42, 0.32, 0.58, 0.42, 0.05)],
    [WHITE, (x, y) => roundedRect(x, y, 0.62, 0.46, 0.78, 0.56, 0.05)]
];

const outDir = 'com.raikerdev.wave_link.sdPlugin/static';
mkdirSync(outDir, { recursive: true });

// Sizes follow the StreamDock manifest docs: 128 for the plugin icon, 48 for the
// category icon, 72 for action icons and key faces, each with a @2x companion.
const ICONS = [
    ['plugin', 128, BADGE],
    ['category', 48, BADGE],
    ['knob', 72, KNOB],
    ['mute', 72, MUTE],
    ['mute-active', 72, MUTE_ACTIVE],
    ['outputmix', 72, OUTPUT_MIX],
    ['volumebutton', 72, VOLUME_BUTTON],
    ['audioeffect', 72, AUDIO_EFFECT]
];

for (const [name, size, layers] of ICONS) {
    writeFileSync(join(outDir, `${name}.png`), encodePng(size, render(size, layers)));
    writeFileSync(join(outDir, `${name}@2x.png`), encodePng(size * 2, render(size * 2, layers)));
    console.log(`${name}.png (${size}px) + @2x`);
}

console.log(`\nIconos escritos en ${outDir}`);
