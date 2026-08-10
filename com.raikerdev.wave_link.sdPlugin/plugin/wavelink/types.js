/**
 * Shapes and constants for the Wave Link 3 JSON-RPC API.
 *
 * A "target" is any single thing in Wave Link that has a level and a mute
 * state. Wave Link exposes those across four unrelated collections, so the
 * plugin flattens them into one addressable list of
 * `{ targetType, targetId, targetName, level, isMuted }`.
 */

/** Every kind of thing the plugin can drive. Also the order shown in the property inspector. */
const TARGET_TYPES = ['channel', 'channelMix', 'input', 'output', 'mix'];

/** Delimiter joining a channel id and a mix id into a composite "channelMix" target id. */
const CHANNEL_MIX_SEPARATOR = '::';

/**
 * Separator used in a "channelMix" display name, e.g. "Music -> Personal Mix".
 * Deliberately ASCII: a unicode arrow used to render as mojibake on the device.
 */
const CHANNEL_MIX_NAME_SEPARATOR = ' -> ';

module.exports = {
    TARGET_TYPES,
    CHANNEL_MIX_SEPARATOR,
    CHANNEL_MIX_NAME_SEPARATOR
};
