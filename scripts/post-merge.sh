#!/bin/bash
# Always install git hooks first — this must succeed even if later steps fail.
bash "$(dirname "$0")/setup-git-hooks.sh"

set -e
pnpm install --frozen-lockfile
pnpm --filter db push
