/**
 * Stands in for the Stream Dock host so the property inspector can be worked on
 * in a normal browser, with real Wave Link data and without touching the device.
 *
 *   node scripts/pi-harness.mjs
 *
 * Then open one of the URLs it prints. The page connects by itself — the harness
 * injects the call the host would normally make — and everything the inspector
 * sends back is logged, so you can see exactly what it would persist.
 *
 * Settings are kept in memory per action, so saving and reloading behaves like
 * the real thing.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PLUGIN_URL = new URL('../com.raikerdev.wave_link.sdPlugin/', import.meta.url);
const PLUGIN_ROOT = fileURLToPath(PLUGIN_URL);
const PI_ROOT = fileURLToPath(new URL('propertyInspector/', PLUGIN_URL));
const require = createRequire(new URL('plugin/package.json', PLUGIN_URL));
const { WebSocketServer } = require('ws');
const { WaveLinkClient } = require(fileURLToPath(new URL('plugin/wavelink/client.js', PLUGIN_URL)));

const HTTP_PORT = 8099;
const WS_PORT = 8100;

/** Which page each action opens, mirroring `PropertyInspectorPath` in the manifest. */
const PAGES = {
    volumeknob: 'target/index.html',
    mutetoggle: 'target/index.html',
    volumebutton: 'target/index.html',
    audioeffect: 'effect/index.html',
    outputmix: 'outputmix/index.html'
};

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    // Los archivos de idioma. El charset importa: zh_CN.json es todo multibyte.
    '.json': 'application/json; charset=utf-8'
};

/** Persisted settings, keyed by action — the host's job, faked in memory. */
const settingsByAction = new Map();

const client = new WaveLinkClient({ info: msg => console.log(`· ${msg}`), error: msg => console.error(`! ${msg}`) });

/**
 * The host calls the page's entry function once the webview is up. Injecting the
 * same call means you just open a URL instead of pasting anything into a console.
 */
function autoConnect(action, lang) {
    return `
<script>
  (() => {
    const action = 'com.raikerdev.wave_link.${action}';
    const context = 'harness-${action}';
    const info = JSON.stringify({ application: { language: '${lang}', platform: 'windows', version: '3.10.188.226' } });
    const actionInfo = JSON.stringify({ action, context, payload: { settings: {} } });
    const connect = window.connectMiraBoxSDSocket || window.connectElgatoStreamDeckSocket;
    connect(${WS_PORT}, context, 'registerPropertyInspector', info, actionInfo);
  })();
</script>`;
}

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    const action = url.searchParams.get('action') || 'volumeknob';
    // The host reports the app's language; `?lang=` fakes it so the translation
    // can be checked without changing anything on the machine.
    const lang = url.searchParams.get('lang') || 'es';

    // Redirect rather than serve the page at "/": the inspector loads its scripts
    // with relative paths, and from the root they resolve to the wrong folder.
    if (url.pathname === '/') {
        const page = PAGES[action] || PAGES.volumeknob;
        res.writeHead(302, { Location: `/${page}?action=${action}&lang=${lang}` });
        res.end();
        return;
    }

    const path = url.pathname;

    try {
        // The inspector fetches `../../<lang>.json`, which climbs out of the
        // property inspector folder; the browser normalises that to `/es.json`.
        const root = /^\/[^/]+\.json$/.test(path) ? PLUGIN_ROOT : PI_ROOT;
        const file = join(root, decodeURIComponent(path));
        let body = await readFile(file);

        if (extname(file) === '.html') {
            body = `${body.toString()}\n${autoConnect(action, lang)}`;
        }

        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404);
        res.end('not found');
    }
}).listen(HTTP_PORT, '127.0.0.1');

const wss = new WebSocketServer({ port: WS_PORT, host: '127.0.0.1' });

wss.on('connection', socket => {
    let action = 'volumeknob';

    socket.on('message', data => {
        const message = JSON.parse(data.toString());
        const name = message.action?.split('.').pop();
        if (name) action = name;

        switch (message.event) {
            case 'registerPropertyInspector':
                console.log(`\n>> la pantalla se registro como "${message.uuid}"`);
                break;

            case 'sendToPlugin':
                console.log(`>> sendToPlugin ${JSON.stringify(message.payload)}`);
                if (message.payload?.type === 'getTargets') {
                    socket.send(JSON.stringify({
                        event: 'sendToPropertyInspector',
                        action: message.action,
                        context: message.context,
                        // Mirrors pushTargets() in plugin/index.js. Keep in sync.
                        payload: {
                            type: 'targets',
                            connected: client.isReady(),
                            targets: client.getTargets(),
                            effects: client.getEffects(),
                            settings: settingsByAction.get(action) || {}
                        }
                    }));
                    console.log(`<< le mande ${client.getTargets().length} destinos, ${client.getEffects().length} efectos y los settings guardados`);
                }
                break;

            case 'setSettings':
                settingsByAction.set(action, message.payload);
                console.log(`>> GUARDA ${JSON.stringify(message.payload)}`);
                break;

            default:
                console.log(`>> ${message.event}`);
        }
    });
});

client.on('ready', () => {
    console.log(`\nArnes listo. Wave Link conectado, ${client.getTargets().length} destinos.\n`);
    for (const action of Object.keys(PAGES)) {
        console.log(`   ${action.padEnd(13)} http://127.0.0.1:${HTTP_PORT}/?action=${action}`);
    }
    console.log(`\n   Agregale &lang=en, &lang=es o &lang=zh_CN para ver la pantalla en ese idioma.`);
    console.log('\nLo que la pantalla guarde se ve aca abajo. Ctrl+C para salir.');
});

client.on('disconnected', () => console.log('! Wave Link se desconecto'));

client.start();

setTimeout(() => {
    if (!client.isReady()) {
        console.log('\nWave Link no respondio: la pantalla va a abrir igual, pero sin destinos.');
    }
}, 8000);
