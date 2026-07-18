#!/usr/bin/env bash
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

set -euo pipefail

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN is not set"
  echo "Generate one at https://supabase.com/dashboard/account/tokens"
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:?Error: SUPABASE_PROJECT_REF is not set. See .env.example.}"

echo "Linking to Supabase project $SUPABASE_PROJECT_REF..."
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "Pushing migrations..."
npx supabase db push

echo "Migrations applied successfully."
