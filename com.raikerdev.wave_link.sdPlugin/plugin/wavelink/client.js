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
                if (idx >= 0) this.channels[idx] = { ...this.channels[idx], ...msg.params };
                break;
            }
            case 'inputDevicesChanged':
                this.inputDevices = msg.params.inputDevices;
                break;
            case 'inputDeviceChanged': {
                const idx = this.inputDevices.findIndex(d => d.id === msg.params.id);
                if (idx >= 0 && msg.params.inputs) {
                    this.inputDevices[idx] = { ...this.inputDevices[idx], inputs: msg.params.inputs };
                }
                break;
            }
            case 'outputDevicesChanged':
                this.outputDevices = msg.params.outputDevices;
                break;
            case 'outputDeviceChanged': {
                const idx = this.outputDevices.findIndex(d => d.id === msg.params.id);
                if (idx >= 0 && msg.params.outputs) {
                    this.outputDevices[idx] = { ...this.outputDevices[idx], outputs: msg.params.outputs };
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

    async loadSnapshot() {
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
    }

    isReady() {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /** Every addressable thing in Wave Link, flattened into one list for the property inspector. */
    getTargets() {
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
                    level: i.gain.value,
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

    getTarget(targetType, targetId) {
        return this.getTargets().find(t => t.targetType === targetType && t.targetId === targetId);
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
                return this.call('setInputDevice', {
                    id: device.id,
                    inputs: [{ id: targetId, gain: { value: clamped } }]
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
