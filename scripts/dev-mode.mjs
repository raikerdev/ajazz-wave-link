/**
 * Turns the artwork live-reload on or off.
 *
 *   node scripts/dev-mode.mjs on           edit keyFace.js, save, see it on the device
 *   node scripts/dev-mode.mjs calibrate    same, but every Volume Knob shows the test pattern
 *   node scripts/dev-mode.mjs off          back to the bundled renderer
 *
 * Writes a `dev.json` into the *installed* plugin and restarts the host so it is
 * picked up. Nothing is written to the source tree, so a plain
 * `npm run install-plugin` always lands a clean build.
 */
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, execSync } from 'node:child_process';

const PLUGIN_NAME = 'com.raikerdev.wave_link.sdPlugin';
const HOST_EXE = 'C:\\Program Files (x86)\\Stream Dock AJAZZ Global\\Stream Dock AJAZZ.exe';

const installedDir = join(process.env.APPDATA, 'HotSpot', 'StreamDock', 'plugins', PLUGIN_NAME);
const configPath = join(installedDir, 'dev.json');
const rendererPath = resolve(PLUGIN_NAME, 'plugin', 'render', 'keyFace.js').replace(/\\/g, '/');

const mode = (process.argv[2] || 'on').toLowerCase();
if (!['on', 'off', 'calibrate'].includes(mode)) {
    console.error(`Modo desconocido "${mode}". Usá: on | off | calibrate`);
    process.exit(1);
}

if (!existsSync(installedDir)) {
    console.error(`El plugin no está instalado en ${installedDir}. Corré primero: npm run install-plugin`);
    process.exit(1);
}

if (mode === 'off') {
    rmSync(configPath, { force: true });
    console.log('Modo dev APAGADO — vuelve a usar el renderer compilado.');
} else {
    if (!existsSync(rendererPath)) {
        console.error(`No encuentro el renderer en ${rendererPath}`);
        process.exit(1);
    }
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify({ renderer: rendererPath, calibrate: mode === 'calibrate' }, null, 2)}\n`);
    console.log(`Modo dev ENCENDIDO${mode === 'calibrate' ? ' (patrón de calibración)' : ''}`);
    console.log(`Editá  ${rendererPath}`);
    console.log('Guardá el archivo y el dispositivo se redibuja solo. No hace falta reinstalar.');
}

try {
    execSync(`taskkill /IM "Stream Dock AJAZZ.exe" /F`, { stdio: 'ignore' });
} catch {
    // not running
}

if (existsSync(HOST_EXE)) {
    spawn(HOST_EXE, [], { cwd: HOST_EXE.slice(0, HOST_EXE.lastIndexOf('\\')), detached: true, stdio: 'ignore' }).unref();
    console.log('Stream Dock AJAZZ reiniciado.');
}
