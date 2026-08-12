/**
 * Builds the distributable zip.
 *
 *   npm run package
 *
 * Assembles a staging copy from an **allowlist** and zips that, rather than
 * cleaning up the installed folder. A denylist would be a standing invitation to
 * leak whatever gets added next: the installed folder already accumulates a
 * `dev.json` from `npm run dev:on` and a `log/` from log4js, and at one point it
 * was also carrying the plugin sources next to the bundle.
 *
 * The result is a zip containing the `.sdPlugin` folder, which is the shape the
 * AJAZZ store distributes.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PLUGIN_NAME = 'com.raikerdev.wave_link.sdPlugin';
const ROOT = resolve('.');
const SOURCE = join(ROOT, PLUGIN_NAME);
const DIST = join(ROOT, 'dist');
const STAGING = join(DIST, PLUGIN_NAME);

/**
 * Everything that ships, and nothing else. Paths are relative to the plugin
 * folder; a directory brings its whole subtree.
 */
const SHIPS = [
    'manifest.json',
    'en.json',
    'es.json',
    'propertyInspector',
    'static'
];

/** The bundled entry point, which replaces the sources under `plugin/`. */
const BUNDLE = join(SOURCE, 'plugin', 'build', 'index.js');

const manifest = JSON.parse(readFileSync(join(SOURCE, 'manifest.json'), 'utf-8'));
const version = manifest.Version;

console.log(`Empaquetando ${manifest.Name} ${version}\n`);

// --- build --------------------------------------------------------------
// `npm run build` also installs; the bundle is what we are after here.
console.log('Compilando el bundle...');
execFileSync('npx', ['ncc', 'build', 'index.js', '-m', '-o', './build'], {
    cwd: join(SOURCE, 'plugin'),
    stdio: 'inherit',
    shell: true
});

if (!existsSync(BUNDLE)) {
    console.error(`\nNo se genero el bundle en ${BUNDLE}`);
    process.exit(1);
}

// --- staging ------------------------------------------------------------
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

for (const entry of SHIPS) {
    const from = join(SOURCE, entry);
    if (!existsSync(from)) {
        console.error(`Falta ${entry} en ${PLUGIN_NAME}`);
        process.exit(1);
    }
    cpSync(from, join(STAGING, entry), { recursive: true });
}

mkdirSync(join(STAGING, 'plugin'), { recursive: true });
cpSync(BUNDLE, join(STAGING, 'plugin', 'index.js'));

// --- sanity checks ------------------------------------------------------
// Cheap, and they catch exactly the mistakes that have already happened once.
const problems = [];
const walk = (dir, base = '') => {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const rel = base ? `${base}/${name}` : name;
        if (statSync(full).isDirectory()) walk(full, rel);
        else {
            if (/^dev\.json$|^\.gitignore$|node_modules|(^|\/)log\//.test(rel)) problems.push(rel);
        }
    }
};
walk(STAGING);

for (const action of manifest.Actions) {
    for (const asset of [action.Icon, ...action.States.map(s => s.Image)]) {
        if (!existsSync(join(STAGING, asset))) problems.push(`falta el icono ${asset} (${action.Name})`);
    }
    if (!existsSync(join(STAGING, action.PropertyInspectorPath))) {
        problems.push(`falta la pantalla ${action.PropertyInspectorPath} (${action.Name})`);
    }
}
if (!existsSync(join(STAGING, manifest.CodePathWin))) problems.push(`falta ${manifest.CodePathWin}`);

if (problems.length) {
    console.error('\nEl paquete tiene problemas:');
    for (const p of problems) console.error(`   ${p}`);
    process.exit(1);
}

// --- zip ----------------------------------------------------------------
const zip = join(DIST, `${PLUGIN_NAME}-${version}.zip`);
rmSync(zip, { force: true });
execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Compress-Archive -Path '${STAGING}' -DestinationPath '${zip}' -CompressionLevel Optimal`
], { stdio: 'inherit' });

const files = [];
walk2(STAGING);
function walk2(dir) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk2(full);
        else files.push(full);
    }
}

console.log(`\nListo: ${zip}`);
console.log(`   ${files.length} archivos, ${(statSync(zip).size / 1024).toFixed(0)} KB comprimidos`);
console.log('\nEl zip contiene la carpeta .sdPlugin, que es lo que espera la tienda.');
