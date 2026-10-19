#!/usr/bin/env bash
# The completeness gate must not treat the product word "todo" as a TODO placeholder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/todo-placeholder.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

word="$tmp/word.yaml"
token="$tmp/token.yaml"
folded="$tmp/folded.yaml"

cat > "$word" <<'YAML'
name: "Build a todo app"
onFinish: none
mergeMode: no_op
repoUrl: https://github.com/Neko-Catpital-Labs/Invoker.git

tasks:
  - id: build-vue-todo-app
    description: |
      Goal: Ship a Todo list
      Motivation: The user asked for a todo app
      Safety invariant: Keep todos in memory
      Effectiveness measurement: leading signal A; lagging signal B beyond fixture e2e
      Review claim: c
      Review lane: docs
      Slice rationale: s
      Architectural effect: none
      Alternative considerations: none
      Implementation details: n
      Non-goals: n
      Layer: docs
      Feature state: active
      Acceptance criteria:
      - `true`
    command: "true"
    dependencies: []
YAML

cat > "$token" <<'YAML'
name: "placeholder token"
onFinish: none
mergeMode: no_op
repoUrl: https://github.com/Neko-Catpital-Labs/Invoker.git

tasks:
  - id: fill-later
    description: |
      Goal: TODO
      Motivation: y
      Safety invariant: z
      Effectiveness measurement: leading signal A; lagging signal B beyond fixture e2e
      Review claim: c
      Review lane: docs
      Slice rationale: s
      Architectural effect: none
      Alternative considerations: none
      Implementation details: n
      Non-goals: n
      Layer: docs
      Feature state: active
      Acceptance criteria:
      - `true`
    command: "true"
    dependencies: []
YAML

cat > "$folded" <<'YAML'
name: "folded placeholders"
onFinish: none
mergeMode: no_op
repoUrl: https://github.com/Neko-Catpital-Labs/Invoker.git

tasks:
  - id: fill-later
    description: |
      Goal: replace_me later
      Motivation: y
      Safety invariant: z
      Effectiveness measurement: leading signal A; lagging signal B beyond fixture e2e
      Review claim: c
      Review lane: docs
      Slice rationale: s
      Architectural effect: none
      Alternative considerations: none
      Implementation details: n
      Non-goals: n
      Layer: docs
      Feature state: active
      Acceptance criteria:
      - `true`
    command: "true"
    dependencies: []
YAML

check() {
  bash "$ROOT/skills/plan-to-invoker/scripts/check-planning-completeness.sh" "$1" 2>"$2"
}

set +e
check "$word" "$tmp/word.err"
word_ec=$?
check "$token" "$tmp/token.err"
token_ec=$?
check "$folded" "$tmp/folded.err"
folded_ec=$?
set -e

if [[ "$word_ec" -ne 0 ]]; then
  echo "expected the todo-app plan to pass, got $word_ec" >&2
  cat "$tmp/word.err" >&2
  exit 1
fi
if grep -q 'REPLACE_ME / TODO' "$tmp/word.err"; then
  echo "todo-app plan was flagged as a placeholder" >&2
  cat "$tmp/word.err" >&2
  exit 1
fi
if [[ "$token_ec" -eq 0 ]] || ! grep -q 'REPLACE_ME / TODO' "$tmp/token.err"; then
  echo "expected uppercase TODO to fail the placeholder gate, got $token_ec" >&2
  cat "$tmp/token.err" >&2
  exit 1
fi
if [[ "$folded_ec" -eq 0 ]] || ! grep -q 'REPLACE_ME / TODO' "$tmp/folded.err"; then
  echo "expected replace_me to fail the placeholder gate, got $folded_ec" >&2
  cat "$tmp/folded.err" >&2
  exit 1
fi

echo "todo word passes; TODO and replace_me still fail"
