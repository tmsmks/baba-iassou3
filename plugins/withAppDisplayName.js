/** Force le nom affiché sous l'icône : « baba IAssou3 » (avec espace). */
const { withInfoPlist, withStringsXml, AndroidConfig } = require('@expo/config-plugins');

const DISPLAY_NAME = 'baba IAssou3';

function withAppDisplayName(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleDisplayName = DISPLAY_NAME;
    return cfg;
  });

  config = withStringsXml(config, (cfg) => {
    cfg.modResults = AndroidConfig.Strings.setStringItem(cfg.modResults, {
      name: 'app_name',
      value: DISPLAY_NAME,
      translatable: false,
    });
    return cfg;
  });

  return config;
}

module.exports = withAppDisplayName;
