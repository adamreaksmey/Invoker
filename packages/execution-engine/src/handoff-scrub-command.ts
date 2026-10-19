const READ_ONLY_HANDOFF_SCRUB_INVOCATION = /^(?:bash\s+)?(?:\.\/)?scripts\/scrub[-_a-z]*handoff[-_a-z]*artifacts[-_a-z]*\.sh(?:\s+--check)?$/i;

const HANDOFF_SCRUB_WORKTREE_CHECK = `set -euo pipefail
remaining="$(
  find . -maxdepth 4 \\( -name candidates.json -o -name 'research-*.json' -o -name 'lens-*.json' \\) \\
    ! -path './.git/*' ! -path './node_modules/*' ! -path './scripts/*' ! -path './packages/*' \\
    -print || exit $?
  for path in plans/invoker-handoff.md plans/invoker-handoff.yaml; do
    if [[ -e "$path" || -L "$path" ]]; then
      printf '%s\\n' "./$path"
    fi
  done
)"
if [[ -n "$remaining" ]]; then
  printf '%s\\n' 'handoff files remain in worktree:' >&2
  printf '%s\\n' "$remaining" >&2
  exit 1
fi
printf '%s\\n' 'scrub-handoff-artifacts-ok'
`;

export function resolveHandoffScrubCommand(command: string): string {
  if (!READ_ONLY_HANDOFF_SCRUB_INVOCATION.test(command.trim())) return command;
  return HANDOFF_SCRUB_WORKTREE_CHECK;
}
