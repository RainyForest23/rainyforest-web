#!/usr/bin/env bash
# Upload the static export so that no served HTML ever points at a missing asset.
set -euo pipefail
: "${SITE_BUCKET:?SITE_BUCKET is required}"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID is required}"
OUT_DIR="${OUT_DIR:-out}"
IMMUTABLE="public, max-age=31536000, immutable"
REVALIDATE="public, max-age=0, s-maxage=31536000, must-revalidate"

# 1. New hashed assets first, without deleting: cached HTML may still use the old ones.
aws s3 sync "$OUT_DIR/_next/static" "s3://$SITE_BUCKET/_next/static" --cache-control "$IMMUTABLE"

# 2. Pages and other files; remove pages that no longer exist.
aws s3 sync "$OUT_DIR" "s3://$SITE_BUCKET" --delete \
  --exclude "_next/static/*" --cache-control "$REVALIDATE"

# 3. Drop cached HTML and wait until the edge serves the new build.
invalidation_id=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" --id "$invalidation_id"

# 4. No cached page references old assets any more; prune them.
aws s3 sync "$OUT_DIR/_next/static" "s3://$SITE_BUCKET/_next/static" --delete \
  --cache-control "$IMMUTABLE"

echo "deploy: ok (invalidation $invalidation_id)"
