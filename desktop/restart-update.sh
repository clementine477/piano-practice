#!/bin/bash
# Arguments are passed as argv, never interpolated shell code. No sudo / xattr bypass.
set -eu
parent_pid="$1"
staged_app="$2"
live_app="$3"
backup_app="$4"
log_file="$5"
exec >>"$log_file" 2>&1
for ((i=0;i<120;i++)); do
  if ! kill -0 "$parent_pid" 2>/dev/null; then break; fi
  sleep 1
done
if kill -0 "$parent_pid" 2>/dev/null; then echo 'App did not quit; update cancelled'; exit 1; fi
if [ -e "$backup_app" ]; then echo 'Backup already exists; cancelled'; exit 1; fi
/usr/bin/codesign --verify --deep --strict "$staged_app"
/bin/mv "$live_app" "$backup_app"
rollback() {
  if [ -e "$live_app" ]; then /bin/mv "$live_app" "${live_app}.failed-$(date +%s)"; fi
  /bin/mv "$backup_app" "$live_app"
  /usr/bin/open "$live_app" || true
}
trap rollback ERR
/bin/mv "$staged_app" "$live_app"
/usr/bin/open "$live_app"
trap - ERR
# Keep the complete previous app for manual rollback, including after a later crash.
echo "Installed. Previous app retained: $backup_app"
