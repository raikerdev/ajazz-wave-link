const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const WebSocket = require('ws');

const {
    CHANNEL_MIX_SEPARATOR,
    CHANNEL_MIX_NAME_SEPARATOR
} = require('./types');

/**
 * Wave Link 3 ships as a UWP package and writes the port of its local JSON-RPC
 * server here on every launch. The port is dynamic (it has been observed in the
 * 64000s), so it must be read at connect time — it is not the 1884-1893 range
 * that community libraries document for older Wave Link versions.
 */
const WS_INFO_PATH = join(
    process.env.LOCALAPPDATA || '',
    'Packages',
    'Elgato.WaveLink_g54w8ztgkx496',
    'LocalState',
    'ws-info.json'
);

/** Safety net only: the documented legacy range, never actually needed on this machine. */
const FALLBACK_PORTS = Array.from({ length: 10 }, (_, i) => 1884 + i);

const RECONNECT_DELAY_MS = 3000;
const CALL_TIMEOUT_MS = 5000;

/** How long ticks pile up before one write goes out. One frame's worth. */
const LEVEL_FLUSH_MS = 40;

/**
 * How long an optimistic level survives without Wave Link agreeing. Long enough
 * to cover a slow round trip, short enough that a rejected write self-corrects.
 */
const LEVEL_SETTLE_MS = 1500;

/** Levels are floats; anything under this counts as "Wave Link caught up". */
const LEVEL_EPSILON = 0.005;

/**
 * The protocol generation this plugin was written against, as reported by
 * `getApplicationInfo`. Wave Link 3.2.10 reports 2. A different number does not
 * necessarily break anything, but it is the first thing to suspect if it does.
 */
const EXPECTED_INTERFACE_REVISION = 2;

function discoverPort() {
    try {
        const parsed = JSON.parse(readFileSync(WS_INFO_PATH, 'utf-8'));
        if (parsed.port) return parsed.port;
    } catch {
        // Wave Link is not running, or has never run; the caller falls back to a port scan
    }
    return undefined;
}

function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}

/**
 * An input's gain comes in the device's own range, not necessarily 0..1.
 * Falls back to 0..1 when the bounds are missing or nonsensical.
 */
function gainRange(gain) {
    const min = Number.isFinite(gain?.min) ? gain.min : 0;
    const max = Number.isFinite(gain?.max) ? gain.max : 1;
    return max > min ? { min, max } : { min: 0, max: 1 };
}

/** Device range → the 0..1 the rest of the plugin speaks in. */
function normalizeGain(gain) {
    const { min, max } = gainRange(gain);
    const value = Number.isFinite(gain?.value) ? gain.value : min;
    return clamp01((value - min) / (max - min));
}

/** 0..1 → the value the device expects back. */
function denormalizeGain(gain, fraction) {
    const { min, max } = gainRange(gain);
    return min + clamp01(fraction) * (max - min);
}

/**
 * Folds a partial update into a list of things that have ids.
 *
 * Needed because `outputDeviceChanged` and `inputDeviceChanged` echo back **only
 * the entry that moved, and only the fields that moved** — a level change arrives
 * as `[{id, name, level}]` with no `isMuted` and no `mixId`. Replacing the cached
 * array with that wipes both, and drops every sibling the device still has.
 * (`channelChanged` is not like this: it sends its `mixes` complete.)
 */
function mergeById(existing = [], incoming = []) {
    const merged = existing.map(item => {
        const update = incoming.find(candidate => candidate.id === item.id);
        return update ? { ...item, ...update } : item;
    });

    for (const item of incoming) {
        if (!merged.some(m => m.id === item.id)) merged.push(item);
    }

    return merged;
}

/**
 * Talks JSON-RPC 2.0 over a WebSocket to the local Wave Link 3 instance.
 *
 * Emits `ready` once a snapshot has loaded, `changed` whenever Wave Link pushes
 * a mutation, and `disconnected` when the socket drops.
 */
class WaveLinkClient extends EventEmitter {
    constructor(log) {
        super();
        this.log = log;
        this.ws = undefined;
        this.nextId = 1;
        this.pending = new Map();
        this.channels = [];
        this.inputDevices = [];
        this.outputDevices = [];
        this.mixes = [];
        this.connecting = false;
        /** Levels we have asked for but Wave Link has not confirmed yet. */
        this.optimistic = new Map();
        /** Flattened targets and their index, rebuilt only when the cache moves. */
        this.targetList = undefined;
        this.targetIndex = undefined;
    }

    /** Called on every cache mutation: the next read rebuilds the flat list. */
    invalidateTargets() {
        this.targetList = undefined;
        this.targetIndex = undefined;
    }

    start() {
        this.connect();
    }

    async connect() {
        if (this.connecting) return;
        this.connecting = true;

        const candidatePorts = [discoverPort(), ...FALLBACK_PORTS].filter(p => typeof p === 'number');

        for (const port of candidatePorts) {
            if (await this.tryConnect(port)) {
                this.connecting = false;
                return;
            }
        }

        this.connecting = false;
        this.log.info(`wavelink: no server on any candidate port, retrying in ${RECONNECT_DELAY_MS}ms`);
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
    }

    tryConnect(port) {
        return new Promise(resolveOuter => {
            // Wave Link only accepts the handshake from a Stream Deck-looking origin.
            const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
                headers: { Origin: 'streamdeck://' }
            });

            let settled = false;
            const fail = () => {
                if (settled) return;
                settled = true;
                resolveOuter(false);
            };

            ws.on('open', async () => {
                if (settled) return;
                settled = true;
                this.ws = ws;
                this.log.info(`wavelink: connected on port ${port}`);
                try {
                    await this.loadSnapshot();
                    this.emit('ready');
                } catch (err) {
                    this.log.error(`wavelink: initial snapshot failed: ${err.message}`);
                }
                resolveOuter(true);
            });

            ws.on('message', data => this.onMessage(data.toString()));
            ws.on('error', fail);

            ws.on('close', () => {
                this.ws = undefined;
                if (settled) {
                    this.log.info('wavelink: connection closed, reconnecting');
                    this.emit('disconnected');
                    setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
                } else {
                    fail();
                }
            });
        });
    }

    onMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        // Reply to one of our own calls.
        if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
            const pending = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) pending.reject(new Error(msg.error.message || 'wavelink RPC error'));
            else pending.resolve(msg.result);
            return;
        }

        // Otherwise it is a push notification: patch the cache and let listeners resync.
        switch (msg.method) {
            case 'channelsChanged':
                this.channels = msg.params.channels;
                break;
            case 'channelChanged': {
                const idx = this.channels.findIndex(c => c.id === msg.params.id);
                if (idx >= 0) {
                    const merged = { ...this.channels[idx], ...msg.params };
                    // An effect toggle echoes back only `effects`, and possibly only
                    // the one that moved. Merging keeps the channel's other effects.
                    if (msg.params.effects) {
                        merged.effects = mergeById(this.channels[idx].effects, msg.params.effects);
                    }
                    this.channels[idx] = merged;
                }
                break;
            }
            case 'inputDevicesChanged':
                this.inputDevices = msg.params.inputDevices;
                break;
            case 'inputDeviceChanged': {
                const idx = this.inputDevices.findIndex(d => d.id === msg.params.id);
                if (idx >= 0 && msg.params.inputs) {
                    this.inputDevices[idx] = {
                        ...this.inputDevices[idx],
                        inputs: mergeById(this.inputDevices[idx].inputs, msg.params.inputs)
                    };
                }
                break;
            }
            case 'outputDevicesChanged':
                this.outputDevices = msg.params.outputDevices;
                break;
            case 'outputDeviceChanged': {
                const idx = this.outputDevices.findIndex(d => d.id === msg.params.id);
                if (idx >= 0 && msg.params.outputs) {
                    this.outputDevices[idx] = {
                        ...this.outputDevices[idx],
                        outputs: mergeById(this.outputDevices[idx].outputs, msg.params.outputs)
                    };
                }
                break;
            }
            case 'mixesChanged':
                this.mixes = msg.params.mixes;
                break;
            case 'mixChanged': {
                const idx = this.mixes.findIndex(m => m.id === msg.params.id);
                if (idx >= 0) this.mixes[idx] = { ...this.mixes[idx], ...msg.params };
                break;
            }
            default:
                return;
        }

        // Every case above mutated the cache, so the flat list has to be rebuilt.
        this.invalidateTargets();
        this.emit('changed');
    }

    call(method, params = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('wavelink socket not connected'));
        }
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, jsonrpc: '2.0', method, params }));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`wavelink call ${method} timed out`));
                }
            }, CALL_TIMEOUT_MS);
        });
    }

    /**
     * Records which Wave Link we are talking to, and says so when it is not the
     * generation this plugin was built against — so a future protocol change
     * shows up as one clear line instead of a pile of odd behaviour.
     */
    async checkVersion() {
        try {
            this.appInfo = await this.call('getApplicationInfo');
        } catch (err) {
            this.log.info(`wavelink: could not read the application info: ${err.message}`);
            return;
        }

        const { name, version, interfaceRevision } = this.appInfo;
        this.log.info(`wavelink: ${name} ${version}, interfaceRevision ${interfaceRevision}`);

        if (interfaceRevision !== EXPECTED_INTERFACE_REVISION) {
            this.log.error(
                `wavelink: this plugin was built against interfaceRevision ${EXPECTED_INTERFACE_REVISION}. ` +
                'If something behaves oddly, the protocol is the first thing to suspect.'
            );
        }
    }

    async loadSnapshot() {
        await this.checkVersion();

        const [channels, inputs, outputs, mixes] = await Promise.all([
            this.call('getChannels'),
            this.call('getInputDevices'),
            this.call('getOutputDevices'),
            this.call('getMixes')
        ]);
        this.channels = channels.channels;
        this.inputDevices = inputs.inputDevices;
        this.outputDevices = outputs.outputDevices;
        this.mixes = mixes.mixes;
        this.invalidateTargets();

        // Every device seen so far reports an empty table and a plain 0..1 range.
        // If one ever arrives populated, the mapping is probably a curve rather
        // than the straight line assumed here, so say so instead of failing quietly.
        for (const device of this.inputDevices) {
            for (const input of device.inputs) {
                const { min, max } = gainRange(input.gain);
                if (input.gain?.lookUpTable?.length) {
                    this.log.info(`wavelink: "${input.name}" has a gain lookUpTable; treating its range as linear`);
                } else if (min !== 0 || max !== 1) {
                    this.log.info(`wavelink: "${input.name}" reports gain in ${min}..${max}, mapping to 0..1`);
                }
            }
        }
    }

    isReady() {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * The flat target list as Wave Link last reported it, without any optimistic
     * level applied. Built once and kept until the cache changes: it is walked on
     * every notification, once per visible key.
     */
    baseTargets() {
        if (this.targetList) return this.targetList;

        this.targetList = this.buildTargets();
        this.targetIndex = new Map(
            this.targetList.map(t => [this.optimisticKey(t.targetType, t.targetId), t])
        );
        return this.targetList;
    }

    /** Every addressable thing in Wave Link, flattened into one list for the property inspector. */
    buildTargets() {
        const targets = [];

        for (const c of this.channels) {
            targets.push({
                targetType: 'channel',
                targetId: c.id,
                targetName: c.name,
                level: c.level,
                isMuted: c.isMuted
            });
        }

        // One channel's slider inside one mix — the cells of the Wave Link grid.
        for (const c of this.channels) {
            for (const cm of c.mixes) {
                const mixName = this.mixes.find(m => m.id === cm.id)?.name || cm.id;
                targets.push({
                    targetType: 'channelMix',
                    targetId: `${c.id}${CHANNEL_MIX_SEPARATOR}${cm.id}`,
                    targetName: `${c.name}${CHANNEL_MIX_NAME_SEPARATOR}${mixName}`,
                    level: cm.level,
                    isMuted: cm.isMuted
                });
            }
        }

        for (const d of this.inputDevices) {
            for (const i of d.inputs) {
                // For plain microphones the device and its single input share an id.
                targets.push({
                    targetType: 'input',
                    targetId: i.id,
                    targetName: d.name,
                    // Reported in the device's own range; everything else here is 0..1.
                    level: normalizeGain(i.gain),
                    isMuted: i.isMuted
                });
            }
        }

        for (const d of this.outputDevices) {
            for (const o of d.outputs) {
                targets.push({
                    targetType: 'output',
                    targetId: o.id,
                    targetName: o.name,
                    level: o.level,
                    isMuted: o.isMuted
                });
            }
        }

        for (const m of this.mixes) {
            targets.push({
                targetType: 'mix',
                targetId: m.id,
                targetName: m.name,
                level: m.level,
                isMuted: m.isMuted
            });
        }

        return targets;
    }

    getTargets() {
        const targets = this.baseTargets();
        if (this.optimistic.size === 0) return targets;

        // A dial mid-spin is ahead of what Wave Link has confirmed; show that.
        return targets.map(t => {
            const level = this.applyOptimistic(this.optimisticKey(t.targetType, t.targetId), t.level);
            return level === t.level ? t : { ...t, level };
        });
    }

    /** Single lookup, no list walk: this runs once per visible key on every change. */
    getTarget(targetType, targetId) {
        this.baseTargets();

        const key = this.optimisticKey(targetType, targetId);
        const target = this.targetIndex.get(key);
        if (!target) return undefined;

        const level = this.applyOptimistic(key, target.level);
        return level === target.level ? target : { ...target, level };
    }

    /** A channelMix id already contains "::", so the key needs a separator ids cannot hold. */
    optimisticKey(targetType, targetId) {
        return `${targetType} ${targetId}`;
    }

    /**
     * The level to believe: ours while a write is in flight, Wave Link's otherwise.
     *
     * The entry is dropped as soon as Wave Link reports the value we asked for, or
     * once it has had `LEVEL_SETTLE_MS` to do so and hasn't — which is what makes a
     * rejected or lost write correct itself instead of freezing the display.
     */
    applyOptimistic(key, reportedLevel) {
        const entry = this.optimistic.get(key);
        if (!entry) return reportedLevel;

        if (Math.abs(reportedLevel - entry.level) < LEVEL_EPSILON) {
            this.optimistic.delete(key);
            return reportedLevel;
        }
        if (!entry.timer && Date.now() > entry.expires) {
            this.optimistic.delete(key);
            return reportedLevel;
        }
        return entry.level;
    }

    /**
     * Moves a level by `delta` and returns where it landed.
     *
     * This exists because reading the cached level on every detent does not
     * survive a fast spin: Wave Link's confirmations arrive slower than the ticks
     * do, so several turns in a row compute from the same stale value and the
     * fader crawls or sticks. Here each tick adds to the value *we* last decided
     * on, and the writes are coalesced into one per `LEVEL_FLUSH_MS` instead of
     * one per detent.
     */
    nudgeLevel(targetType, targetId, delta) {
        const key = this.optimisticKey(targetType, targetId);
        const current = this.getTarget(targetType, targetId);
        if (!current) return undefined;

        const next = clamp01(current.level + delta);
        const entry = this.optimistic.get(key) || { timer: null };
        entry.level = next;
        entry.expires = Date.now() + LEVEL_SETTLE_MS;
        this.optimistic.set(key, entry);

        if (!entry.timer) {
            entry.timer = setTimeout(() => {
                entry.timer = null;
                entry.expires = Date.now() + LEVEL_SETTLE_MS;
                this.setLevel(targetType, targetId, entry.level).catch(err => {
                    this.log.error(`wavelink: setLevel failed: ${err.message}`);
                });
            }, LEVEL_FLUSH_MS);
        }

        // Repaint now rather than waiting for the round trip.
        this.emit('changed');
        return next;
    }

    /**
     * The channel's own artwork as a base64 PNG, or undefined.
     *
     * Wave Link ships one per channel in `channel.image.imgData`: the icon of the
     * assigned app for hardware channels (`isAppIcon: true`), or Wave Link's own
     * artwork for the software ones. Both are worth showing, so the flag is not
     * used to filter.
     *
     * Only channels carry it: mixes report an icon *name* instead (`image.name`,
     * e.g. "headphones") and input/output devices carry no image at all. It is
     * deliberately kept out of `getTargets()` so the property inspector's payload
     * stays small.
     */
    getIcon(targetType, targetId) {
        let channelId;
        if (targetType === 'channel') channelId = targetId;
        else if (targetType === 'channelMix') [channelId] = targetId.split(CHANNEL_MIX_SEPARATOR);
        else return undefined;

        return this.channels.find(c => c.id === channelId)?.image?.imgData;
    }

    async setLevel(targetType, targetId, level) {
        const clamped = clamp01(level);
        switch (targetType) {
            case 'channel':
                return this.call('setChannel', { id: targetId, level: clamped });
            case 'mix':
                return this.call('setMix', { id: targetId, level: clamped });
            case 'channelMix': {
                const [channelId, mixId] = targetId.split(CHANNEL_MIX_SEPARATOR);
                return this.call('setChannel', { id: channelId, mixes: [{ id: mixId, level: clamped }] });
            }
            case 'input': {
                const device = this.findInputDevice(targetId);
                const input = device.inputs.find(i => i.id === targetId);
                return this.call('setInputDevice', {
                    id: device.id,
                    inputs: [{ id: targetId, gain: { value: denormalizeGain(input.gain, clamped) } }]
                });
            }
            case 'output': {
                const device = this.findOutputDevice(targetId);
                return this.call('setOutputDevice', {
                    outputDevice: { id: device.id, outputs: [{ id: targetId, level: clamped }] }
                });
            }
            default:
                throw new Error(`unknown target type ${targetType}`);
        }
    }

    async setMuted(targetType, targetId, isMuted) {
        switch (targetType) {
            case 'channel':
                return this.call('setChannel', { id: targetId, isMuted });
            case 'mix':
                return this.call('setMix', { id: targetId, isMuted });
            case 'channelMix': {
                const [channelId, mixId] = targetId.split(CHANNEL_MIX_SEPARATOR);
                return this.call('setChannel', { id: channelId, mixes: [{ id: mixId, isMuted }] });
            }
            case 'input': {
                const device = this.findInputDevice(targetId);
                return this.call('setInputDevice', { id: device.id, inputs: [{ id: targetId, isMuted }] });
            }
            case 'output': {
                const device = this.findOutputDevice(targetId);
                return this.call('setOutputDevice', {
                    outputDevice: { id: device.id, outputs: [{ id: targetId, isMuted }] }
                });
            }
            default:
                throw new Error(`unknown target type ${targetType}`);
        }
    }

    /**
     * Every VST/AU effect loaded on any channel, flattened the way targets are.
     *
     * Kept separate from `getTargets()` because an effect is not a volume: it has
     * no level, only an on/off. Wave Link reports them as
     * `{ id, name, isEnabled }` inside each channel.
     */
    getEffects() {
        const effects = [];
        for (const channel of this.channels) {
            for (const effect of channel.effects || []) {
                effects.push({
                    channelId: channel.id,
                    channelName: channel.name,
                    effectId: effect.id,
                    effectName: effect.name,
                    isEnabled: Boolean(effect.isEnabled)
                });
            }
        }
        return effects;
    }

    getEffect(channelId, effectId) {
        return this.getEffects().find(e => e.channelId === channelId && e.effectId === effectId);
    }

    /**
     * Turns one effect on or off.
     *
     * Written through `setChannel`, the same way a channel's mixes are — there is
     * no dedicated effects method. `setPluginInfo` exists in the protocol but is
     * not needed for this.
     */
    async setEffectEnabled(channelId, effectId, isEnabled) {
        return this.call('setChannel', {
            id: channelId,
            effects: [{ id: effectId, isEnabled }]
        });
    }

    /**
     * Which mix an output device is fed by, or undefined when it is fed by none.
     * An unassigned output is a real state in Wave Link, not an error.
     */
    getOutputMix(outputId) {
        for (const device of this.outputDevices) {
            const output = device.outputs.find(o => o.id === outputId);
            if (output) return output.mixId || undefined;
        }
        return undefined;
    }

    /**
     * Points an output at a different mix — the routing the official plugin calls
     * Mix Output Device.
     *
     * To *unassign* an output, pass an empty string. Verified against the live
     * instance: `null` is ignored and omitting the key entirely is ignored too,
     * so only `''` actually clears it.
     */
    async setOutputMix(outputId, mixId) {
        const device = this.findOutputDevice(outputId);
        return this.call('setOutputDevice', {
            outputDevice: { id: device.id, outputs: [{ id: outputId, mixId }] }
        });
    }

    /** Inputs and outputs are addressed through their parent device, so it has to be looked up. */
    findInputDevice(inputId) {
        const device = this.inputDevices.find(d => d.inputs.some(i => i.id === inputId));
        if (!device) throw new Error(`input ${inputId} not found`);
        return device;
    }

    findOutputDevice(outputId) {
        const device = this.outputDevices.find(d => d.outputs.some(o => o.id === outputId));
        if (!device) throw new Error(`output ${outputId} not found`);
        return device;
    }
}

module.exports = { WaveLinkClient };
