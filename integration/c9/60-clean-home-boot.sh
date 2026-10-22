#!/bin/sh
# Open the home once after boot; no foreground polling or media player.
[ -e /tmp/c9-clean-home-boot ] && exit 0
touch /tmp/c9-clean-home-boot
(
  sleep 25
  [ -f /media/developer/apps/usr/palm/applications/org.webosbrew.lounge.launcher/appinfo.json ] || exit 0
  sleep 3 | luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"org.webosbrew.lounge.launcher"}'
) </dev/null >/tmp/c9-clean-home-boot.log 2>&1 &
exit 0
