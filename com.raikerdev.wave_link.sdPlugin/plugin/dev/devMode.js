/**
 * Live-reload for the key artwork.
 *
 * The installed plugin runs a bundled `index.js`, so editing the sources
 * normally does nothing until the whole thing is rebuilt and the host restarted.
 * That is a miserable loop for visual work, where every tweak needs to be seen on
 * the real hardware.
 *
 * When a `dev.json` sits next to the plugin's `manifest.json`, this module loads
 * the renderer from the path it names — the file in the repo, not the bundled
 * copy — and reloads it on every save. Edit, save, look at the device.
 *
 * Without that file nothing here activates, so shipping it is harmless.
 */
const { existsSync, readFileSync, watch } = require('node:fs');
const { join } = require('node:path');

/**
 * ncc inlines every `require` it can resolve statically, which would defeat the
 * whole point: we need the copy on disk at the moment of the call. Going through
 * eval keeps Node's own require, and the bundler leaves it alone.
 */
const nodeRequire = eval('require');

/** `manifest.json` lives one level above the bundled entry point. */
const CANDIDATES = [join(__dirname, '..', 'dev.json'), join(__dirname, '..', '..', 'dev.json')];

/** Coalesces the burst of events an editor emits when saving a single file. */
const RELOAD_DEBOUNCE_MS = 120;

function readConfig() {
    for (const path of CANDIDATES) {
        if (!existsSync(path)) continue;
        try {
            return { ...JSON.parse(readFileSync(path, 'utf-8')), path };
        } catch (err) {
            return { error: `dev.json is not valid JSON: ${err.message}`, path };
        }
    }
    return undefined;
}

/**
 * @param {(renderer: object) => void} onReload called with the freshly loaded module
 * @param {{info: Function, error: Function}} log
 * @returns {{active: boolean, calibrate: boolean, renderer?: object}}
 */
function start(onReload, log) {
    const config = readConfig();
    if (!config) return { active: false, calibrate: false };

    if (config.error) {
        log.error(`dev mode: ${config.error}`);
        return { active: false, calibrate: false };
    }

    const source = config.renderer;
    if (!source || !existsSync(source)) {
        log.error(`dev mode: renderer not found at ${source}`);
        return { active: false, calibrate: Boolean(config.calibrate) };
    }

    const load = () => {
        delete nodeRequire.cache[nodeRequire.resolve(source)];
        return nodeRequire(source);
    };

    let renderer;
    try {
        renderer = load();
    } catch (err) {
        log.error(`dev mode: could not load renderer: ${err.message}`);
        return { active: false, calibrate: Boolean(config.calibrate) };
    }

    log.info(`dev mode: watching ${source}${config.calibrate ? ' (calibration pattern)' : ''}`);

    let timer = null;
    watch(source, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            try {
                onReload(load());
                log.info('dev mode: renderer reloaded');
            } catch (err) {
                // A syntax error mid-edit is expected; keep the last good version.
                log.error(`dev mode: reload failed, keeping previous: ${err.message}`);
            }
        }, RELOAD_DEBOUNCE_MS);
    });

    return { active: true, calibrate: Boolean(config.calibrate), renderer };
}

module.exports = { start };
