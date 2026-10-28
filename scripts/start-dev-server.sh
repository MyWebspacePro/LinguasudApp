#!/bin/zsh
# Launcher für den Next.js Dev-Server, gestartet über launchd (LaunchAgent).
# launchd hat ein minimales PATH, daher hier explizit setzen.

PROJECT_DIR="/Users/mw/MeineAppProjekte/aiconso/LinguasudApp"

export PATH="/Users/mw/.npm-global/bin:/Users/mw/.local/bin:/Users/mw/.bun/bin:/Users/mw/.grok/bin:/Users/mw/.cargo/bin:/Users/mw/.mavis/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export NODE_ENV=development

cd "$PROJECT_DIR"
exec pnpm dev
