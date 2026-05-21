/**
 * Xcode 26.4+ : fmt 11.0.2 (via React Native) échoue avec "Invalid expression encountered"
 * à cause de FMT_USE_CONSTEVAL. Désactive consteval dans fmt/base.h après pod install.
 * @see https://github.com/expo/expo/issues/44229
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const PATCH_MARKER = '# Xcode 26 fmt consteval workaround (baba-iassou3)';
const PATCH_BODY = `
    ${PATCH_MARKER}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      File.chmod(0644, fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/#\\s*define FMT_USE_CONSTEVAL 1/, '# define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.write(fmt_base, patched)
        Pod::UI.puts 'Patched fmt/base.h: disabled FMT_USE_CONSTEVAL (Xcode 26+)'
      end
    end`;

function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let content = fs.readFileSync(podfilePath, 'utf8');
      if (content.includes(PATCH_MARKER)) return cfg;

      const postInstallMatch = content.match(
        /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\)[\s\S]*?)(\n {2}end\nend)/,
      );
      if (!postInstallMatch) {
        console.warn('[withFmtXcode26Fix] post_install block not found in Podfile');
        return cfg;
      }

      content = content.replace(postInstallMatch[0], `${postInstallMatch[1]}${PATCH_BODY}${postInstallMatch[2]}`);
      fs.writeFileSync(podfilePath, content);
      return cfg;
    },
  ]);
}

module.exports = withFmtXcode26Fix;
