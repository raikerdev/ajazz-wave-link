/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

// Same contract as the other inspectors — see propertyInspector/target/index.js.
const $local = true, $back = true, $dom = {
    main: $('.sdpi-wrapper'),
    channel: $('#channelSelect'),
    effect: $('#effectSelect'),
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

/** Every effect loaded anywhere, as the plugin reported it. */
let allEffects = [];
let selected = { channelId: '', channelName: '', effectId: '', effectName: '' };

function setStatus(text, isError = false) {
    $dom.status.textContent = text;
    $dom.status.classList.toggle('error', isError);
}

/** The channels that actually have an effect: the rest would be dead ends. */
function channelsWithEffects() {
    const seen = new Map();
    for (const effect of allEffects) {
        if (!seen.has(effect.channelId)) seen.set(effect.channelId, effect.channelName);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
}

function render() {
    const channels = channelsWithEffects();

    $dom.channel.innerHTML = '';
    $dom.channel.appendChild(new Option(
        channels.length ? t('Select a channel...') : t('(no channel has effects)'), ''
    ));
    for (const channel of channels) {
        const option = new Option(channel.name, channel.id);
        if (channel.id === selected.channelId) option.selected = true;
        $dom.channel.appendChild(option);
    }

    const matching = allEffects.filter(e => e.channelId === $dom.channel.value);
    $dom.effect.innerHTML = '';

    if (!$dom.channel.value) {
        $dom.effect.appendChild(new Option(t('Select a channel first...'), ''));
        return;
    }

    $dom.effect.appendChild(new Option(t('Select an effect...'), ''));
    for (const effect of matching) {
        const option = new Option(effect.effectName, effect.effectId);
        if (effect.effectId === selected.effectId) option.selected = true;
        $dom.effect.appendChild(option);
    }
}

/** Spells out what the key will do. Separate from save(), which persists. */
function describe() {
    if (selected.effectId && selected.effectName) {
        setStatus(t('Toggles "{effect}" on {channel}.', {
            effect: selected.effectName,
            channel: selected.channelName
        }));
    } else if (selected.channelId) {
        setStatus(t('Pick an effect to finish setting this up.'));
    } else {
        setStatus(t('Pick a channel and an effect.'));
    }
}

function save() {
    const channelId = $dom.channel.value;
    const effectId = $dom.effect.value;
    const match = allEffects.find(e => e.channelId === channelId && e.effectId === effectId);

    selected = {
        channelId,
        channelName: match?.channelName || allEffects.find(e => e.channelId === channelId)?.channelName || '',
        effectId,
        effectName: match?.effectName || ''
    };
    $websocket.saveData(selected);
    describe();
}

$dom.channel.addEventListener('change', () => {
    // `render()` rebuilds this dropdown from `selected`, so the new choice has to
    // land there first or it would be reverted. A different channel also
    // invalidates the effect chosen on the previous one.
    selected = { ...selected, channelId: $dom.channel.value, effectId: '', effectName: '' };
    render();
    save();
});
$dom.effect.addEventListener('change', save);

const $propEvent = {
    didReceiveGlobalSettings() { },

    didReceiveSettings({ settings }) {
        if (!settings) return;
        selected = { ...selected, ...settings };
        render();
    },

    sendToPropertyInspector(payload) {
        if (payload?.type !== 'targets') return;

        allEffects = payload.effects || [];
        if (payload.settings) selected = { ...selected, ...payload.settings };
        render();

        if (!payload.connected) {
            setStatus(t('Wave Link is not connected. Open it, then reopen this panel.'), true);
        } else if (!allEffects.length) {
            // Worth spelling out: Wave Link has no effects of its own to offer.
            setStatus(t('No effects loaded. Add one to a channel in Wave Link first.'), true);
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
