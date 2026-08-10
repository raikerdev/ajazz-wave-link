/**
 * Post-build install step, adapted from the official SDNodeJsSDKV2 template.
 *
 * On top of the template's copy, it stops and restarts the Stream Dock host (it
 * only scans the plugins folder at startup, and it keeps the installed files
 * open while running) and removes the superseded standalone-exe plugin.
 */
const path = require('path');
const fs = require('fs-extra');
const { execSync, spawn } = require('child_process');

const HOST_PROCESS = 'Stream Dock AJAZZ.exe';
const HOST_EXE = 'C:\\Program Files (x86)\\Stream Dock AJAZZ Global\\Stream Dock AJAZZ.exe';

/** The earlier iteration of this plugin, replaced by the one built here. */
const SUPERSEDED_PLUGIN = 'com.ricardoaom.wavelink.sdPlugin';
const SUPERSEDED_PROCESS = 'wavelink-plugin.exe';

const sourceDir = path.resolve(__dirname, '..');
const pluginName = path.basename(sourceDir);
const pluginsRoot = path.join(process.env.APPDATA, 'HotSpot', 'StreamDock', 'plugins');
const pluginPath = path.join(pluginsRoot, pluginName);

/** Files that only exist to build the bundle — the host gets `build/` instead. */
const EXCLUDED = [
    'plugin\\node_modules',
    'plugin\\index.js',
    'plugin\\utils',
    'plugin\\wavelink',
    'plugin\\autofile.js',
    'plugin\\package.json',
    'plugin\\package-lock.json',
    'plugin\\pnpm-lock.yaml',
    'plugin\\yarn.lock',
    'plugin\\build',
    'plugin\\log',
    '.git',
    '.vscode'
];

function kill(imageName) {
    try {
        execSync(`taskkill /IM "${imageName}" /F`, { stdio: 'ignore' });
        console.log(`Detenido ${imageName}`);
    } catch {
        // Not running — nothing to stop.
    }
}

kill(HOST_PROCESS);
kill(SUPERSEDED_PROCESS);

try {
    if (fs.existsSync(path.join(pluginsRoot, SUPERSEDED_PLUGIN))) {
        fs.removeSync(path.join(pluginsRoot, SUPERSEDED_PLUGIN));
        console.log(`Desinstalado el plugin anterior "${SUPERSEDED_PLUGIN}"`);
    }

    fs.removeSync(pluginPath);
    fs.ensureDirSync(pluginsRoot);

    fs.copySync(sourceDir, pluginPath, {
        filter: src => {
            const rel = path.relative(sourceDir, src);
            return !EXCLUDED.some(excluded => rel.startsWith(excluded));
        }
    });

    // The bundled entry point replaces the sources excluded above.
    fs.copySync(path.join(__dirname, 'build'), path.join(pluginPath, 'plugin'));

    console.log(`Instalado "${pluginName}" en "${pluginPath}"`);
} catch (err) {
    console.error(`Fallo la instalacion de "${pluginName}":`, err);
    process.exit(1);
}

if (fs.existsSync(HOST_EXE)) {
    // Detached, with an explicit cwd so the host does not drop its logs in this repo.
    spawn(HOST_EXE, [], { cwd: path.dirname(HOST_EXE), detached: true, stdio: 'ignore' }).unref();
    console.log('Stream Dock AJAZZ reiniciado');
} else {
    console.warn(`No se encontro ${HOST_EXE} - abri Stream Dock AJAZZ a mano.`);
}
