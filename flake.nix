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
            if [ -f "apps/mobile/.env.example" ] && [ ! -f "apps/mobile/.env" ]; then
              cp apps/mobile/.env.example apps/mobile/.env
              echo "Created apps/mobile/.env from example"
            fi
            if [ -f "apps/api/.dev.vars.example" ] && [ ! -f "apps/api/.dev.vars" ]; then
              cp apps/api/.dev.vars.example apps/api/.dev.vars
              echo "Created apps/api/.dev.vars from example"
            fi

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
