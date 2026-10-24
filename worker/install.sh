#!/usr/bin/env bash
# Install the render worker on this machine as a systemd user timer.
#   ./worker/install.sh            (after saving the token, see README.md)
set -euo pipefail
cfg="$HOME/.config/fog-adverts/worker.env"
if ! grep -q '^FOG_WORKER_TOKEN=fogw_' "$cfg" 2>/dev/null; then
  echo "Save the worker token first: $cfg (see worker/README.md)"; exit 1
fi
chmod 600 "$cfg"
mkdir -p "$HOME/.config/systemd/user"
cp "$(dirname "$0")/systemd/fog-advert-worker."{service,timer} "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now fog-advert-worker.timer
loginctl enable-linger "$USER" 2>/dev/null || true   # keep running when logged out
systemctl --user list-timers fog-advert-worker.timer --no-pager
