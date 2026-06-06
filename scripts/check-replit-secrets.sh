#!/usr/bin/env bash
# Pre-commit guard: scan .replit [userenv.shared] for likely secrets.
#
# Install as a pre-commit hook:
#   cp scripts/check-replit-secrets.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Or run manually:
#   bash scripts/check-replit-secrets.sh

set -euo pipefail

REPLIT_FILE=".replit"
FOUND=0

if [[ ! -f "$REPLIT_FILE" ]]; then
  echo "check-replit-secrets: $REPLIT_FILE not found, skipping."
  exit 0
fi

# Patterns that suggest a secret or API key value (case-insensitive)
PATTERNS=(
  "PASSWORD"
  "SECRET"
  "API_KEY"
  "TOKEN"
  "gsk_"
  "sk-"
  "sk_live"
  "rzp_"
  "AIza"
  "GROQ"
  "GEMINI"
  "DATABASE_URL"
  "JWT"
)

IN_USERENV_SHARED=0
LINENO=0

while IFS= read -r line; do
  LINENO=$((LINENO + 1))

  # Track whether we are inside [userenv.shared]
  if [[ "$line" =~ ^\[userenv\.shared\] ]]; then
    IN_USERENV_SHARED=1
    continue
  fi

  # Any new [section] header ends the userenv.shared block
  if [[ "$line" =~ ^\[ ]] && [[ ! "$line" =~ ^\[userenv\.shared\] ]]; then
    IN_USERENV_SHARED=0
  fi

  if [[ "$IN_USERENV_SHARED" -eq 1 ]]; then
    # Skip blank lines and comments
    [[ -z "${line// }" ]] && continue
    [[ "$line" =~ ^# ]] && continue

    for pattern in "${PATTERNS[@]}"; do
      if echo "$line" | grep -qi "$pattern"; then
        echo "ERROR: Potential secret in $REPLIT_FILE line $LINENO: $line"
        echo "       Move this value to the Replit Secrets store (padlock icon) instead."
        FOUND=1
        break
      fi
    done
  fi
done < "$REPLIT_FILE"

if [[ "$FOUND" -eq 1 ]]; then
  echo ""
  echo "Commit blocked: secrets detected in [userenv.shared] of $REPLIT_FILE."
  echo "The [userenv.shared] block is git-tracked and visible to anyone with"
  echo "repository access. Use Replit Secrets for all sensitive values."
  exit 1
fi

echo "check-replit-secrets: no secrets detected in $REPLIT_FILE."
exit 0
