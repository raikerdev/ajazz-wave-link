/**
 * Draws the marketing images for the AJAZZ store listing.
 *
 *   npm run store            imagenes en ingles
 *   npm run store -- --lang=zh
 *   npm run store -- --lang=all
 *
 * La ficha pide 16:9, asi que salen en 1920x1080. El avatar 480x480 **no** se
 * hace aca: sale de `npm run icons`, porque es la misma marca que el icono del
 * plugin y no tiene sentido mantener dos dibujos.
 *
 * Dos decisiones que valen la pena conocer:
 *
 * 1. **Las teclas son las de verdad.** Las caras salen de
 *    `plugin/render/keyFace.js`, el mismo modulo que dibuja lo que se ve en el
 *    aparato. Si el diseño cambia, estas imagenes cambian con el; no hay una
 *    maqueta que se pueda quedar vieja.
 * 2. **La pantalla de configuracion tambien.** Se lee el `index.html` real y se
 *    le inyectan nada mas las opciones, que en vivo las pone el plugin. El CSS
 *    viene tal cual del archivo, asi que no puede desincronizarse. La version en
 *    chino se arma con las traducciones de `zh_CN.json`, del mismo modo que lo
 *    haria el recorrido del SDK.
 *
 * Rasteriza con el Chrome o el Edge que ya esta instalado, en modo headless. No
 * se agrega ninguna dependencia por esto.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const PLUGIN_URL = new URL('../com.raikerdev.wave_link.sdPlugin/', import.meta.url);
const require = createRequire(new URL('plugin/package.json', PLUGIN_URL));
const face = require(fileURLToPath(new URL('plugin/render/keyFace.js', PLUGIN_URL)));

const PLUGIN_ROOT = fileURLToPath(PLUGIN_URL);
const OUT_ROOT = resolve('store');
const WIDTH = 1920;
const HEIGHT = 1080;

// ---------------------------------------------------------------------------
// El navegador que rasteriza
// ---------------------------------------------------------------------------

const CANDIDATES = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean);

function findBrowser() {
    const found = CANDIDATES.find(path => existsSync(path));
    if (!found) {
        console.error('No encontre Chrome ni Edge para rasterizar.');
        console.error('Pasa la ruta con la variable de entorno CHROME_PATH.');
        process.exit(1);
    }
    return found;
}

const BROWSER = findBrowser();
const SCRATCH = join(tmpdir(), 'wave-link-store');
mkdirSync(SCRATCH, { recursive: true });

function shoot(html, outPath) {
    const page = join(SCRATCH, 'page.html');
    writeFileSync(page, html, 'utf-8');
    rmSync(outPath, { force: true });
    execFileSync(BROWSER, [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        // Le da tiempo a que asiente el layout sin quedarse esperando de mas.
        '--virtual-time-budget=3000',
        `--window-size=${WIDTH},${HEIGHT}`,
        `--screenshot=${outPath}`,
        `file:///${page.replace(/\\/g, '/')}`
    ], { stdio: 'pipe' });

    if (!existsSync(outPath)) throw new Error(`no se genero ${outPath}`);
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const COPY = {
    en: {
        eyebrow: 'STREAM DOCK PLUGIN',
        title: 'Wave Link Control',
        tagline: 'Your Elgato Wave Link 3 mixer, on the dials and keys of your Stream Dock.',
        chips: ['Windows', 'Requires Wave Link 3', 'Free and open source'],

        actionsTitle: 'Five actions',
        actionsSub: 'Drag one onto a dial or a key, pick the target, done.',
        actions: [
            ['Volume Knob', 'Turn to set the level, press to mute.'],
            ['Volume Button', 'Up, down, or straight to a value — from a key.'],
            ['Mute Toggle', 'One key, showing the state it is really in.'],
            ['Audio Effect', 'Switch a VST/AU effect on a channel.'],
            ['Output Mix', 'Send an output to another mix.']
        ],

        dialTitle: 'Turn to adjust. Press to mute.',
        dialSub: 'The panel above the dial is drawn the way Wave Link draws its own.',
        dialCaptions: ['Quiet', 'Turned up', 'Muted'],
        dialPoints: [
            'Each click moves 1% to 25% — you choose.',
            'The gauge and the reading follow Wave Link live.',
            'Press the dial and the channel mutes.'
        ],

        feedbackTitle: 'The key tells the truth',
        feedbackSub: 'Mute from Wave Link\u2019s own window and the key updates itself.',
        feedbackCaptions: ['Live level', 'Muted', 'Wave Link closed', 'Target gone'],

        setupTitle: 'Two dropdowns. That is the setup.',
        setupSub: 'No title tricks, nothing to copy and paste.',
        setupPoints: [
            'The target list fills itself from Wave Link.',
            'Choosing saves — there is no save button.',
            'Channels, inputs, outputs, mixes, and a channel inside a mix.'
        ],
        setupStatus: 'Controlling: {name}'
    },

    zh: {
        eyebrow: 'STREAM DOCK 插件',
        title: 'Wave Link Control',
        tagline: '把 Elgato Wave Link 3 的调音台搬到 Stream Dock 的旋钮和按键上。',
        chips: ['Windows', '需要 Wave Link 3', '免费开源'],

        actionsTitle: '五个动作',
        actionsSub: '拖到旋钮或按键上，选好目标，就配置完了。',
        actions: [
            ['音量旋钮', '旋转调节音量，按下切换静音。'],
            ['音量按键', '调高、调低，或直接跳到指定音量。'],
            ['静音开关', '一个按键，显示真实的静音状态。'],
            ['音频效果', '开关通道上加载的 VST/AU 效果。'],
            ['输出混音', '把输出设备切换到另一个混音。']
        ],

        dialTitle: '旋转调节，按下静音',
        dialSub: '旋钮上方的面板，按 Wave Link 自己的样子绘制。',
        dialCaptions: ['音量很低', '已调高', '已静音'],
        dialPoints: [
            '每一格调节 1% 到 25%，由你设定。',
            '表盘和读数跟随 Wave Link 实时变化。',
            '按下旋钮即可静音。'
        ],

        feedbackTitle: '按键不会说谎',
        feedbackSub: '在 Wave Link 窗口里静音，按键会自己更新。',
        feedbackCaptions: ['实时音量', '已静音', 'Wave Link 未打开', '目标已消失'],

        setupTitle: '两个下拉框，配置就结束了。',
        setupSub: '不用改标题，也不用复制粘贴任何东西。',
        setupPoints: [
            '目标列表会从 Wave Link 自动填充。',
            '选中即保存，没有保存按钮。',
            '通道、输入设备、输出设备、混音，以及混音中的单个通道。'
        ],
        setupStatus: 'Controlling: {name}'
    }
};

/** Nombre del destino de ejemplo. No se traduce: sale de Wave Link tal cual. */
const SAMPLE_TARGET = 'Music -> Personal Mix';

// ---------------------------------------------------------------------------
// La pagina
// ---------------------------------------------------------------------------

const CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: #0e0f13;
    color: #fff;
    font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  /* Dos luces frias detras de todo, para que el fondo no sea un plano muerto. */
  .glow {
    position: absolute; border-radius: 50%; filter: blur(180px); opacity: .55;
  }
  .glow.a { width: 900px; height: 900px; left: -220px; top: -320px; background: #3a46c8; }
  .glow.b { width: 800px; height: 800px; right: -260px; bottom: -340px; background: #16736f; }

  /* Centrado vertical: el contenido de cada imagen ocupa lo que ocupa, y no
     hay una forma de anclarlo arriba que no deje media imagen vacia. */
  .stage {
    position: relative; width: 100%; height: 100%; padding: 88px 104px;
    display: flex; flex-direction: column; justify-content: center;
  }
  .head { margin-bottom: 74px; }
  .mark { position: absolute; right: 104px; top: 88px; width: 168px; opacity: .95; }

  .eyebrow {
    font-size: 22px; letter-spacing: .42em; color: #8fa0ff; font-weight: 600;
    margin-bottom: 26px;
  }
  h1 { font-size: 104px; line-height: 1; margin: 0 0 26px; font-weight: 800; letter-spacing: -.02em; }
  h2 { font-size: 68px; line-height: 1.1; margin: 0 0 18px; font-weight: 800; letter-spacing: -.015em; }
  .sub { font-size: 30px; line-height: 1.45; color: #b9c0cf; margin: 0; max-width: 1100px; }

  .chips { display: flex; gap: 16px; }
  .chip {
    font-size: 22px; color: #cfd6e6; padding: 12px 24px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.05);
  }

  .face { filter: drop-shadow(0 22px 46px rgba(0,0,0,.6)); }
  .face svg { display: block; width: 100%; height: auto; border-radius: 14px; }

  .caption { font-size: 24px; color: #98a1b3; margin-top: 22px; text-align: center; }
  .name { font-size: 30px; font-weight: 700; margin-top: 26px; }
  .desc { font-size: 22px; line-height: 1.4; color: #98a1b3; margin-top: 10px; }

  ul.points { margin: 0; padding: 0; list-style: none; }
  ul.points li {
    font-size: 28px; line-height: 1.4; color: #cfd6e6; margin-bottom: 30px;
    padding-left: 42px; position: relative;
  }
  ul.points li::before {
    content: ""; position: absolute; left: 0; top: 14px;
    width: 16px; height: 16px; border-radius: 50%; background: #2DBEB9;
  }

  .row { display: flex; align-items: flex-start; }
  .footer {
    position: absolute; left: 104px; bottom: 68px;
  }
`;

/**
 * `before` va **antes** del CSS de la pagina. Ahi entra Bootstrap, que trae su
 * propio reboot: puesto despues le pisaba los tamaños a los titulos.
 */
function page(body, { before = '', after = '' } = {}) {
    return `<!doctype html><html><head><meta charset="utf-8">
<style>${before}</style><style>${CSS}</style><style>${after}</style></head>
<body><div class="glow a"></div><div class="glow b"></div>
<div class="stage">${body}</div></body></html>`;
}

/** La marca, para la esquina de la portada. La genera `npm run icons`. */
function markImage() {
    const file = join(OUT_ROOT, 'product-avatar.png');
    if (!existsSync(file)) return '';
    return `<img class="mark" src="data:image/png;base64,${readFileSync(file).toString('base64')}" alt="">`;
}

/** Mete una cara al ancho pedido; el SVG trae su propia proporcion. */
function tile(svg, width) {
    return `<div class="face" style="width:${width}px">${svg}</div>`;
}

// ---------------------------------------------------------------------------
// Datos de ejemplo para las caras
// ---------------------------------------------------------------------------

const target = (targetType, targetName, level, isMuted = false) =>
    ({ targetType, targetName, level, isMuted });

// ---------------------------------------------------------------------------
// Las cinco imagenes
// ---------------------------------------------------------------------------

function hero(copy) {
    const dial = face.volumeFace(target('channel', 'Music', 0.62), null, 'dial');
    const keys = [
        face.muteFace(target('channel', 'Mic', 0.78, true), null),
        face.volumeFace(target('channel', 'Game', 0.45), null, 'key'),
        face.effectFace({ channelName: 'Mic', effectName: 'Noise Gate', isEnabled: true }),
        face.outputMixFace({
            outputName: 'Headphones',
            currentMixName: 'Stream - Music',
            nextMixName: 'Personal Mix',
            onTarget: true
        })
    ];

    return page(`
    ${markImage()}
    <div class="head">
      <div class="eyebrow">${copy.eyebrow}</div>
      <h1>${copy.title}</h1>
      <p class="sub" style="max-width:1080px">${copy.tagline}</p>
    </div>

    <div class="row" style="gap:52px; align-items:center">
      ${tile(dial, 600)}
      <div class="row" style="gap:32px">${keys.map(k => tile(k, 200)).join('')}</div>
    </div>

    <div class="footer">
      <div class="chips">${copy.chips.map(c => `<div class="chip">${c}</div>`).join('')}</div>
    </div>
  `);
}

function actions(copy) {
    const faces = [
        face.volumeFace(target('channel', 'Music', 0.62), null, 'key'),
        face.volumeButtonFace(target('channel', 'Browser', 0.30), null, '+ 5%'),
        face.muteFace(target('channel', 'Mic', 0.78, true), null),
        face.effectFace({ channelName: 'Mic', effectName: 'Noise Gate', isEnabled: true }),
        face.outputMixFace({
            outputName: 'Headphones',
            currentMixName: 'Stream - Music',
            nextMixName: 'Personal Mix',
            onTarget: true
        })
    ];

    const cards = faces.map((svg, i) => `
      <div style="width:290px">
        ${tile(svg, 250)}
        <div class="name">${copy.actions[i][0]}</div>
        <div class="desc">${copy.actions[i][1]}</div>
      </div>`).join('');

    return page(`
    <div class="head">
      <h2>${copy.actionsTitle}</h2>
      <p class="sub">${copy.actionsSub}</p>
    </div>
    <div class="row" style="gap:38px">${cards}</div>
  `);
}

function dialImage(copy) {
    const states = [
        face.volumeFace(target('channel', 'Music', 0.18), null, 'dial'),
        face.volumeFace(target('mix', 'Personal Mix', 0.74), null, 'dial'),
        face.volumeFace(target('channel', 'Mic', 0.55, true), null, 'dial')
    ];

    const cards = states.map((svg, i) => `
      <div style="width:520px">
        ${tile(svg, 520)}
        <div class="caption">${copy.dialCaptions[i]}</div>
      </div>`).join('');

    return page(`
    <div class="head">
      <h2>${copy.dialTitle}</h2>
      <p class="sub">${copy.dialSub}</p>
    </div>
    <div class="row" style="gap:44px">${cards}</div>
    <ul class="points row" style="gap:56px; margin-top:78px">
      ${copy.dialPoints.map(p => `<li style="flex:1; margin-bottom:0">${p}</li>`).join('')}
    </ul>
  `);
}

function feedback(copy) {
    const faces = [
        face.muteFace(target('channel', 'Mic', 0.78, false), null),
        face.muteFace(target('channel', 'Mic', 0.78, true), null),
        face.unconfiguredFace('No connection', 'key'),
        face.unconfiguredFace('Not found', 'key')
    ];

    const cards = faces.map((svg, i) => `
      <div style="width:300px">
        ${tile(svg, 300)}
        <div class="caption">${copy.feedbackCaptions[i]}</div>
      </div>`).join('');

    return page(`
    <div class="head">
      <h2>${copy.feedbackTitle}</h2>
      <p class="sub">${copy.feedbackSub}</p>
    </div>
    <div class="row" style="gap:70px; justify-content:center">${cards}</div>
  `);
}

// --- la pantalla de configuracion, la de verdad -----------------------------

/**
 * Arma la pantalla de configuracion a partir del `index.html` real.
 *
 * El markup y el CSS se toman tal cual del archivo; lo unico que se inyecta es
 * lo que en vivo pone el plugin — la lista de destinos y el estado — porque sin
 * eso la imagen mostraria una pantalla vacia.
 *
 * Cada reemplazo se verifica: si el markup cambia y alguno deja de aplicar,
 * conviene enterarse aca y no mirando una imagen equivocada en la tienda.
 */
function settingsPanel(lang) {
    const html = readFileSync(join(PLUGIN_ROOT, 'propertyInspector', 'target', 'index.html'), 'utf-8');
    const bootstrap = readFileSync(join(PLUGIN_ROOT, 'propertyInspector', 'utils', 'bootstrap.min.css'), 'utf-8');

    const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
    const start = html.indexOf('<div class="sdpi-wrapper">');
    const end = html.indexOf('<script src=');
    if (!styleMatch || start < 0 || end < 0) throw new Error('no pude leer la pantalla de configuracion');

    let markup = html.slice(start, end).trim();

    // El `body {}` de la pantalla no puede pisar el de la imagen.
    const style = styleMatch[0].replace('body {', '.panel {');
    if (style === styleMatch[0]) throw new Error('la pantalla ya no define body {}');

    const targets = ['Game -> Personal Mix', SAMPLE_TARGET, 'Mic -> Stream - Music', 'Browser -> Personal Mix'];
    const options = targets
        .map(name => `<option value="${name}"${name === SAMPLE_TARGET ? ' selected' : ''}>${name.replace(/>/g, '&gt;')}</option>`)
        .join('\n                ');

    const edits = [
        ['<option value="channelMix">', '<option value="channelMix" selected>'],
        ['<option value="">Select a type first...</option>', options],
        ['id="stepField" hidden', 'id="stepField"'],
        ['id="stepInput" min="1" max="25" step="1"', 'id="stepInput" min="1" max="25" step="1" value="2"']
    ];
    for (const [from, to] of edits) {
        if (!markup.includes(from)) throw new Error(`la pantalla ya no contiene: ${from}`);
        markup = markup.replace(from, to);
    }

    // El estado se arma como lo arma la pantalla en vivo, con la misma plantilla.
    const strings = JSON.parse(readFileSync(join(PLUGIN_ROOT, lang === 'zh' ? 'zh_CN.json' : 'en.json'), 'utf-8')).Localization;
    const status = strings['Controlling: {name}'].replace('{name}', SAMPLE_TARGET);
    markup = markup.replace(
        '<div id="status" class="status">Connecting...</div>',
        `<div id="status" class="status">${status.replace(/>/g, '&gt;')}</div>`
    );

    // Y el resto del texto estatico se traduce igual que lo haria el SDK: nodo de
    // texto completo contra clave completa.
    if (lang === 'zh') {
        for (const [key, value] of Object.entries(strings)) {
            markup = markup.split(`>${key}<`).join(`>${value}<`);
        }
    }

    return { markup, css: `${bootstrap}\n${style.replace(/<\/?style>/g, '')}` };
}

function setup(copy, lang) {
    const panel = settingsPanel(lang);

    return page(`
    <div class="head">
      <h2>${copy.setupTitle}</h2>
      <p class="sub">${copy.setupSub}</p>
    </div>
    <div class="row" style="gap:130px; align-items:center">
      <div class="panel-frame">
        <div class="panel">${panel.markup}</div>
      </div>
      <ul class="points" style="max-width:760px">
        ${copy.setupPoints.map(p => `<li>${p}</li>`).join('')}
      </ul>
    </div>
  `, {
        before: panel.css,
        after: `
    .panel-frame {
      border-radius: 18px; overflow: hidden; width: 620px;
      box-shadow: 0 30px 70px rgba(0,0,0,.6);
      border: 1px solid rgba(255,255,255,.10);
    }
    /* La pantalla real mide poco mas de 300px de ancho: se amplia para que se lea. */
    .panel { zoom: 1.9; padding: 14px 16px 18px; }
  `
    });
}

// ---------------------------------------------------------------------------

const IMAGES = [
    ['1-hero', hero],
    ['2-actions', actions],
    ['3-dial', dialImage],
    ['4-feedback', feedback],
    ['5-setup', setup]
];

const requested = (process.argv.find(arg => arg.startsWith('--lang=')) || '--lang=en').split('=')[1];
const langs = requested === 'all' ? ['en', 'zh'] : [requested];

for (const lang of langs) {
    const copy = COPY[lang];
    if (!copy) {
        console.error(`Idioma desconocido: ${lang}. Hay en, zh y all.`);
        process.exit(1);
    }

    const dir = join(OUT_ROOT, lang);
    mkdirSync(dir, { recursive: true });
    console.log(`\n${lang}:`);

    for (const [name, build] of IMAGES) {
        const out = join(dir, `${name}.png`);
        shoot(build(copy, lang), out);
        console.log(`   ${name}.png  ${(statSync(out).size / 1024).toFixed(0)} KB`);
    }
}

console.log(`\nListo. ${WIDTH}x${HEIGHT} (16:9) en ${OUT_ROOT}`);
console.log('El avatar 480x480 sale de "npm run icons", en store/product-avatar.png');
