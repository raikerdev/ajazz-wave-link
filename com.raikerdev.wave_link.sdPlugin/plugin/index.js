const { Plugins, Actions, log } = require('./utils/plugin');
const { WaveLinkClient } = require('./wavelink/client');
const devMode = require('./dev/devMode');

/**
 * The artwork module. Normally the bundled one; with a `dev.json` present it is
 * swapped for the copy on disk and reloaded on every save (see dev/devMode.js).
 */
let render = require('./render/keyFace');

const plugin = new Plugins('wave_link');
const wavelink = new WaveLinkClient(log);

/** How much one dial detent moves the fader, in percent, when nothing is configured. */
const DEFAULT_STEP_PERCENT = 2;

/** Bounds for the configured step. Below 1 the dial feels dead, above 25 it is unusable. */
const MIN_STEP_PERCENT = 1;
const MAX_STEP_PERCENT = 25;

/**
 * Floor between repaints. Wave Link emits a notification per level change, so a
 * fast spin would otherwise push dozens of images per second down the socket.
 */
const REPAINT_INTERVAL_MS = 100;

/** Context of the property inspector that is currently open, if any. */
let piContext = null;

/**
 * Which surface each visible Volume Knob lives on, keyed by context.
 * The strip above a dial is 2:1 while a key is square, so they need different
 * artwork. Only `willAppear` reports the controller, hence the bookkeeping.
 */
const surfaceOf = new Map();

/** Filled in below; inert unless a `dev.json` turns live-reload on. */
let dev = { active: false, calibrate: false };

const DEFAULT_SETTINGS = { targetType: '', targetId: '', targetName: '', stepPercent: DEFAULT_STEP_PERCENT };

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

/**
 * How far one detent moves the fader, as a 0..1 fraction.
 * Clamped here too, not only in the inspector: settings are persisted by the host
 * and could have been written by an older build or edited by hand.
 */
function stepFraction(settings) {
    const percent = Number(settings?.stepPercent) || DEFAULT_STEP_PERCENT;
    return Math.min(MAX_STEP_PERCENT, Math.max(MIN_STEP_PERCENT, percent)) / 100;
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

/** Draws a Mute Toggle's key face: the speaker, and the level in a supporting role. */
function paintMuteToggle(context, settings) {
    const { targetType, targetId } = settings || {};

    if (!targetType || !targetId) {
        plugin.setImage(context, render.toDataUri(render.unconfiguredFace('Sin destino')));
        return;
    }

    const target = wavelink.getTarget(targetType, targetId);
    if (!target) {
        const why = wavelink.isReady() ? 'No existe' : 'Sin conexión';
        plugin.setImage(context, render.toDataUri(render.unconfiguredFace(why)));
        return;
    }

    // The drawn face is what the user sees, but the state is still set: it is the
    // host's own notion of mute, and it survives if the image ever fails to render.
    plugin.setState(context, target.isMuted ? 1 : 0);

    const icon = wavelink.getIcon(targetType, targetId);
    plugin.setImage(context, render.toDataUri(render.muteFace(target, icon)));
}

/** Draws a Volume Knob's face: the target's icon, its level and its mute state. */
function paintVolumeKnob(context, settings) {
    const surface = surfaceOf.get(context) || 'key';

    if (dev.calibrate) {
        plugin.setImage(context, render.toDataUri(render.calibrationFace(surface)));
        return;
    }

    const { targetType, targetId } = settings || {};

    if (!targetType || !targetId) {
        plugin.setImage(context, render.toDataUri(render.unconfiguredFace('Sin destino', surface)));
        return;
    }

    const target = wavelink.getTarget(targetType, targetId);
    if (!target) {
        const why = wavelink.isReady() ? 'No existe' : 'Sin conexión';
        plugin.setImage(context, render.toDataUri(render.unconfiguredFace(why, surface)));
        return;
    }

    const icon = wavelink.getIcon(targetType, targetId);
    plugin.setImage(context, render.toDataUri(render.volumeFace(target, icon, surface)));
}

/**
 * Works out what an Output Mix key is looking at and what pressing it will do.
 *
 * With only a primary mix the key is a plain "send it there". With an alternate
 * as well it flips between the two, which is the point: one key to move the
 * headphones between what you monitor and what goes out to the stream.
 */
function resolveOutputMix(settings) {
    const { outputId, mixId, mixName, altMixId, altMixName } = settings || {};
    if (!outputId || !mixId) return undefined;

    const output = wavelink.getTarget('output', outputId);
    if (!output) return undefined;

    const currentMixId = wavelink.getOutputMix(outputId);
    const onTarget = currentMixId === mixId;
    const currentMix = currentMixId ? wavelink.getTarget('mix', currentMixId) : undefined;

    // Pressing goes to the alternate only when we are already sitting on the primary.
    const nextId = altMixId && onTarget ? altMixId : mixId;
    const nextName = altMixId && onTarget ? altMixName : mixName;

    return {
        outputName: output.targetName,
        currentMixName: currentMix?.targetName || '',
        nextMixId: nextId,
        nextMixName: nextId === currentMixId ? '' : nextName,
        onTarget
    };
}

/** Draws an Output Mix key: the output, the mix feeding it, and where it will go. */
function paintOutputMix(context, settings) {
    const state = resolveOutputMix(settings);
    if (!state) {
        const why = !settings?.outputId || !settings?.mixId
            ? 'Sin destino'
            : (wavelink.isReady() ? 'No existe' : 'Sin conexión');
        plugin.setImage(context, render.toDataUri(render.unconfiguredFace(why)));
        return;
    }
    plugin.setImage(context, render.toDataUri(render.outputMixFace(state)));
}

let repaintTimer = null;
let repaintQueued = false;

/** Redraws everything currently on screen. Both actions now show a live level. */
function repaintAll() {
    if (plugin.volumeknob) {
        for (const [context, settings] of Object.entries(plugin.volumeknob.data)) {
            paintVolumeKnob(context, settings);
        }
    }
    if (plugin.mutetoggle) {
        for (const [context, settings] of Object.entries(plugin.mutetoggle.data)) {
            paintMuteToggle(context, settings);
        }
    }
    if (plugin.outputmix) {
        for (const [context, settings] of Object.entries(plugin.outputmix.data)) {
            paintOutputMix(context, settings);
        }
    }
}

/**
 * Repaints at most once per `REPAINT_INTERVAL_MS`. Leading edge, so the first
 * turn of the dial shows up immediately, plus one trailing pass so the final
 * resting value is never the one that got dropped.
 */
function requestRepaint() {
    if (repaintTimer) {
        repaintQueued = true;
        return;
    }

    repaintAll();

    repaintTimer = setTimeout(() => {
        repaintTimer = null;
        if (repaintQueued) {
            repaintQueued = false;
            requestRepaint();
        }
    }, REPAINT_INTERVAL_MS);
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

// Live-reload the artwork while iterating on it. No-op in a normal install.
dev = devMode.start(reloaded => {
    render = reloaded;
    requestRepaint();
}, log);
if (dev.renderer) render = dev.renderer;

wavelink.on('ready', () => {
    requestRepaint();
    // A property inspector opened before Wave Link was up would have got an empty list.
    if (piContext) pushTargets();
});

wavelink.on('changed', requestRepaint);

// Nothing can be read while disconnected, so the keys say so instead of lying.
wavelink.on('disconnected', requestRepaint);

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

    // Draw the real level as soon as the key appears, and again whenever the
    // property inspector points it somewhere else.
    _willAppear({ context, payload }) {
        surfaceOf.set(context, payload?.controller === 'Knob' ? 'dial' : 'key');
        paintVolumeKnob(context, payload?.settings);
    },

    _willDisappear({ context }) {
        surfaceOf.delete(context);
    },

    _didReceiveSettings({ context, payload }) {
        paintVolumeKnob(context, payload?.settings);
    },

    dialRotate(event) {
        const { context, payload } = event;
        const target = resolveTarget(this, event);
        if (!target) {
            reportUnavailable(context);
            return;
        }
        const step = stepFraction(payload?.settings || this.data[context]);
        // Accumulates the detents and writes once the spin settles, so turning fast
        // does not compute every step from a level Wave Link has not caught up to.
        wavelink.nudgeLevel(target.targetType, target.targetId, payload.ticks * step);
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

    // Paint the right face as soon as the key appears, and again whenever the
    // property inspector points it at a different target.
    _willAppear({ context, payload }) {
        paintMuteToggle(context, payload?.settings);
    },

    _didReceiveSettings({ context, payload }) {
        paintMuteToggle(context, payload?.settings);
    },

    async keyUp(event) {
        await toggleMute(this, event);
        // Wave Link echoes the change back as a notification, which repaints the
        // face through requestRepaint — no optimistic painting needed here.
    }
});

plugin.outputmix = new Actions({
    ...targetActionBase(),
    default: { outputId: '', outputName: '', mixId: '', mixName: '', altMixId: '', altMixName: '' },

    _willAppear({ context, payload }) {
        paintOutputMix(context, payload?.settings);
    },

    _didReceiveSettings({ context, payload }) {
        paintOutputMix(context, payload?.settings);
    },

    keyUp(event) {
        const { context, payload } = event;
        const settings = payload?.settings || this.data[context];
        const state = resolveOutputMix(settings);

        if (!state) {
            reportUnavailable(context);
            return;
        }

        wavelink.setOutputMix(settings.outputId, state.nextMixId).catch(err => {
            log.error(`setOutputMix failed for ${state.outputName}: ${err.message}`);
            plugin.showAlert(context);
        });
    }
});
