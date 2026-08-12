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

const STRINGS = {
    es: {
        'No target': 'Sin destino',
        'Not found': 'No existe',
        'No connection': 'Sin conexión',
        'No mix': 'Sin mix'
    }
};

/** The host reports the app's language in the `-info` argument it launches us with. */
const language = String(Plugins.language || 'en').toLowerCase().split('-')[0];

/** @param {string} text English source string */
function t(text) {
    return STRINGS[language]?.[text] || text;
}

module.exports = { t, language };
