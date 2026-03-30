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
            docker-client
          ];

          shellHook = ''
            # eas-cli は nixpkgs にないため npx ラッパーで提供
            eas() { npx --yes eas-cli@latest "$@"; }
            export -f eas

            # 依存パッケージの自動インストール
            if [ ! -d "node_modules" ]; then
              echo "Installing dependencies..."
              pnpm install --frozen-lockfile 2>/dev/null || pnpm install
            fi

            # .env の自動コピー（存在しない場合のみ）
            for env_example in apps/mobile/.env.example apps/api/.dev.vars.example; do
              env_file="''${env_example%.example}"
              env_file="''${env_file%.vars.example}.vars"
              if [ -f "$env_example" ] && [ ! -f "$env_file" ]; then
                cp "$env_example" "$env_file"
                echo "Created $env_file from example"
              fi
            done

            echo ""
            echo "TechClip dev environment ready"
            echo "  Node:     $(node --version)"
            echo "  pnpm:     $(pnpm --version)"
            echo "  wrangler: $(wrangler --version 2>/dev/null | head -1)"
            echo "  eas:      via npx (run 'eas --version' to check)"
            echo ""
            echo "Quick start:"
            echo "  pnpm dev          # Start dev servers"
            echo "  pnpm test         # Run tests"
            echo "  pnpm lint         # Lint check"
            echo ""
          '';
        };
      });
}
