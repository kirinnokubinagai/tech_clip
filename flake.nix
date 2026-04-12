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
        };

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
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            turbo
            biome
            gh
            git
            jq
            curl
            openssl
            python3
            zap
            bats
            shellcheck
            actionlint
          ];
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            pnpm
            nodePackages.wrangler
            turbo
            biome
            gh
            git
            jq
            curl
            maestro
            zap
            bats
            mailpit
            claude-code-bin
            shellcheck
            actionlint
          ];

          shellHook = ''
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

            # eas-cli は nixpkgs にないため npx ラッパーで提供
            # fish/zsh 互換のため export -f は使用しない（bash 専用構文）
            eas() { npx --yes eas-cli@latest "$@"; }

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
            echo "  eas:      via npx (run 'eas --version' to check)"
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
