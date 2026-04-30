#!/bin/bash
# Git hooksのセットアップ
# リポジトリクローン後に一度実行: bash .githooks/setup.sh

git config core.hooksPath .githooks
echo "✅ Git hooks を .githooks/ に設定しました"
