{
  description = "TechClip development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

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
          ];

          shellHook = ''
            # CLAUDE_CONFIG_DIR: auth・settings を .claude-user/ に隔離
            CLAUDE_USER_DIR="$PWD/.claude-user"
            export CLAUDE_CONFIG_DIR="$CLAUDE_USER_DIR"
            mkdir -p "$CLAUDE_USER_DIR"
            if [ -d "$HOME/.claude" ]; then
              for f in "$HOME/.claude"/*.json; do
                [ -f "$f" ] || continue
                fname="$(basename "$f")"
                if [ "$fname" != "settings.json" ] && [ ! -f "$CLAUDE_USER_DIR/$fname" ]; then
                  cp "$f" "$CLAUDE_USER_DIR/" 2>/dev/null || true
                fi
              done
            fi

            # OMC 分離: claude プロセスの HOME を差し替えて ~/.claude/CLAUDE.md を見えなくする
            # - HOME 変更は claude プロセスのみに限定され、現在のシェルには影響しない
            # - ~/.claude/CLAUDE.md  → 読み込まれない（HOME が偽装されているため）
            # - .claude-user/        → CLAUDE_CONFIG_DIR 経由で auth/settings が読み込まれる
            # - プロジェクト CLAUDE.md → CWD ベースなので影響なし
            # bash/zsh/fish すべてで動作するようシェル関数ではなくラッパースクリプトを PATH に置く
            _CLAUDE_REAL=$(command -v claude 2>/dev/null || echo "")
            if [ -n "$_CLAUDE_REAL" ]; then
              _CLAUDE_FAKE_HOME="$PWD/.claude-isolated"
              # .claude/ は空でよい（settings は CLAUDE_CONFIG_DIR 経由で読み込まれる）
              mkdir -p "$_CLAUDE_FAKE_HOME/.claude"
              _CLAUDE_WRAPPER_BIN="$_CLAUDE_FAKE_HOME/bin"
              mkdir -p "$_CLAUDE_WRAPPER_BIN"
              cat > "$_CLAUDE_WRAPPER_BIN/claude" <<WRAPPER
#!/usr/bin/env bash
exec env HOME="$_CLAUDE_FAKE_HOME" "$_CLAUDE_REAL" "\$@"
WRAPPER
              chmod +x "$_CLAUDE_WRAPPER_BIN/claude"
              export PATH="$_CLAUDE_WRAPPER_BIN:$PATH"
              unset _CLAUDE_REAL _CLAUDE_FAKE_HOME _CLAUDE_WRAPPER_BIN
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
