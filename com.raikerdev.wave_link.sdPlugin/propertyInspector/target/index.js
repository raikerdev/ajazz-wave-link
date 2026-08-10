/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

// $local: run the SDK's automatic text translation. Off, because this inspector
//         ships its labels already written and the translator rewrites every text
//         node to `undefined` when a key is missing from the language file.
// $back:  we decide when the form becomes visible. It is visible from the start,
//         so we never depend on `didReceiveSettings` arriving to show anything.
// $dom:   static elements, looked up once.
const $local = false, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    type: $('#typeSelect'),
    target: $('#targetSelect'),
    status: $('#status')
};

// The AJAZZ host has been observed calling this name instead of the Elgato one
// that utils/action.js declares. Aliasing covers both host versions.
window.connectMiraBoxSDSocket = connectElgatoStreamDeckSocket;

/** Everything the plugin last told us about Wave Link. */
let allTargets = [];
/** The selection currently persisted for this action instance. */
let selected = { targetType: '', targetId: '', targetName: '' };

function setStatus(text, isError = false) {
    $dom.status.textContent = text;
    $dom.status.classList.toggle('error', isError);
}

/** Rebuilds the Destino dropdown from the targets matching the chosen Tipo. */
function renderTargets() {
    const type = $dom.type.value;
    $dom.target.innerHTML = '';

    if (!type) {
        $dom.target.appendChild(new Option('Selecciona un tipo primero...', ''));
        return;
    }

    const matching = allTargets.filter(t => t.targetType === type);
    if (!matching.length) {
        $dom.target.appendChild(new Option('(sin destinos de este tipo)', ''));
        return;
    }

    $dom.target.appendChild(new Option('Selecciona un destino...', ''));
    for (const t of matching) {
        const option = new Option(t.targetName, t.targetId);
        if (t.targetId === selected.targetId) option.selected = true;
        $dom.target.appendChild(option);
    }
}

/** Persists the current dropdown state through the host. */
function save() {
    const targetType = $dom.type.value;
    const targetId = $dom.target.value;
    const match = allTargets.find(t => t.targetType === targetType && t.targetId === targetId);

    selected = { targetType, targetId, targetName: match ? match.targetName : '' };
    $websocket.saveData(selected);

    if (match) setStatus(`Guardado: ${match.targetName}`);
    else if (targetType) setStatus('Elegi un destino para terminar de configurar.');
    else setStatus('Elegi un tipo y un destino.');
}

$dom.type.addEventListener('change', () => {
    // A new Tipo invalidates the previous Destino.
    selected = { targetType: $dom.type.value, targetId: '', targetName: '' };
    renderTargets();
    save();
});
$dom.target.addEventListener('change', save);

const $propEvent = {
    didReceiveGlobalSettings() { },

    didReceiveSettings({ settings }) {
        if (!settings) return;
        selected = { targetType: '', targetId: '', targetName: '', ...settings };
        $dom.type.value = selected.targetType || '';
        renderTargets();
    },

    sendToPropertyInspector(payload) {
        if (payload?.type !== 'targets') return;

        allTargets = payload.targets || [];
        if (payload.settings) {
            selected = { targetType: '', targetId: '', targetName: '', ...payload.settings };
            $dom.type.value = selected.targetType || '';
        }
        renderTargets();

        if (!payload.connected) {
            setStatus('Wave Link no esta conectado. Abrilo y volve a abrir esta ventana.', true);
        } else if (selected.targetName) {
            setStatus(`Controlando: ${selected.targetName}`);
        } else {
            setStatus(`${allTargets.length} destinos disponibles.`);
        }
    }
};

// utils/action.js opens the socket when the host calls the entry function, which
// happens after this script runs, so wait for it before asking for the targets.
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
