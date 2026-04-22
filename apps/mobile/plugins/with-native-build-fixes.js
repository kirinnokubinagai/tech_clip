const fs = require("fs");
const path = require("path");

const {
  createRunOncePlugin,
  withDangerousMod,
  withPodfile,
} = require("expo/config-plugins");

const PODFILE_HELPER_START = "# BEGIN tech-clip native build fixes";
const PODFILE_HELPER_END = "# END tech-clip native build fixes";

function withNativeBuildFixes(config) {
  config = withPodfile(config, (config) => {
    const marketingVersion = JSON.stringify(config.version ?? "1.0");
    const projectAbbreviation = "${_PROJECT_ABBREVIATION}";
    const podsRoot = "${PODS_ROOT}";
    const scriptOutputFile = "${SCRIPT_OUTPUT_FILE_0}";
    const helperBlock = `${PODFILE_HELPER_START}
def tech_clip_patch_native_projects!(installer)
  share_view_controller_path = File.join(Pod::Config.instance.installation_root, '..', 'ShareExtension', 'ShareViewController.swift')
  rn_google_mobile_ads_key_lookup = <<~'SCRIPT'.strip
ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$1'); puts output[$_JSON_ROOT]['$2']"
SCRIPT
  rn_google_mobile_ads_key_replace = <<~'SCRIPT'.strip
ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$1'); config=output[$_JSON_ROOT] || (output['expo'] && output['expo'][$_JSON_ROOT]) || {}; key='$2'; camel=key.gsub(/_([a-z])/) { $1.upcase }; puts config[key] || config[camel]"
SCRIPT
  rn_google_mobile_ads_exists_lookup = <<~'SCRIPT'.strip
_RN_ROOT_EXISTS=$(ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); puts output[$_JSON_ROOT]" || echo '')
SCRIPT
  rn_google_mobile_ads_exists_replace = <<~'SCRIPT'.strip
_RN_ROOT_EXISTS=$(ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); puts output[$_JSON_ROOT] || (output['expo'] && output['expo'][$_JSON_ROOT])" || echo '')
SCRIPT
  rn_google_mobile_ads_finish_lookup = <<~'SCRIPT'.strip
echo "note: <- ${projectAbbreviation} build script finished"
SCRIPT
  rn_google_mobile_ads_finish_replace = <<~'SCRIPT'.strip
touch "${scriptOutputFile}"

echo "note: <- ${projectAbbreviation} build script finished"
SCRIPT

  installer.aggregate_targets.map(&:user_project).compact.uniq.each do |user_project|
    user_project.native_targets.each do |target|
      case target.name
      when 'TechClip'
        target.build_configurations.each do |build_configuration|
          other_ldflags = Array(build_configuration.build_settings['OTHER_LDFLAGS']).reject { |flag| flag == '-lc++' }
          build_configuration.build_settings['OTHER_LDFLAGS'] = other_ldflags
        end

        target.shell_script_build_phases.each do |phase|
          next unless phase.name == '[CP-User] [RNGoogleMobileAds] Configuration'

          phase.input_paths = [
            '$(SRCROOT)/../app.json',
            '$(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH)',
          ]
          phase.output_paths = [
            '$(DERIVED_FILE_DIR)/rn-google-mobile-ads-configured-$(CONFIGURATION).stamp',
          ]

          shell_script = phase.shell_script || ''
          shell_script = shell_script.sub(rn_google_mobile_ads_key_lookup, rn_google_mobile_ads_key_replace)
          shell_script = shell_script.sub(rn_google_mobile_ads_exists_lookup, rn_google_mobile_ads_exists_replace)
          unless shell_script.include?('touch "${scriptOutputFile}"')
            shell_script = shell_script.sub(rn_google_mobile_ads_finish_lookup, rn_google_mobile_ads_finish_replace)
          end
          phase.shell_script = shell_script
        end
      when 'ShareExtension'
        target.build_configurations.each do |build_configuration|
          build_configuration.build_settings['MARKETING_VERSION'] = ${marketingVersion}
        end
      end
    end

    user_project.save
  end

  installer.pods_project.targets.each do |target|
    target.shell_script_build_phases.each do |phase|
      next unless phase.name == '[CP-User] [Hermes] Replace Hermes for the right configuration, if needed'

      phase.input_paths = ['${podsRoot}/../Podfile.lock']
      phase.output_paths = ['$(DERIVED_FILE_DIR)/hermes-version-replaced-$(CONFIGURATION).stamp']

      shell_script = phase.shell_script || ''
      unless shell_script.include?('touch "${scriptOutputFile}"')
        shell_script = shell_script.rstrip + "\\n\\ntouch \\\"${scriptOutputFile}\\\"\\n"
      end
      phase.shell_script = shell_script
    end
  end

  installer.pods_project.save

  if File.exist?(share_view_controller_path)
    share_view_controller_source = File.read(share_view_controller_path)
    patched_share_view_controller_source = share_view_controller_source.gsub(
      'self.copyFile(at: url, to: tmp)',
      'Self.copyFile(at: url, to: tmp)',
    ).sub(
      '  func copyFile(at srcURL: URL, to dstURL: URL) -> Bool {',
      '  nonisolated static func copyFile(at srcURL: URL, to dstURL: URL) -> Bool {',
    )

    if patched_share_view_controller_source != share_view_controller_source
      File.write(share_view_controller_path, patched_share_view_controller_source)
    end
  end
end
${PODFILE_HELPER_END}
`;

    const { contents } = config.modResults;
    const helperPattern = new RegExp(
      `${PODFILE_HELPER_START}[\\s\\S]*?${PODFILE_HELPER_END}\\n?`,
      "m",
    );
    let nextContents = contents.replace(helperPattern, "");
    nextContents = nextContents.replace(
      "target 'TechClip' do",
      `${helperBlock}\n\ntarget 'TechClip' do`,
    );

    const postInstallNeedle = `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
`;
    if (!nextContents.includes("    tech_clip_patch_native_projects!(installer)\n")) {
      nextContents = nextContents.replace(
        postInstallNeedle,
        `${postInstallNeedle}    tech_clip_patch_native_projects!(installer)\n`,
      );
    }

    if (!nextContents.includes("  post_integrate do |installer|\n")) {
      const postInstallHookNeedle = `  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
    tech_clip_patch_native_projects!(installer)
  end
`;
      nextContents = nextContents.replace(
        postInstallHookNeedle,
        `${postInstallHookNeedle}
  post_integrate do |installer|
    tech_clip_patch_native_projects!(installer)
  end
`,
      );
    }

    config.modResults.contents = nextContents;
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const shareViewControllerPath = path.join(
        config.modRequest.platformProjectRoot,
        "ShareExtension",
        "ShareViewController.swift",
      );

      if (!fs.existsSync(shareViewControllerPath)) {
        return config;
      }

      const originalSource = fs.readFileSync(shareViewControllerPath, "utf8");
      const patchedSource = originalSource
        .replace(/self\.copyFile\(at: url, to: tmp\)/g, "Self.copyFile(at: url, to: tmp)")
        .replace(
          /(^\s*)(?:private\s+)?func copyFile\(at srcURL: URL, to dstURL: URL\) -> Bool \{/m,
          "$1static func copyFile(at srcURL: URL, to dstURL: URL) -> Bool {",
        );

      if (patchedSource !== originalSource) {
        fs.writeFileSync(shareViewControllerPath, patchedSource);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(withNativeBuildFixes, "with-native-build-fixes", "1.0.0");
