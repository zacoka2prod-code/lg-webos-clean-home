#!/bin/sh
# C9: remap Home in the input process only. Do not inject the TV/AV service.
(
  n=0
  while [ "$n" -lt 60 ]; do
    c9pid=$(pidof lginput2)
    [ -n "$c9pid" ] && break
    sleep 1
    n=$((n + 1))
  done
  [ -n "$c9pid" ] || exit 1
  c9dir=/media/developer/apps/usr/palm/services/org.webosbrew.inputhook.service/inputhook
  [ -f "$c9dir/libinputhookpp.so" ] || exit 1
  # The app's original service uses this marker to avoid duplicate injections.
  touch /tmp/inputhook
  if grep -q "$c9dir/libinputhookpp.so" "/proc/$c9pid/maps"; then exit 0; fi
  "$c9dir/ezinject" -l /tmp/lginput-hook-lginput2.log "$c9pid" "$c9dir/libinputhookpp.so" > /tmp/c9-home-key-injection.log 2>&1
) </dev/null >/tmp/c9-home-key-start.log 2>&1 &
exit 0
