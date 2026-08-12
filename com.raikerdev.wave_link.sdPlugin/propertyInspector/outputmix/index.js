/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

// Same contract as the other inspector — see propertyInspector/target/index.js
// for why $local is off and $back is on.
const $local = false, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    output: $('#outputSelect'),
    mix: $('#mixSelect'),
    altMix: $('#altMixSelect'),
    status: $('#status')
};

window.connectMiraBoxSDSocket = connectElgatoStreamDeckSocket;

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
    fill($dom.output, outputs, outputs.length ? 'Selecciona una salida...' : '(sin salidas)', selected.outputId);
    fill($dom.mix, mixes, 'Selecciona un mix...', selected.mixId);
    fill($dom.altMix, mixes, '(ninguno)', selected.altMixId);
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
        setStatus('Elegi una salida y un mix.');
        return;
    }
    const output = selected.outputName || 'la salida';
    if (selected.altMixId && selected.altMixId !== selected.mixId) {
        setStatus(`Alterna ${output} entre "${selected.mixName}" y "${selected.altMixName}".`);
    } else {
        setStatus(`Manda ${output} a "${selected.mixName}".`);
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
            setStatus('Wave Link no esta conectado. Abrilo y volve a abrir esta ventana.', true);
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
        setStatus('No se pudo conectar con el plugin.', true);
        return;
    }
    setTimeout(() => requestTargets(attempt + 1), 50);
})();
