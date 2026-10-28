#!/bin/zsh
# Toggle-Skript für den Linguasud-Next.js-Dev-Server (LaunchAgent).
# Aufruf:  ./toggle-dev-server.sh start|stop|restart|status|toggle

set -eu

SERVICE="com.linguasud.app.dev"
PLIST="$HOME/Library/LaunchAgents/com.linguasud.app.dev.plist"
USER_ID=$(id -u)
GUI_DOMAIN="gui/$USER_ID"

cmd="${1:-toggle}"

case "$cmd" in
  start)
    launchctl bootstrap "$GUI_DOMAIN" "$PLIST" 2>&1 || echo "bereits gestartet oder Fehler"
    ;;
  stop)
    launchctl bootout "$GUI_DOMAIN/$SERVICE" 2>&1 || echo "bereits gestoppt oder Fehler"
    ;;
  restart)
    "$0" stop 2>/dev/null || true
    sleep 1
    "$0" start
    ;;
  toggle)
    if launchctl list 2>/dev/null | grep -q "$SERVICE"; then
      "$0" stop
    else
      "$0" start
    fi
    ;;
  status)
    if launchctl list 2>/dev/null | grep -q "$SERVICE"; then
      echo "running"
    else
      echo "stopped"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|toggle}"
    exit 1
    ;;
esac
