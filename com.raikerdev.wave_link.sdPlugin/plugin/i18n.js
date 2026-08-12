/**
 * Translations for the text drawn on the keys.
 *
 * Separate from the property inspector's translation, which goes through the
 * SDK's own mechanism over the static markup. This side has no markup and no
 * SDK helper: the plugin process draws the text itself.
 *
 * Source strings are English and act as their own fallback, so an untranslated
 * language reads a bit foreign rather than broken.
 */
const { Plugins } = require('./utils/plugin');

/**
 * Keys match the language file names the host uses (`es.json`, `zh_CN.json`),
 * so there is one spelling of a language across the plugin.
 */
const STRINGS = {
    es: {
        'No target': 'Sin destino',
        'Not found': 'No existe',
        'No connection': 'Sin conexión',
        'No mix': 'Sin mix'
    },
    zh_CN: {
        'No target': '未设置目标',
        'Not found': '不存在',
        'No connection': '未连接',
        'No mix': '无混音'
    }
};

/**
 * Matches what the host reports against the tables above.
 *
 * The host has been seen to report both `es` and `zh_CN`, and BCP 47 allows the
 * dash form too, so all three are accepted. The last resort is a region-blind
 * match: someone reporting plain `zh` gets the Simplified table rather than
 * English, which is closer to right than falling all the way back.
 */
function resolve(tag) {
    const normalized = String(tag || 'en').replace(/-/g, '_');
    const base = normalized.split('_')[0].toLowerCase();
    const known = Object.keys(STRINGS);

    return known.find(key => key.toLowerCase() === normalized.toLowerCase())
        || known.find(key => key.toLowerCase() === base)
        || known.find(key => key.split('_')[0].toLowerCase() === base)
        || null;
}

/** The host reports the app's language in the `-info` argument it launches us with. */
const language = String(Plugins.language || 'en');
const matched = resolve(language);
const table = STRINGS[matched] || {};

/** False when the host asked for a language with no table, so the keys read English. */
const translated = Boolean(matched);

/** @param {string} text English source string */
function t(text) {
    return table[text] || text;
}

module.exports = { t, language, translated };
