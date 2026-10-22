#!/bin/sh
# Launch Home: launch on TV boot, and again when the TV wakes from standby
# (webOS Homebrew init.d).
#
#   boot-launch.sh              cold boot: wait for LS2, launch Launch Home
#                               until it is in front, then watch for wakes
#   boot-launch.sh --wake-only  only watch for wakes (started from Settings
#                               so wakes are handled before the next reboot)
#
# With Quick Start+ on, the power button only suspends the TV, so the init.d
# hook never runs on power-on. The wake watcher follows the TV's power state
# and relaunches Launch Home on every Suspend / Active Standby -> Active.
#
# Invoked detached from /var/lib/webosbrew/init.d/50-launch-home-boot.

APP_ID="org.webosbrew.lounge.launcher"
LOG="/tmp/launch-home-boot.log"
PIDFILE="/tmp/launch-home-boot.pid"

log() {
  echo "$(date '+%H:%M:%S' 2>/dev/null) $*" >>"$LOG" 2>/dev/null || true
}

# One instance only: the init.d hook and Settings can both start us.
if [ -f "$PIDFILE" ]; then
  oldpid=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$oldpid" ] && [ "$oldpid" != "$$" ] && kill -0 "$oldpid" 2>/dev/null; then
    log "already running pid=$oldpid, exiting"
    exit 0
  fi
fi
echo $$ >"$PIDFILE"

# Every process below $1 (children first found, then theirs), from /proc.
descendants() {
  for status in /proc/[0-9]*/status; do
    ppid=$(sed -n 's/^PPid:[[:space:]]*//p' "$status" 2>/dev/null)
    if [ "$ppid" = "$1" ]; then
      cpid=${status#/proc/}
      cpid=${cpid%/status}
      echo "$cpid"
      descendants "$cpid"
    fi
  done
}

# On stop, take the luna-send subscription and any sleep down with us.
stop() {
  trap '' INT TERM HUP
  # shellcheck disable=SC2046 # one pid per word
  kill $(descendants $$) 2>/dev/null
  rm -f "$PIDFILE"
  log "exit"
  exit 0
}
trap stop INT TERM HUP

log "boot-launch start pid=$$ $*"

luna_once() {
  uri=$1
  payload=$2
  out=$(luna-send -i -n 1 -w 4000 -f "$uri" "$payload" 2>/dev/null) && {
    printf '%s' "$out"
    return 0
  }
  out=$(luna-send -i -n 1 -f "$uri" "$payload" 2>/dev/null) && {
    printf '%s' "$out"
    return 0
  }
  out=$(luna-send -n 1 -f "$uri" "$payload" 2>/dev/null) && {
    printf '%s' "$out"
    return 0
  }
  return 1
}

foreground_app() {
  luna_once 'luna://com.webos.applicationManager/getForegroundAppInfo' '{"subscribe":true}' 2>/dev/null \
    | tr '\n' ' ' \
    | sed -n 's/.*"appId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

# Launch until Launch Home is in front on two checks in a row. Right after a
# boot or a wake the app manager can answer but drop the first launches, so
# keep retrying rather than waiting a fixed time. $1 = max checks, 2 s apart.
bring_up() {
  max=$1
  tries=0
  seen=0
  while [ "$tries" -lt "$max" ]; do
    tries=$((tries + 1))
    fg=$(foreground_app)
    if [ "$fg" = "$APP_ID" ]; then
      seen=$((seen + 1))
      if [ "$seen" -ge 2 ]; then
        log "Launch Home is foreground, done"
        return 0
      fi
    else
      seen=0
      log "launch attempt $tries (front: ${fg:-unknown})"
      luna_once 'luna://com.webos.applicationManager/launch' "{\"id\":\"${APP_ID}\"}" >/dev/null 2>&1 || true
    fi
    sleep 2
  done
  log "finished attempts (may still be launching under stock home)"
  return 1
}

# Some webOS builds print nothing without -i; older ones may lack -i. Probe
# once, then exec so luna-send is a direct child of this script and the stop
# trap above can end it.
subscribe_power() {
  if luna-send -i -n 1 -f 'luna://com.webos.service.tvpower/power/getPowerState' '{}' 2>/dev/null | grep -q state; then
    exec luna-send -i -f 'luna://com.webos.service.tvpower/power/getPowerState' '{"subscribe":true}' 2>/dev/null
  fi
  exec luna-send -f 'luna://com.webos.service.tvpower/power/getPowerState' '{"subscribe":true}' 2>/dev/null
}

# luna-send -f prints each reply as indented JSON closed by a "}" line.
watch_wakes() {
  while true; do
    sub_start=$(date +%s 2>/dev/null || echo 0)
    log "power subscribe start"
    subscribe_power | {
      last=""
      buf=""
      while IFS= read -r line || [ -n "$line" ]; do
        buf="$buf $line"
        [ "$line" = "}" ] || continue
        state=$(printf '%s' "$buf" | sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
        buf=""
        [ -n "$state" ] || continue
        [ "$state" = "$last" ] && continue
        log "power state: ${last:-?} -> $state"
        case "$last" in
          Suspend|"Active Standby")
            [ "$state" = "Active" ] && bring_up 15
            ;;
        esac
        last=$state
      done
    } &
    # Wait in the background so the stop trap runs at once; sh only runs traps
    # between commands, and the subscription pipeline never ends on its own.
    wait $!
    lasted=$(( $(date +%s 2>/dev/null || echo 0) - sub_start ))
    # A subscription that dies at once is not coming back soon; don't spin.
    if [ "$lasted" -lt 5 ]; then
      sleep 60
    else
      sleep 5
    fi
  done
}

if [ "$1" != "--wake-only" ]; then
  # Wait up to ~3 minutes for the app framework after power-on.
  i=0
  while [ "$i" -lt 90 ]; do
    if luna_once 'luna://com.webos.applicationManager/getForegroundAppInfo' '{"subscribe":true}' >/dev/null 2>&1; then
      log "ls2 ready after $((i * 2))s"
      break
    fi
    i=$((i + 1))
    sleep 2
  done
  bring_up 30
fi

watch_wakes
