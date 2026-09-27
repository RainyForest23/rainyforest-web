#!/usr/bin/env bash
# Checks the live site after a deploy. Fails loudly on the first broken expectation.
# SITE_URL is the public origin, e.g. https://rainyforest-web.<account>.workers.dev or https://example.com
set -euo pipefail
: "${SITE_URL:?SITE_URL is required}"
: "${EXPECTED_SHA:?EXPECTED_SHA is required}"
SITE_URL="${SITE_URL%/}"
host="${SITE_URL#https://}"

fail() { echo "smoke: $*" >&2; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$1"; }

# A new version reaches every edge location within seconds; allow a short wait.
for attempt in 1 2 3 4 5 6; do
  curl -fsS "$SITE_URL/" | grep -qF "content=\"$EXPECTED_SHA\"" && break
  [ "$attempt" = 6 ] && fail "home page is not build $EXPECTED_SHA"
  sleep 10
done

[ "$(status "$SITE_URL/definitely-missing-page/")" = "404" ] \
  || fail "a missing page did not return 404"

curl -fsS "$SITE_URL/sitemap.xml" | grep -qF "<loc>$SITE_URL/" \
  || fail "sitemap does not use $SITE_URL (was SITE_URL set for the build?)"

# Only a custom domain has a www twin (redirected by a Cloudflare Redirect Rule, see README).
if [[ "$host" != *.workers.dev ]]; then
  [ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$host/")" \
    = "301 $SITE_URL/" ] || fail "www did not 301 to the apex"
fi

echo "smoke: ok ($SITE_URL @ $EXPECTED_SHA)"
