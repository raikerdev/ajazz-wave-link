/**
 * Renders every key face with real Wave Link data, in a browser, at the size the
 * device actually shows them.
 *
 *   node scripts/face-preview.mjs
 *
 * The renderer is re-read on every request, so editing `render/keyFace.js` and
 * refreshing is enough — no rebuild. This is for judging the artwork; to see it
 * on the device itself use `npm run dev:on`.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PLUGIN_URL = new URL('../com.raikerdev.wave_link.sdPlugin/', import.meta.url);
const require = createRequire(new URL('plugin/package.json', PLUGIN_URL));
const RENDER_PATH = fileURLToPath(new URL('plugin/render/keyFace.js', PLUGIN_URL));
const { WaveLinkClient } = require(fileURLToPath(new URL('plugin/wavelink/client.js', PLUGIN_URL)));

const PORT = 8102;
const client = new WaveLinkClient({ info: msg => console.log(`· ${msg}`), error: msg => console.error(`! ${msg}`) });

/** Fresh copy of the renderer, so a save is visible on the next refresh. */
function loadRenderer() {
    delete require.cache[RENDER_PATH];
    return require(RENDER_PATH);
}

const card = (svg, caption, wide) =>
    `<figure class="${wide ? 'wide' : 'square'}">${svg}<figcaption>${caption}</figcaption></figure>`;

function buildPage() {
    const R = loadRenderer();
    const targets = client.getTargets();
    const icon = t => client.getIcon(t.targetType, t.targetId);

    const pick = type => targets.filter(t => t.targetType === type).slice(0, 2);
    const sample = [...pick('channel'), ...pick('channelMix'), ...pick('mix'), ...pick('output')];

    const sections = [];

    sections.push(['Dial — como se ve en la franja del encoder', sample.map(t =>
        card(R.volumeFace(t, icon(t), 'dial'), `${t.targetType} · ${Math.round(t.level * 100)}%`, true)).join('')]);

    sections.push(['Dial — muteado y nivel bajo', sample.slice(0, 3).flatMap(t => [
        card(R.volumeFace({ ...t, isMuted: true }, icon(t), 'dial'), 'muteado', true),
        card(R.volumeFace({ ...t, level: 0.05, isMuted: false }, icon(t), 'dial'), '5%', true)
    ]).join('')]);

    sections.push(['Volume Knob en una tecla', sample.slice(0, 4).map(t =>
        card(R.volumeFace(t, icon(t), 'key'), t.targetType)).join('')]);

    sections.push(['Mute Toggle', sample.slice(0, 3).flatMap(t => [
        card(R.muteFace(t, icon(t)), 'suena'),
        card(R.muteFace({ ...t, isMuted: true }, icon(t)), 'muteado')
    ]).join('')]);

    sections.push(['Volume Button', sample.slice(0, 3).flatMap(t => [
        card(R.volumeButtonFace(t, icon(t), '+ 5%'), 'subir'),
        card(R.volumeButtonFace(t, icon(t), '− 5%'), 'bajar'),
        card(R.volumeButtonFace(t, icon(t), '→ 30%'), 'fijar')
    ]).join('')]);

    const outputs = targets.filter(t => t.targetType === 'output');
    const mixes = targets.filter(t => t.targetType === 'mix');
    sections.push(['Output Mix', outputs.map((o, i) => {
        const current = mixes.find(m => m.targetId === client.getOutputMix(o.targetId));
        return card(R.outputMixFace({
            outputName: o.targetName,
            currentMixName: current?.targetName || '',
            nextMixName: mixes[(i + 1) % mixes.length].targetName,
            onTarget: i === 0
        }), o.targetName.slice(0, 18));
    }).join('')]);

    sections.push(['Sin configurar y calibracion', [
        card(R.unconfiguredFace('Sin destino', 'dial'), 'dial vacio', true),
        card(R.unconfiguredFace('Sin conexion', 'key'), 'tecla sin WL'),
        card(R.calibrationFace('dial'), 'calibracion dial', true),
        card(R.calibrationFace('key'), 'calibracion tecla')
    ].join('')]);

    return `<!doctype html><meta charset="utf-8"><title>Caras — Wave Link Control</title>
<style>
  body { background:#1b1b1b; color:#ddd; font-family:sans-serif; padding:16px; margin:0 }
  h2 { font-size:13px; color:#9aa; font-weight:normal; margin:22px 0 8px }
  .row { display:flex; gap:14px; flex-wrap:wrap }
  figure { margin:0; text-align:center }
  figcaption { font-size:10px; color:#889; margin-top:4px }
  .wide svg { width:200px; height:100px; display:block }
  .square svg { width:100px; height:100px; display:block }
  footer { margin-top:28px; font-size:11px; color:#667 }
</style>
${sections.map(([title, html]) => `<h2>${title}</h2><div class="row">${html}</div>`).join('')}
<footer>Editá plugin/render/keyFace.js y recargá. ${targets.length} destinos vivos.</footer>`;
}

createServer((_, res) => {
    try {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildPage());
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`El renderer no compila:\n\n${err.stack}`);
    }
}).listen(PORT, '127.0.0.1');

client.on('ready', () => {
    console.log(`\nCaras en http://127.0.0.1:${PORT}/`);
    console.log('Editá plugin/render/keyFace.js y recargá la pagina. Ctrl+C para salir.');
});

client.start();
