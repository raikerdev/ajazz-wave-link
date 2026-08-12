/**
 * Draws the face of a Volume Knob as an SVG.
 *
 * The host accepts an image as a data URI, which is how the official SDK example
 * paints its keys too.
 *
 * Two shapes are needed, because the surfaces are not the same. A key is square,
 * while the strip above a dial is roughly twice as wide as it is tall — sending a
 * square image there gets stretched sideways. Everything is laid out at double
 * the physical size so it stays sharp.
 */

/** Canvas and geometry for each surface. `key` is square, `dial` is 2:1. */
const LAYOUTS = {
    key: { w: 144, h: 144, radius: 28 },
    dial: { w: 200, h: 100, radius: 12 }
};

const PLATE = '#000000';
const TEAL = '#2DBEB9';
const RED = '#E24E4E';
const TEXT = '#FFFFFF';
const DIM = '#8A8F98';
const TRACK = '#3D4048';

/** Palette of the dial card, modelled on Wave Link's own dial faces. */
const CARD = '#222222';
const CARD_INSET = 1;
const CARD_RADIUS = 10;
const LEVEL = '#35C759';
const TICK = '#55585F';
const SCOPE = '#9BA1AB';

/** Sweep of the gauge, in degrees clockwise from twelve o'clock. */
const GAUGE_FROM = -115;
const GAUGE_TO = 115;
const GAUGE_TICKS = 13;

/** Escapes the five characters that would otherwise break the SVG markup. */
function xml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

const MAX_LABEL_CHARS = 14;

/**
 * Picks the shortest label that still identifies the target.
 *
 * Two things make the raw `targetName` a bad fit. Device names carry a
 * parenthetical model ("Micrófono (Maono PD100W Mic USB)") that eats the whole
 * line, and a channelMix name leads with the channel ("Music -> Personal Mix")
 * when the distinguishing half is the mix. Both are trimmed away.
 */
function shortLabel(target) {
    let label = String(target.targetName || '').trim();

    if (target.targetType === 'channelMix') {
        const arrow = label.lastIndexOf('->');
        if (arrow >= 0) label = label.slice(arrow + 2).trim();
    }

    label = label.replace(/\s*\([^)]*\)\s*$/, '').trim();

    return label.length <= MAX_LABEL_CHARS ? label : `${label.slice(0, MAX_LABEL_CHARS - 1)}…`;
}

/**
 * Strips the model in parentheses that device names drag along.
 * The inner group is greedy on purpose: "Altavoces (Realtek(R) Audio)" nests
 * parentheses, and a non-greedy `[^)]*` fails to match it at all.
 */
function stripModel(name) {
    return String(name || '').replace(/\s*\(.*\)\s*$/, '').trim();
}

/** Cuts a string to `max` characters, with an ellipsis when it had to cut. */
function clip(text, max) {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * What the target *is* — the big name on the left.
 * For a channelMix this is the channel, because the mix goes in the scope slot.
 */
function primaryLabel(target) {
    const name = String(target.targetName || '').trim();
    if (target.targetType === 'channelMix') {
        const arrow = name.lastIndexOf('->');
        if (arrow >= 0) return stripModel(name.slice(0, arrow));
    }
    return stripModel(name);
}

/**
 * How far the control reaches — the small text on the right.
 *
 * This is the slot where Wave Link's own dial faces show `All` or the mix
 * number, and it maps onto our targets almost exactly: a channel's master fader
 * moves every mix, while a channelMix touches only one.
 */
function scopeLabel(target) {
    switch (target.targetType) {
        case 'channel': return 'All';
        case 'channelMix': {
            const name = String(target.targetName || '');
            const arrow = name.lastIndexOf('->');
            // Kept short on purpose: this slot competes with the name for room.
            return clip(arrow >= 0 ? name.slice(arrow + 2).trim() : 'Mix', 9);
        }
        case 'mix': return 'Mix';
        case 'input': return 'In';
        case 'output': return 'Out';
        default: return '';
    }
}

/** Rough text width. Good enough to decide where to truncate; no font metrics here. */
function approxWidth(text, size, bold = false) {
    return text.length * size * (bold ? 0.58 : 0.52);
}

/** A point on the gauge, `deg` measured clockwise from twelve o'clock. */
function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx, cy, r, from, to) {
    const [x0, y0] = polar(cx, cy, r, from);
    const [x1, y1] = polar(cx, cy, r, to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * The rotary gauge: tick marks, the track, the filled part and the needle.
 * `fraction` is 0..1; pass `filled: false` to draw it dead, for mute.
 */
function gauge(cx, cy, fraction, filled) {
    const angle = GAUGE_FROM + (GAUGE_TO - GAUGE_FROM) * fraction;
    const arcR = 27;
    const bodyR = 19;

    let ticks = '';
    for (let i = 0; i < GAUGE_TICKS; i++) {
        const t = GAUGE_FROM + ((GAUGE_TO - GAUGE_FROM) * i) / (GAUGE_TICKS - 1);
        const [x0, y0] = polar(cx, cy, arcR + 4, t);
        const [x1, y1] = polar(cx, cy, arcR + 8, t);
        ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"
        stroke="${TICK}" stroke-width="1.6" stroke-linecap="round" />`;
    }

    const [px, py] = polar(cx, cy, bodyR, angle);
    const [bx, by] = polar(cx, cy, 6, angle);

    return `${ticks}
  <path d="${arcPath(cx, cy, arcR, GAUGE_FROM, GAUGE_TO)}" fill="none" stroke="${TRACK}"
        stroke-width="3.5" stroke-linecap="round" />
  ${filled && fraction > 0
        ? `<path d="${arcPath(cx, cy, arcR, GAUGE_FROM, angle)}" fill="none" stroke="${LEVEL}"
        stroke-width="3.5" stroke-linecap="round" />`
        : ''}
  <line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}"
        stroke="${TEXT}" stroke-width="2.6" stroke-linecap="round" />`;
}

/**
 * A speaker, drawn in a 24x24 box and scaled into place. Crossed out when muted,
 * radiating two waves when it is not.
 */
function speakerGlyph(x, y, size, color, { crossed = false, waveColor = color } = {}) {
    const s = size / 24;
    const tail = crossed
        ? `<g stroke="${color}" stroke-width="2.6" stroke-linecap="round">
      <line x1="16" y1="9" x2="23" y2="16" />
      <line x1="23" y1="9" x2="16" y2="16" />
    </g>`
        : `<g stroke="${waveColor}" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M16 9 a 7 7 0 0 1 0 10" />
      <path d="M20 5 a 12 12 0 0 1 0 18" />
    </g>`;

    return `<g transform="translate(${x} ${y}) scale(${s.toFixed(3)})">
    <path d="M2 9 h5 l6 -5 v20 l-6 -5 h-5 z" fill="${color}" />
    ${tail}
  </g>`;
}

/** Back-compatible shorthand for the crossed-out speaker used on the dial. */
function muteGlyph(x, y, size, color) {
    return speakerGlyph(x, y, size, color, { crossed: true });
}

/**
 * Both `href` and `xlink:href` are emitted: SVG 2 renderers read the first, and
 * anything still on SVG 1.1 only understands the second.
 */
function iconTag(iconPng, x, y, size) {
    if (!iconPng) return '';
    const src = `data:image/png;base64,${iconPng}`;
    return `<image x="${x}" y="${y}" width="${size}" height="${size}"
       preserveAspectRatio="xMidYMid meet" href="${src}" xlink:href="${src}" />`;
}

function open({ w, h, radius }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="${radius}" fill="${PLATE}" />`;
}

function bar(x, width, y, height, fraction, accent) {
    // A minimum sliver keeps the bar readable as a control rather than as an
    // empty box when the level is very low but not zero.
    const fill = fraction <= 0 ? 0 : Math.max(3, Math.round(width * fraction));
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${TRACK}" />
  <rect x="${x}" y="${y}" width="${fill}" height="${height}" rx="${height / 2}" fill="${accent}" />`;
}

/**
 * Wide surface above a dial, modelled on Wave Link's own dial faces: a header
 * with the icon, the name and the scope, and under it a rotary gauge on the left
 * with the reading on the right. Muting swaps the reading for a crossed speaker
 * and outlines the card in red.
 */
function dialFace(target, iconPng, percent, muted) {
    const L = LAYOUTS.dial;
    const right = L.w - 12;

    const hasIcon = Boolean(iconPng);
    const nameX = hasIcon ? 40 : 12;
    const scope = scopeLabel(target);
    // Whatever the icon and the scope leave over belongs to the name.
    const nameRoom = right - nameX - approxWidth(scope, 15) - 8;
    const name = clip(primaryLabel(target), Math.max(4, Math.floor(nameRoom / (19 * 0.58))));

    const reading = muted
        ? muteGlyph(right - 40, 45, 34, RED)
        : `<text x="${right - 5}" y="75" fill="${TEXT}" font-family="sans-serif" font-size="36"
        font-weight="900" text-anchor="end">${percent}</text>
  <text x="${right - 5}" y="91" fill="${TEXT}" font-family="sans-serif" font-size="15"
        text-anchor="end">%</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${L.w}" height="${L.h}" viewBox="0 0 ${L.w} ${L.h}">
  <rect width="${L.w}" height="${L.h}" fill="${PLATE}" />
  <rect x="${CARD_INSET}" y="${CARD_INSET}" width="${L.w - CARD_INSET * 2}"
        height="${L.h - CARD_INSET * 2}" rx="${CARD_RADIUS}" fill="${CARD}"
        ${muted ? `stroke="${RED}" stroke-width="2.5"` : ''} />
  ${iconTag(iconPng, 12, 10, 22)}
  <text x="${nameX}" y="28" fill="${TEXT}" font-family="sans-serif" font-size="19"
        font-weight="bold">${xml(name)}</text>
  <text x="${right}" y="28" fill="${SCOPE}" font-family="sans-serif" font-size="15"
        text-anchor="end">${xml(scope)}</text>
  ${gauge(64, 80, percent / 100, !muted)}
  ${reading}
</svg>`;
}

/** Square key face: icon, label, reading and bar stacked. */
function keyFace(target, iconPng, percent, muted) {
    const L = LAYOUTS.key;
    const accent = muted ? RED : TEAL;
    const hasIcon = Boolean(iconPng);

    const labelY = hasIcon ? 72 : 50;
    const readingY = hasIcon ? 112 : 96;
    const barY = hasIcon ? 124 : 116;

    return `${open(L)}
  ${iconTag(iconPng, 52, 12, 40)}
  <text x="72" y="${labelY}" fill="${DIM}" font-family="sans-serif" font-size="17"
        text-anchor="middle">${xml(shortLabel(target))}</text>
  <text x="72" y="${readingY}" fill="${muted ? RED : TEXT}" font-family="sans-serif"
        font-size="${muted ? 30 : 38}" font-weight="bold"
        text-anchor="middle">${muted ? 'MUTE' : `${percent}%`}</text>
  ${bar(16, L.w - 32, barY, 8, muted ? 0 : percent / 100, accent)}
</svg>`;
}

/**
 * Face of a Mute Toggle key.
 *
 * Deliberately *not* the same as `keyFace`, even though both are square and both
 * end up on a key. A Volume Knob is about the number; a Mute Toggle is about
 * whether the audio is going out at all. So the speaker takes the middle and the
 * level drops to a supporting role — the two actions stay tellable apart at a
 * glance instead of becoming the same key twice.
 */
function muteFace(target, iconPng) {
    const L = LAYOUTS.key;
    const percent = Math.round(Math.min(1, Math.max(0, target.level)) * 100);
    const muted = target.isMuted;

    const hasIcon = Boolean(iconPng);
    const nameX = hasIcon ? 40 : 12;
    const name = clip(primaryLabel(target), hasIcon ? 10 : 13);

    return `${open(L)}
  ${muted
        ? `<rect x="2" y="2" width="${L.w - 4}" height="${L.h - 4}" rx="${L.radius - 2}"
        fill="none" stroke="${RED}" stroke-width="3" />`
        : ''}
  ${iconTag(iconPng, 12, 12, 22)}
  <text x="${nameX}" y="30" fill="${TEXT}" font-family="sans-serif" font-size="18"
        font-weight="bold">${xml(name)}</text>
  ${speakerGlyph(46, 48, 52, muted ? RED : TEXT, { crossed: muted, waveColor: LEVEL })}
  ${bar(20, L.w - 40, 112, 6, muted ? 0 : percent / 100, muted ? RED : LEVEL)}
  <text x="${L.w / 2}" y="136" fill="${muted ? RED : SCOPE}" font-family="sans-serif"
        font-size="17" text-anchor="middle">${muted ? '' : `${percent}%`}</text>
</svg>`;
}

/**
 * Splits a mix name over two lines so it fits a 144px key.
 * "Stream - Music" reads better stacked than clipped to "Stream - M…".
 */
function splitMixName(name) {
    const clean = String(name || '').trim();
    if (!clean) return ['Sin mix'];
    const dash = clean.indexOf(' - ');
    if (dash >= 0) return [clean.slice(0, dash), clean.slice(dash + 3)];
    const space = clean.lastIndexOf(' ');
    if (space > 0 && clean.length > 10) return [clean.slice(0, space), clean.slice(space + 1)];
    return [clean];
}

/**
 * Face of an Output Mix key: which output, which mix is feeding it right now,
 * and what pressing will switch it to.
 *
 * Output devices carry no artwork in Wave Link, so there is no icon to lean on —
 * the current mix is the thing that has to read at a glance.
 */
function outputMixFace({ outputName, currentMixName, nextMixName, onTarget }) {
    const L = LAYOUTS.key;
    const lines = splitMixName(currentMixName);
    const accent = onTarget ? LEVEL : TEXT;
    const firstY = lines.length > 1 ? 64 : 76;

    const body = lines
        .map((line, i) => `<text x="72" y="${firstY + i * 26}" fill="${accent}" font-family="sans-serif"
        font-size="23" font-weight="bold" text-anchor="middle">${xml(clip(line, 12))}</text>`)
        .join('\n  ');

    return `${open(L)}
  <text x="72" y="28" fill="${SCOPE}" font-family="sans-serif" font-size="15"
        text-anchor="middle">${xml(clip(stripModel(outputName), 15))}</text>
  ${body}
  ${nextMixName
        ? `<text x="72" y="126" fill="${DIM}" font-family="sans-serif" font-size="15"
        text-anchor="middle">→ ${xml(clip(nextMixName, 13))}</text>`
        : ''}
</svg>`;
}

/**
 * @param {object} target    the live Wave Link target, with `level` and `isMuted`
 * @param {string} [iconPng] base64 PNG for the channel, when Wave Link has one
 * @param {'key'|'dial'} [surface] where it will be shown
 * @returns {string} an SVG document
 */
function volumeFace(target, iconPng, surface = 'key') {
    const percent = Math.round(Math.min(1, Math.max(0, target.level)) * 100);
    const draw = surface === 'dial' ? dialFace : keyFace;
    return draw(target, iconPng, percent, target.isMuted);
}

/** Face shown when the action has no target picked yet, or its target vanished. */
function unconfiguredFace(message, surface = 'key') {
    const isDial = surface === 'dial';
    const L = isDial ? LAYOUTS.dial : LAYOUTS.key;
    const cx = L.w / 2;
    // The dial keeps the same card as a configured face, so an empty one reads as
    // "nothing set here" rather than as a glitch.
    const card = isDial
        ? `<rect x="${CARD_INSET}" y="${CARD_INSET}" width="${L.w - CARD_INSET * 2}"
        height="${L.h - CARD_INSET * 2}" rx="${CARD_RADIUS}" fill="${CARD}" />`
        : '';
    const knobY = surface === 'dial' ? 38 : 60;
    const textY = surface === 'dial' ? 82 : 118;
    const r = surface === 'dial' ? 18 : 26;
    const stroke = surface === 'dial' ? 5 : 7;

    return `${open(L)}
  ${card}
  <circle cx="${cx}" cy="${knobY}" r="${r}" fill="none" stroke="${DIM}" stroke-width="${stroke}" />
  <rect x="${cx - stroke / 2}" y="${knobY - r - stroke}" width="${stroke}" height="${r * 0.7}"
        rx="${stroke / 2}" fill="${DIM}" />
  <text x="${cx}" y="${textY}" fill="${DIM}" font-family="sans-serif" font-size="18"
        text-anchor="middle">${xml(message)}</text>
</svg>`;
}

/**
 * Test pattern for working out the real proportions of a surface.
 *
 * The host stretches whatever it is given to fill the panel, and nothing on disk
 * says how many pixels that panel actually is. So: draw a true circle inside a
 * true square, look at the device, and read the distortion off a photo.
 *
 *   panelRatio = (ancho/alto medidos en la foto del círculo) × (ancho/alto del lienzo)
 *
 * If the circle comes out round, the canvas already matches the panel.
 */
function calibrationFace(surface = 'key') {
    const L = surface === 'dial' ? LAYOUTS.dial : LAYOUTS.key;
    const cx = L.w / 2;
    const cy = L.h / 2;
    const r = Math.min(L.w, L.h) * 0.36;

    return `${open(L)}
  <rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}"
        fill="none" stroke="${TRACK}" stroke-width="3" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TEAL}" stroke-width="4" />
  <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${RED}" stroke-width="2" />
  <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${RED}" stroke-width="2" />
  <text x="${cx}" y="${L.h - 6}" fill="${DIM}" font-family="sans-serif" font-size="13"
        text-anchor="middle">${L.w}x${L.h}</text>
</svg>`;
}

/**
 * Wraps an SVG as a data URI. The payload has to be percent-encoded: channel
 * names carry accents, and a raw `#` would truncate the URI at the fragment.
 */
function toDataUri(svg) {
    return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

module.exports = { volumeFace, muteFace, outputMixFace, unconfiguredFace, calibrationFace, toDataUri };
