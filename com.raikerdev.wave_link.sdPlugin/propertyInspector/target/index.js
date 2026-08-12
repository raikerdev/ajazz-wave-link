/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

// $local: run the SDK's automatic text translation over the static markup. The
//         source text is English and each language file maps it in its
//         Localization block. Beware: the SDK's walker writes `undefined` for any
//         string it cannot find, so every text node needs a key.
// $back:  we decide when the form becomes visible. It is visible from the start,
//         so we never depend on `didReceiveSettings` arriving to show anything.
// $dom:   static elements, looked up once.
const $local = true, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    type: $('#typeSelect'),
    target: $('#targetSelect'),
    modeField: $('#modeField'),
    mode: $('#modeSelect'),
    stepField: $('#stepField'),
    stepLabel: $('label[for="stepInput"]'),
    step: $('#stepInput'),
    levelField: $('#levelField'),
    level: $('#levelInput'),
    status: $('#status')
};

/** Fallbacks for when a field has never been set, or was left empty. */
const DEFAULT_STEP = 2;
const DEFAULT_BUTTON_STEP = 5;
const DEFAULT_LEVEL = 50;

/**
 * Translates a string built at runtime, which the SDK's walker never sees
 * because it only runs once over the static markup.
 *
 * Falls back to the English source rather than to `undefined`: a missing key
 * should read a bit foreign, not broken. `$lang` arrives asynchronously, so
 * early calls legitimately fall back too.
 *
 * @param {string} text English source, with `{placeholders}`
 * @param {Record<string, string|number>} [vars]
 */
function t(text, vars) {
    let out = $lang?.[text] || text;
    for (const [key, value] of Object.entries(vars || {})) {
        out = out.split(`{${key}}`).join(value);
    }
    return out;
}

/**
 * Wraps the SDK's entry point so the form can lay itself out the moment the host
 * connects. `utils/action.js` sets `$action` synchronously before it opens the
 * socket, so by the time the wrapper returns we know which action this is.
 *
 * Doing it here rather than after the first reply matters: otherwise the fields
 * stay hidden whenever the plugin is slow to answer, or never answers.
 *
 * The AJAZZ host has been observed calling `connectMiraBoxSDSocket` instead of
 * the Elgato name, so both point at the wrapper.
 */
const hostConnect = connectElgatoStreamDeckSocket;
window.connectMiraBoxSDSocket = window.connectElgatoStreamDeckSocket = function (...args) {
    const result = hostConnect.apply(this, args);
    applyActionVisibility();
    return result;
};

/** Everything the plugin last told us about Wave Link. */
let allTargets = [];
/** The selection currently persisted for this action instance. */
let selected = { targetType: '', targetId: '', targetName: '' };

/** Which action this inspector was opened for — the last segment of its UUID. */
const actionName = () => String($action || '').split('.').pop();

/**
 * Three actions share this page, so each field appears only where it means
 * something. `$action` is set by utils/action.js when the host connects.
 */
function applyActionVisibility() {
    const action = actionName();
    const isKnob = action === 'volumeknob';
    const isButton = action === 'volumebutton';
    const mode = $dom.mode.value;

    $dom.modeField.hidden = !isButton;
    // A step is a step whether it comes from a detent or a press; only the wording differs.
    $dom.stepField.hidden = !(isKnob || (isButton && mode !== 'set'));
    $dom.stepLabel.textContent = isKnob ? t('Step per click (%)') : t('Step (%)');
    $dom.levelField.hidden = !(isButton && mode === 'set');
}

/** Mirrors the settings onto the controls. */
function restore(settings) {
    const stepDefault = actionName() === 'volumebutton' ? DEFAULT_BUTTON_STEP : DEFAULT_STEP;
    selected = { targetType: '', targetId: '', targetName: '', ...settings };
    $dom.type.value = selected.targetType || '';
    $dom.mode.value = selected.mode || 'up';
    $dom.step.value = selected.stepPercent ?? stepDefault;
    $dom.level.value = selected.levelPercent ?? DEFAULT_LEVEL;
    applyActionVisibility();
}

function setStatus(text, isError = false) {
    $dom.status.textContent = text;
    $dom.status.classList.toggle('error', isError);
}

/** Rebuilds the Target dropdown from the targets matching the chosen Type. */
function renderTargets() {
    const type = $dom.type.value;
    $dom.target.innerHTML = '';

    if (!type) {
        $dom.target.appendChild(new Option(t('Select a type first...'), ''));
        return;
    }

    const matching = allTargets.filter(item => item.targetType === type);
    if (!matching.length) {
        $dom.target.appendChild(new Option(t('(nothing of this type)'), ''));
        return;
    }

    $dom.target.appendChild(new Option(t('Select a target...'), ''));
    for (const item of matching) {
        const option = new Option(item.targetName, item.targetId);
        if (item.targetId === selected.targetId) option.selected = true;
        $dom.target.appendChild(option);
    }
}

/** Persists the current state of the controls through the host. */
function save() {
    const targetType = $dom.type.value;
    const targetId = $dom.target.value;
    const match = allTargets.find(item => item.targetType === targetType && item.targetId === targetId);

    const stepDefault = actionName() === 'volumebutton' ? DEFAULT_BUTTON_STEP : DEFAULT_STEP;
    const level = Number($dom.level.value);

    selected = {
        targetType,
        targetId,
        targetName: match ? match.targetName : '',
        mode: $dom.mode.value,
        // An empty or nonsense box falls back rather than writing a broken value.
        stepPercent: Math.min(25, Math.max(1, Number($dom.step.value) || stepDefault)),
        // 0 is a legitimate level, so this cannot lean on `||`.
        levelPercent: Math.min(100, Math.max(0, Number.isFinite(level) && $dom.level.value !== '' ? level : DEFAULT_LEVEL))
    };
    $websocket.saveData(selected);

    if (match) setStatus(t('Saved: {name}', { name: match.targetName }));
    else if (targetType) setStatus(t('Pick a target to finish setting this up.'));
    else setStatus(t('Pick a type and a target.'));
}

$dom.type.addEventListener('change', () => {
    // A new Type invalidates the previous Target.
    selected = { ...selected, targetType: $dom.type.value, targetId: '', targetName: '' };
    renderTargets();
    save();
});
$dom.target.addEventListener('change', save);
// `change` and not `input`: typing "15" would otherwise save "1" on the way.
$dom.step.addEventListener('change', save);
$dom.level.addEventListener('change', save);
$dom.mode.addEventListener('change', () => {
    // Switching between adjusting and setting swaps which number is on screen.
    applyActionVisibility();
    save();
});

const $propEvent = {
    didReceiveGlobalSettings() { },

    didReceiveSettings({ settings }) {
        if (!settings) return;
        restore(settings);
        renderTargets();
    },

    sendToPropertyInspector(payload) {
        if (payload?.type !== 'targets') return;

        allTargets = payload.targets || [];
        if (payload.settings) restore(payload.settings);
        renderTargets();

        if (!payload.connected) {
            setStatus(t('Wave Link is not connected. Open it, then reopen this panel.'), true);
        } else if (selected.targetName) {
            setStatus(t('Controlling: {name}', { name: selected.targetName }));
        } else {
            setStatus(t('{count} targets available.', { count: allTargets.length }));
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
        setStatus(t('Could not reach the plugin.'), true);
        return;
    }
    setTimeout(() => requestTargets(attempt + 1), 50);
})();
