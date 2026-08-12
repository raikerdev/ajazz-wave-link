/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

// Same contract as the other inspector — see propertyInspector/target/index.js.
const $local = true, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    output: $('#outputSelect'),
    mix: $('#mixSelect'),
    altMix: $('#altMixSelect'),
    status: $('#status')
};

window.connectMiraBoxSDSocket = connectElgatoStreamDeckSocket;

/** Translates a string built at runtime. See propertyInspector/target/index.js. */
function t(text, vars) {
    let out = $lang?.[text] || text;
    for (const [key, value] of Object.entries(vars || {})) {
        out = out.split(`{${key}}`).join(value);
    }
    return out;
}

/** Outputs and mixes, taken from the same target list the other inspector uses. */
let outputs = [];
let mixes = [];
let selected = { outputId: '', outputName: '', mixId: '', mixName: '', altMixId: '', altMixName: '' };

function setStatus(text, isError = false) {
    $dom.status.textContent = text;
    $dom.status.classList.toggle('error', isError);
}

function fill(select, items, placeholder, selectedId) {
    select.innerHTML = '';
    select.appendChild(new Option(placeholder, ''));
    for (const item of items) {
        const option = new Option(item.targetName, item.targetId);
        if (item.targetId === selectedId) option.selected = true;
        select.appendChild(option);
    }
}

function render() {
    fill($dom.output, outputs, outputs.length ? t('Select an output...') : t('(no outputs)'), selected.outputId);
    fill($dom.mix, mixes, t('Select a mix...'), selected.mixId);
    fill($dom.altMix, mixes, t('(none)'), selected.altMixId);
}

const nameOf = (list, id) => list.find(i => i.targetId === id)?.targetName || '';

function save() {
    selected = {
        outputId: $dom.output.value,
        outputName: nameOf(outputs, $dom.output.value),
        mixId: $dom.mix.value,
        mixName: nameOf(mixes, $dom.mix.value),
        altMixId: $dom.altMix.value,
        altMixName: nameOf(mixes, $dom.altMix.value)
    };
    $websocket.saveData(selected);
    describe();
}

/** Spells out what the key will do, so the alternate-mix behaviour is not a surprise. */
function describe() {
    if (!selected.outputId || !selected.mixId) {
        setStatus(t('Pick an output and a mix.'));
        return;
    }
    const output = selected.outputName || t('the output');
    if (selected.altMixId && selected.altMixId !== selected.mixId) {
        setStatus(t('Flips {output} between "{a}" and "{b}".', { output, a: selected.mixName, b: selected.altMixName }));
    } else {
        setStatus(t('Sends {output} to "{mix}".', { output, mix: selected.mixName }));
    }
}

$dom.output.addEventListener('change', save);
$dom.mix.addEventListener('change', save);
$dom.altMix.addEventListener('change', save);

const $propEvent = {
    didReceiveGlobalSettings() { },

    didReceiveSettings({ settings }) {
        if (!settings) return;
        selected = { ...selected, ...settings };
        render();
        describe();
    },

    sendToPropertyInspector(payload) {
        if (payload?.type !== 'targets') return;

        const targets = payload.targets || [];
        outputs = targets.filter(t => t.targetType === 'output');
        mixes = targets.filter(t => t.targetType === 'mix');

        if (payload.settings) selected = { ...selected, ...payload.settings };
        render();

        if (!payload.connected) {
            setStatus(t('Wave Link is not connected. Open it, then reopen this panel.'), true);
        } else {
            describe();
        }
    }
};

// The socket opens when the host calls the entry function, after this script runs.
(function requestTargets(attempt = 0) {
    if ($websocket?.readyState === WebSocket.OPEN) {
        $websocket.sendToPlugin({ type: 'getTargets' });
        return;
    }
    if (attempt > 100) {
        setStatus(t('Could not reach the plugin.'), true);
        return;
    }
    setTimeout(() => requestTargets(attempt + 1), 50);
})();
