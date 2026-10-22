#!/usr/bin/env bash
#
# deploy.sh — Build, install and launch Launch Home on a TV over SSH.
#
# Usage:
#   npm run deploy
#   ARES_DEVICE=emulator npm run deploy
#   LAUNCH=0 npm run deploy
#
# Self-contained. Resolves the ares device, runs `npm run pack`, copies the IPK
# to the TV and installs it with appinstalld (luna .../appInstallService/dev/install)
# in a single SSH call that waits on the TV and returns as soon as the install
# finishes, then launches the app. ares-install is never used: its exec channel
# fails against the TV's dropbear ("Unable to exec") after uploading.
#
# Environment:
#   ARES_DEVICE      ares device name (default: the ares default device)
#   LAUNCH           1 or 0 — launch the app after install (default: 1)
#   INSTALL_TIMEOUT  seconds to wait for the install (default: 90)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ARES_DEVICE="${ARES_DEVICE:-}"
LAUNCH="${LAUNCH:-1}"
INSTALL_TIMEOUT="${INSTALL_TIMEOUT:-90}"

APP_ID="org.webosbrew.lounge.launcher"
REMOTE_TMP="/media/developer/temp"

c_grn() { printf '\033[32m%s\033[0m' "$*"; }
c_red() { printf '\033[31m%s\033[0m' "$*"; }
section() { printf "\n\033[1;36m━━ %s ━━\033[0m\n" "$*"; }
die() { printf "%s\n" "$(c_red "error: $*")" >&2; exit 1; }

# ── Resolve the target device ────────────────────────────────────────────────
section "Resolving ares device"
fields="$(ARES_DEVICE="$ARES_DEVICE" node "$SCRIPT_DIR/ares-default-device.js")" \
	|| die "Could not resolve the ares device. Add one with ares-setup-device."
IFS=$'\t' read -r DEV_NAME DEV_HOST DEV_PORT DEV_USER DEV_KEY _ <<<"$fields"

[[ -n "$DEV_HOST" ]] || die "Resolved ares device \"$DEV_NAME\" has no host."
DEV_USER="${DEV_USER:-root}"
DEV_PORT="${DEV_PORT:-22}"
SSH_KEY_PATH="$HOME/.ssh/${DEV_KEY:-webos_deploy}"
[[ -f "$SSH_KEY_PATH" ]] || die "SSH key not found: $SSH_KEY_PATH"
TARGET="${DEV_USER}@${DEV_HOST}"

printf "  Device: %s (%s)\n" "$(c_grn "$DEV_NAME")" "$TARGET:$DEV_PORT"

SSH_BASE=(-o BatchMode=yes -o StrictHostKeyChecking=no -o LogLevel=ERROR -p "$DEV_PORT" -i "$SSH_KEY_PATH")
ssh_tv() { ssh -o ConnectTimeout=10 "${SSH_BASE[@]}" "$TARGET" "$@"; }
ssh_tty() { ssh -tt -o ConnectTimeout=15 "${SSH_BASE[@]}" "$TARGET" "$@"; }
scp_tv() { scp -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=no -o LogLevel=ERROR -P "$DEV_PORT" -i "$SSH_KEY_PATH" "$@"; }

wait_for_ssh() {
	local i
	for i in 1 2 3 4 5; do
		ssh_tv "true" >/dev/null 2>&1 && return 0
		sleep 2
	done
	return 1
}

# ── Build and package ────────────────────────────────────────────────────────
section "Building app"
(cd "$ROOT_DIR" && npm run --silent pack)

VERSION="$(node "$SCRIPT_DIR/read-version.js")"
IPK="$ROOT_DIR/dist/${APP_ID}_${VERSION}_all.ipk"
[[ -f "$IPK" ]] || die "Missing package: $IPK"
REMOTE_IPK="$REMOTE_TMP/$(basename "$IPK")"
APP_DIR="/media/developer/apps/usr/palm/applications/$APP_ID"

# ── Install over SSH ─────────────────────────────────────────────────────────
section "Installing to TV"
wait_for_ssh || die "SSH to $TARGET failed."

# Close a running Launch Home before replacing its files. The installer
# (appInstallService dev/install) closes it as well and the next launch loads
# the new files, same version or not (checked on webOS 25). Never
# `pkill -f <app id>`: it matched every process with the app folder in its
# command line, including the voice service (voice-run.sh, voice_daemon.py)
# and the SSH shell running it.
close_payload="$(printf '{"id":"%s"}' "$APP_ID")"
ssh_tv "if [ -x /usr/bin/luna-send ]; then luna-send -n 1 -w 8000 -f luna://com.webos.applicationManager/closeByAppId '$close_payload'; else /usr/bin/luna-send-pub -n 1 -w 8000 luna://com.webos.applicationManager/closeByAppId '$close_payload'; fi" >/dev/null 2>&1 || true

ssh_tv "rm -rf '$REMOTE_TMP' && mkdir -p '$REMOTE_TMP' && chmod 777 '$REMOTE_TMP'"
printf "  Uploading %s…\n" "$(basename "$IPK")"
scp_tv "$IPK" "$TARGET:$REMOTE_IPK" >/dev/null

payload="$(printf '{"id":"com.ares.defaultName","ipkUrl":"%s","subscribe":true}' "$REMOTE_IPK")"

# Run luna-send in the background and wait on the TV. A foreground subscribe
# never returns after "installed" (it keeps waiting for more replies), so poll
# the log and kill it as soon as the final state arrives. Keeping the loop on
# the TV means one SSH call instead of a round-trip every second.
remote_install() {
	cat <<REMOTE
log=/tmp/launch-home-install.log
rm -f "\$log"
uri='luna://com.webos.appInstallService/dev/install'
payload='${payload}'
if [ -x /usr/bin/luna-send ]; then
	luna-send -i "\$uri" "\$payload" >"\$log" 2>&1 &
else
	/usr/bin/luna-send-pub -n 999 -w 90000 "\$uri" "\$payload" >"\$log" 2>&1 &
fi
pid=\$!
n=0
while [ \$n -lt ${INSTALL_TIMEOUT} ]; do
	if grep -qE '"state": ?"(installed|failed)"' "\$log" 2>/dev/null; then break; fi
	sleep 1
	n=\$((n + 1))
done
kill \$pid 2>/dev/null
grep -oE '"state": ?"(installed|failed)"' "\$log" | tail -n 1
REMOTE
}

printf "  Waiting for install…\n"
state="$(ssh_tv "$(remote_install)" 2>/dev/null || true)"
case "$state" in
*'"installed"'*) : ;;
*) die "Install did not complete for ${APP_ID} ${VERSION} (state: ${state:-unknown})." ;;
esac

# ── Verify ───────────────────────────────────────────────────────────────────
ssh_tv "grep -q '\"version\": *\"${VERSION}\"' '${APP_DIR}/appinfo.json'" \
	|| die "Install did not update ${APP_ID} to ${VERSION} on the TV."

# Same-version reinstalls can report success without replacing assets; compare
# the shipped icon's size to confirm the files actually landed.
local_icon_bytes="$(wc -c <"$ROOT_DIR/dist/assets/icon-80-v8.png" | tr -d ' ')"
remote_icon_bytes="$(ssh_tv "wc -c <'${APP_DIR}/assets/icon-80-v8.png'" 2>/dev/null | tr -d '[:space:]')"
[[ "$remote_icon_bytes" == "$local_icon_bytes" ]] \
	|| die "Install reported success but assets were not replaced (icon: ${remote_icon_bytes:-missing} vs ${local_icon_bytes} bytes)."
printf "  %s\n" "$(c_grn "Installed ${APP_ID} ${VERSION}")"

ssh_tv "rm -f '${REMOTE_IPK}' /tmp/launch-home-install.log; /usr/sbin/ls-control scan-services" >/dev/null 2>&1 || true

# ── Launch ───────────────────────────────────────────────────────────────────
if [[ "$LAUNCH" == "1" ]]; then
	section "Launching app"
	out="$(ssh_tty "luna-send -n 1 -w 15000 -f 'luna://com.webos.applicationManager/launch' '{\"id\":\"${APP_ID}\"}'" 2>/dev/null || true)"
	printf '%s\n' "$out" | grep -q '"returnValue": true' \
		|| die "Launch failed for ${APP_ID}."
	printf "  %s\n" "$(c_grn "Launched ${APP_ID}")"
fi

printf "\n  %s\n" "$(c_grn "Launch Home is on your TV")"
