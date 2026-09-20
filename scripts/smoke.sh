#!/usr/bin/env bash
# Checks the live domain after a deploy. Fails loudly on the first broken expectation.
set -euo pipefail
: "${SITE_DOMAIN:?SITE_DOMAIN is required}"
: "${EXPECTED_SHA:?EXPECTED_SHA is required}"

fail() { echo "smoke: $*" >&2; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

curl -fsS "https://$SITE_DOMAIN/" | grep -qF "content=\"$EXPECTED_SHA\"" \
  || fail "home page is not build $EXPECTED_SHA"

[ "$(status "https://$SITE_DOMAIN/definitely-missing-page/")" = "404" ] \
  || fail "a missing page did not return 404"

[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$SITE_DOMAIN/")" \
  = "301 https://$SITE_DOMAIN/" ] || fail "www did not 301 to the apex"

[ "$(status "http://$SITE_DOMAIN/")" = "301" ] || fail "http did not redirect to https"

echo "smoke: ok ($SITE_DOMAIN @ $EXPECTED_SHA)"
