#!/usr/bin/env sh
# bundle the HTML/JS of the web-decker implementation as a c header file,
# for inclusion with the native versions of decker and lilt.

set -e

DECK=$1
if test -z "$DECK" ; then
	echo "Missing source deck">&2
	exit 1
fi

DST=c/resources.h

# Keep every xxd call under one redirection. Repeated `>> "$DST"` writes can
# corrupt this file on Windows/MSYS2 when xxd resolves to Git-for-Windows xxd.
# See docs/korean-ui-maintenance.md.
{
	printf "%s\n" "// auto-generated from web-decker source!"
	xxd -i js/lil.js
	xxd -i js/danger.js
	xxd -i js/ko-ui-strings.js
	xxd -i js/ko-ui-font.js
	xxd -i js/decker.html
	xxd -i js/decker.js
	xxd -i "$DECK"
} > "$DST"
