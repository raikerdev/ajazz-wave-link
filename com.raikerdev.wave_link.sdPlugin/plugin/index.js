const { Plugins, Actions, log } = require('./utils/plugin');
const { WaveLinkClient } = require('./wavelink/client');

const plugin = new Plugins('wave_link');
const wavelink = new WaveLinkClient(log);

/** How much one dial detent moves the fader, as a fraction of the full range. */
const STEP_PER_TICK = 0.02;

/** Context of the property inspector that is currently open, if any. */
let piContext = null;

const DEFAULT_SETTINGS = { targetType: '', targetId: '', targetName: '' };

/**
 * Resolves the live Wave Link target an action instance points at.
 * Events carry their own settings, which are fresher than the cached copy the
 * Actions base class keeps, so they win when present.
 */
function resolveTarget(action, { context, payload }) {
    const settings = payload?.settings || action.data[context] || DEFAULT_SETTINGS;
    const { targetType, targetId } = settings;
    if (!targetType || !targetId) return undefined;
    return wavelink.getTarget(targetType, targetId);
}

/** Flashes the key and logs why an action could not act. */
function reportUnavailable(context) {
    const reason = wavelink.isReady()
        ? 'not configured, or its target is gone from Wave Link'
        : 'Wave Link is not connected';
    log.info(`action at ${context} did nothing: ${reason}`);
    plugin.showAlert(context);
}

async function toggleMute(action, event) {
    const { context } = event;
    const target = resolveTarget(action, event);
    if (!target) {
        reportUnavailable(context);
        return;
    }
    try {
        await wavelink.setMuted(target.targetType, target.targetId, !target.isMuted);
    } catch (err) {
        log.error(`setMuted failed for ${target.targetName}: ${err.message}`);
        plugin.showAlert(context);
    }
}

/** Points a Mute Toggle's icon at the real mute state of the target in `settings`. */
function paintMuteState(context, settings) {
    const { targetType, targetId } = settings || {};
    if (!targetType || !targetId) return;
    const target = wavelink.getTarget(targetType, targetId);
    if (target) plugin.setState(context, target.isMuted ? 1 : 0);
}

/** Repaints every visible Mute Toggle, e.g. after Wave Link reports a change. */
function syncMuteToggles() {
    if (!plugin.mutetoggle) return;
    for (const [context, settings] of Object.entries(plugin.mutetoggle.data)) {
        paintMuteState(context, settings);
    }
}

/**
 * Hands the open property inspector the live list of things it can bind to, plus
 * the settings already stored for that instance. Sending both together means the
 * inspector can render its dropdowns from a single message.
 */
function pushTargets() {
    const actionKey = Actions.currentAction?.split('.').pop();
    const settings = plugin[actionKey]?.data[Actions.currentContext] || DEFAULT_SETTINGS;
    plugin.sendToPropertyInspector({
        type: 'targets',
        connected: wavelink.isReady(),
        targets: wavelink.getTargets(),
        settings
    });
}

wavelink.on('ready', () => {
    syncMuteToggles();
    // A property inspector opened before Wave Link was up would have got an empty list.
    if (piContext) pushTargets();
});
wavelink.on('changed', syncMuteToggles);

wavelink.start();

// ---------------------------------------------------------------------------
// Actions. The host dispatches on the last segment of the action UUID, so these
// property names must match "com.raikerdev.wave_link.<name>" in the manifest.
// ---------------------------------------------------------------------------

/** Behaviour every target-bound action shares: it owns settings and feeds the property inspector. */
function targetActionBase() {
    return {
        default: { ...DEFAULT_SETTINGS },

        _propertyInspectorDidAppear({ context }) {
            piContext = context;
        },

        propertyInspectorDidDisappear() {
            piContext = null;
        },

        sendToPlugin({ payload }) {
            if (payload?.type === 'getTargets') pushTargets();
        }
    };
}

plugin.volumeknob = new Actions({
    ...targetActionBase(),

    dialRotate(event) {
        const { context, payload } = event;
        const target = resolveTarget(this, event);
        if (!target) {
            reportUnavailable(context);
            return;
        }
        const next = target.level + payload.ticks * STEP_PER_TICK;
        wavelink.setLevel(target.targetType, target.targetId, next).catch(err => {
            log.error(`setLevel failed for ${target.targetName}: ${err.message}`);
            plugin.showAlert(context);
        });
    },

    // Pressing the dial, or the key when this action sits on a keypad, toggles mute.
    dialUp(event) {
        toggleMute(this, event);
    },

    keyUp(event) {
        toggleMute(this, event);
    }
});

plugin.mutetoggle = new Actions({
    ...targetActionBase(),

    // Paint the right icon as soon as the key appears, and again whenever the
    // property inspector points it at a different target.
    _willAppear({ context, payload }) {
        paintMuteState(context, payload?.settings);
    },

    _didReceiveSettings({ context, payload }) {
        paintMuteState(context, payload?.settings);
    },

    async keyUp(event) {
        await toggleMute(this, event);
        // Wave Link echoes the change back as a notification, which repaints the
        // icon through syncMuteToggles — no optimistic setState needed here.
    }
});
