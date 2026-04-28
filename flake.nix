{
  description = "TechClip development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
          config.android_sdk.accept_license = true;
        };

        # Android SDK + emulator + system image を nix で完全管理する。
        # ローカルの Android Studio install や CI の reactivecircus action 依存を撤廃し、
        # local / CI で同一の emulator バイナリ + system image を使う。
        #
        # ABI は host のみを取り込んで disk 使用量を抑える (system image は 5GB/ABI)。
        #   darwin-aarch64 (Apple Silicon Mac) → arm64-v8a
        #   linux-x86_64 (Ubuntu CI runner)    → x86_64
        #   darwin-x86_64 (Intel Mac)          → x86_64
        androidAbi =
          if system == "aarch64-darwin" then "arm64-v8a"
          else if system == "x86_64-linux" || system == "x86_64-darwin" then "x86_64"
          else "x86_64";  # fallback

        androidComposition = pkgs.androidenv.composeAndroidPackages {
          # platformToolsVersion は nixpkgs-unstable のキャッシュにある既知良好版を pin する。
          # デフォルトの 37.0.0 は hash mismatch を起こす場合あり。
          platformToolsVersion = "36.0.2";
          # build-tools / platform は project の compileSdkVersion (= 36) に合わせる。
          # 不足すると gradle が nix store (read-only) に install しようとして失敗する。
          # API 36 に統一 (system image / emulator runtime も 36 を使う)
          # 35.0.0 も含める: expo モジュールが build-tools 35 を要求する場合があり、
          # Nix store は read-only なので CI で install 失敗する (#1138 fix)
          buildToolsVersions = [ "35.0.0" "36.0.0" ];
          # CMake 3.22.1: react-native-worklets / react-native-screens が要求する。
          # Nix store は read-only なので事前プロビジョンが必要 (#1138 fix)
          cmakeVersions = [ "3.22.1" ];
          platformVersions = [ "36" ];
          includeEmulator = true;
          includeSystemImages = true;
          systemImageTypes = [ "google_apis" ];
          abiVersions = [ androidAbi ];
          # React Native (expo run:android) が要求する NDK バージョン。
          # 不一致時は gradle が `com.android.builder.sdk.InstallFailedException` を投げて、
          # nix store の read-only 領域に NDK を install しようとして失敗する。
          includeNDK = true;
          ndkVersions = [ "27.1.12297006" ];
        };
        androidSdk = androidComposition.androidsdk;
        androidHome = "${androidSdk}/libexec/android-sdk";

        # OWASP ZAP: クロスプラットフォーム版で macOS/Linux 両対応
        zap = pkgs.stdenv.mkDerivation {
          pname = "zap";
          version = "2.17.0";
          src = pkgs.fetchurl {
            url = "https://github.com/zaproxy/zaproxy/releases/download/v2.17.0/ZAP_2.17.0_Crossplatform.zip";
            hash = "sha256-lMj3Z7HC6U8Ntms65WUU1eP1pyjuG2x5jgyP4tYfv/A=";
          };
          nativeBuildInputs = [ pkgs.unzip ];
          buildInputs = [ pkgs.jre ];
          # https://github.com/zaproxy/zaproxy/blob/master/zap/src/main/java/org/parosproxy/paros/Constant.java
          version_tag = "20012000";
          unpackPhase = ''
            unzip $src
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out/{share/zap,bin}
            cp -r ZAP_2.17.0/* $out/share/zap/

            cat > "$out/bin/zap" << WRAPPER
            #!/usr/bin/env bash
            export PATH="${pkgs.lib.makeBinPath [ pkgs.jre ]}:\$PATH"
            export JAVA_HOME="${pkgs.jre}"

            # macOS: ~/Library/Application Support/ZAP
            # Linux: ~/.ZAP
            if [ "\$(uname)" = "Darwin" ]; then
              ZAP_HOME="\$HOME/Library/Application Support/ZAP"
            else
              ZAP_HOME="\$HOME/.ZAP"
            fi

            if ! [ -f "\$ZAP_HOME/config.xml" ]; then
              mkdir -p "\$ZAP_HOME"
              head -n 2 $out/share/zap/xml/config.xml > "\$ZAP_HOME/config.xml"
              echo "<version>${"$"}{version_tag}</version>" >> "\$ZAP_HOME/config.xml"
              tail -n +3 $out/share/zap/xml/config.xml >> "\$ZAP_HOME/config.xml"
            fi
            export JAVA_TOOL_OPTIONS="\${"$"}{JAVA_TOOL_OPTIONS:-} -Duser.home=\$HOME"
            exec "$out/share/zap/zap.sh" "\$@"
            WRAPPER

            chmod +x "$out/bin/zap"
            runHook postInstall
          '';
          meta = {
            description = "OWASP ZAP - Web application security scanner";
            homepage = "https://www.zaproxy.org/";
            license = pkgs.lib.licenses.asl20;
            platforms = pkgs.lib.platforms.unix;
          };
        };
      in
      {
        devShells.ci = pkgs.mkShell {
          buildInputs = (with pkgs; [
            nodejs_22
            pnpm_10
            turbo
            biome
            gh
            git
            jq
            curl
            openssl
            python3
            coreutils
            libxml2
            turso-cli
            sqld
            android-tools
            sqlite
            zap
            bats
            shellcheck
            actionlint
            jdk17
            maestro
          ]) ++ [ androidSdk ];

          # Android SDK / emulator / system image を nix で固定して
          # ローカルの ~/Library/Android や apt 由来の SDK に依存しない。
          ANDROID_HOME = androidHome;
          ANDROID_SDK_ROOT = androidHome;
          JAVA_HOME = "${pkgs.jdk17}";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = (with pkgs; [
            nodejs_22
            pnpm_10
            turbo
            biome
            gh
            git
            jq
            curl
            coreutils
            libxml2
            maestro
            zap
            bats
            mailpit
            turso-cli
            sqld
            android-tools
            sqlite
            claude-code-bin
            shellcheck
            actionlint
            jdk17
            wrangler
            eas-cli
          ]) ++ [ androidSdk ];

          # Android SDK / emulator / system image を nix で固定して
          # ローカルの ~/Library/Android install には依存しない。
          ANDROID_HOME = androidHome;
          ANDROID_SDK_ROOT = androidHome;

          shellHook = ''
            # Remove homebrew / asdf shim leaks to keep nix store hermetic
            PATH=$(echo "$PATH" | awk -v RS=: -v ORS=: '!/\/opt\/homebrew/ && !/\/.asdf\/shims/ && !/\/usr\/local\/bin/ {print}' | sed 's/:$//')
            export PATH

            # Java for Android / Gradle builds (avdmanager needs bin/java directly)
            export JAVA_HOME="${pkgs.jdk17}"

            # nix Android SDK の bin (wrapped binaries: avdmanager/sdkmanager/emulator/adb 等) を PATH に追加
            export PATH="${androidSdk}/bin:$PATH"

            export NODE_OPTIONS="--no-experimental-strip-types"
            # CLAUDE_CONFIG_DIR: auth・settings を .claude-user/ に隔離
            CLAUDE_USER_DIR="$PWD/.claude-user"
            export CLAUDE_CONFIG_DIR="$CLAUDE_USER_DIR"
            mkdir -p "$CLAUDE_USER_DIR"

            # Claude 隔離 wrapper を PATH の先頭に追加（ホスト非依存で最新版を起動するため）
            export PATH="$PWD/.claude-isolated/bin:$PATH"

            # Claude Code auto-updater は ~/.local/bin にインストールする
            # /opt/homebrew/bin より優先するために先頭に追加
            if [ -x "$HOME/.local/bin/claude" ]; then
              export PATH="$HOME/.local/bin:$PATH"
            fi

            # シークレットファイルのセットアップコマンド
            setup-secrets() {
              local missing=0
              if [ ! -f "apps/api/.dev.vars" ]; then
                cp apps/api/.dev.vars.example apps/api/.dev.vars
                echo "[setup-secrets] apps/api/.dev.vars を作成しました。実際の値を設定してください。"
                missing=1
              fi
              if [ ! -f "apps/mobile/.env" ]; then
                cp apps/mobile/.env.example apps/mobile/.env
                echo "[setup-secrets] apps/mobile/.env を作成しました。実際の値を設定してください。"
                missing=1
              fi
              if [ "$missing" -eq 0 ]; then
                echo "[setup-secrets] シークレットファイルはすでに存在します。"
              else
                echo "[setup-secrets] 詳細は docs/SECRETS.md を参照してください。"
              fi
            }

            # mailpit: ローカルメールキャッチャー（SMTP 1025 / Web UI 8025）
            # 未起動の場合にバックグラウンドで自動起動する
            if command -v mailpit > /dev/null 2>&1; then
              if ! curl -s --max-time 0.2 http://localhost:8025/api/v1/info > /dev/null 2>&1; then
                mailpit > /dev/null 2>&1 &
                disown
                # SMTP ポートが開くまで最大 5 秒待機
                for _mp_i in 1 2 3 4 5 6 7 8 9 10; do
                  curl -s --max-time 0.2 http://localhost:8025/api/v1/info > /dev/null 2>&1 && break
                  sleep 0.5
                done
                unset _mp_i
              fi
            fi

            # 依存パッケージの自動インストール
            if [ ! -d "node_modules" ]; then
              echo "Installing dependencies..."
              pnpm install --frozen-lockfile 2>/dev/null || pnpm install
            fi

            # シークレットファイルが未作成の場合に警告を表示
            if [ ! -f "apps/api/.dev.vars" ] || [ ! -f "apps/mobile/.env" ]; then
              echo ""
              echo "警告: シークレットファイルが未作成です。"
              echo "  実行してください: setup-secrets"
              echo "  詳細:             docs/SECRETS.md"
            fi

            echo ""
            echo "TechClip dev environment ready"
            echo "  Node:     $(node --version)"
            echo "  pnpm:     $(pnpm --version)"
            echo "  wrangler: $(wrangler --version 2>/dev/null | head -1)"
            echo "  eas:      $(eas --version 2>/dev/null | head -1)"
            echo "  mailpit:  smtp://localhost:1025  http://localhost:8025"
            echo ""
            echo "Quick start:"
            echo "  setup-secrets     # シークレットファイルを初期化"
            echo "  pnpm dev          # Start dev servers"
            echo "  pnpm test         # Run tests"
            echo "  pnpm lint         # Lint check"
            echo ""
          '';
        };
      });
}
