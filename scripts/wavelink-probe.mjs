/**
 * Looks at Wave Link without going through Stream Dock at all.
 *
 *   node scripts/wavelink-probe.mjs           los destinos, agrupados por tipo
 *   node scripts/wavelink-probe.mjs --raw     las estructuras crudas, con todos sus campos
 *   node scripts/wavelink-probe.mjs --watch   las notificaciones, en vivo
 *
 * `--raw` es para descubrir campos que el plugin todavía no usa (así aparecieron
 * `image.imgData` y `mixId`). `--watch` es para ver qué manda Wave Link de verdad
 * cuando algo cambia — así se encontró que las notificaciones de dispositivo son
 * parciales.
 */
import { createRequire } from 'node:module';

const PLUGIN = new URL('../com.raikerdev.wave_link.sdPlugin/plugin/', import.meta.url);
const require = createRequire(new URL('package.json', PLUGIN));
const { WaveLinkClient } = require(new URL('wavelink/client.js', PLUGIN).pathname.slice(1));

const args = new Set(process.argv.slice(2));
const raw = args.has('--raw');
const watch = args.has('--watch');

const client = new WaveLinkClient({ info: msg => console.log(`· ${msg}`), error: msg => console.error(`! ${msg}`) });

if (watch) {
    // Tap the wire without touching the client: notifications are what we want to see.
    const original = client.onMessage.bind(client);
    client.onMessage = message => {
        try {
            const parsed = JSON.parse(message);
            if (parsed.method) {
                console.log(`\n${new Date().toLocaleTimeString()}  ${parsed.method}`);
                console.log(`   ${JSON.stringify(parsed.params)}`);
            }
        } catch {
            // Not our problem; hand it over anyway.
        }
        original(message);
    };
}

client.on('ready', () => {
    if (raw) {
        for (const [label, collection] of [
            ['channels', client.channels],
            ['inputDevices', client.inputDevices],
            ['outputDevices', client.outputDevices],
            ['mixes', client.mixes]
        ]) {
            console.log(`\n===== ${label}`);
            console.log(JSON.stringify(collection, null, 2).replace(/"imgData": "[^"]{40,}"/g, '"imgData": "<PNG base64>"'));
        }
    } else {
        const targets = client.getTargets();
        console.log(`\n${targets.length} destinos\n`);

        const byType = {};
        for (const target of targets) (byType[target.targetType] ||= []).push(target);

        for (const [type, list] of Object.entries(byType)) {
            console.log(`--- ${type} (${list.length})`);
            for (const t of list) {
                const level = `${String(Math.round(t.level * 100)).padStart(3)}%`;
                const muted = t.isMuted ? 'MUTE' : '    ';
                const icon = client.getIcon(t.targetType, t.targetId) ? 'icono' : '     ';
                console.log(`   ${level} ${muted} ${icon}  ${t.targetName}`);
                if (type === 'output') {
                    const mix = client.getOutputMix(t.targetId);
                    console.log(`                        alimenta: ${targets.find(m => m.targetType === 'mix' && m.targetId === mix)?.targetName || '(sin mix)'}`);
                }
            }
        }
    }

    if (!watch) process.exit(0);
    console.log('\nEscuchando notificaciones. Movete algo en Wave Link. Ctrl+C para salir.');
});

client.start();

setTimeout(() => {
    if (!client.isReady()) {
        console.error('No me pude conectar a Wave Link. ¿Está abierto?');
        process.exit(1);
    }
}, 12000);
