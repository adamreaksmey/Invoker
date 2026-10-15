export const PLANNING_DRAFT_FIELD_LABELS = [
  'Layer',
  'Layer exception',
  'Feature state',
  'Review claim',
  'Review lane',
  'Safety invariant',
  'Slice rationale',
  'Architectural effect',
  'Non-goals',
  'Goal',
  'Motivation',
  'Alternative considerations',
  'Implementation details',
  'Files',
  'Change types',
  'Acceptance criteria',
  'Effectiveness measurement',
  'Verify',
] as const;

export type PlanningDraftFieldLabel = (typeof PLANNING_DRAFT_FIELD_LABELS)[number];

export interface PlanningDraftTaskField {
  label: PlanningDraftFieldLabel;
  value: string;
}

export interface PlanningDraftTaskView {
  title: string;
  fields: PlanningDraftTaskField[];
  body: string;
  raw: string;
  structured: boolean;
}

const LABEL_PATTERN = PLANNING_DRAFT_FIELD_LABELS
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const FIELD_LINE_RE = new RegExp(`^(${LABEL_PATTERN}):\\s*(.*)$`, 'i');

const LABEL_BY_LOWER = new Map(
  PLANNING_DRAFT_FIELD_LABELS.map((label) => [label.toLowerCase(), label]),
);

function canonicalLabel(rawLabel: string): PlanningDraftFieldLabel | null {
  return LABEL_BY_LOWER.get(rawLabel.toLowerCase()) ?? null;
}

function flushBody(parts: string[]): string {
  return parts.join('\n').trim();
}

export function parsePlanningDraftTaskDescription(raw: string): PlanningDraftTaskView {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return { title: '', fields: [], body: '', raw, structured: false };
  }

  const lines = text.split('\n');
  const titleParts: string[] = [];
  const bodyParts: string[] = [];
  const fields: PlanningDraftTaskField[] = [];
  let activeField: PlanningDraftTaskField | null = null;
  let seenField = false;

  const pushActiveField = (): void => {
    if (!activeField) return;
    activeField.value = activeField.value.trim();
    fields.push(activeField);
    activeField = null;
  };

  for (const line of lines) {
    const match = line.match(FIELD_LINE_RE);
    if (match) {
      const label = canonicalLabel(match[1] ?? '');
      if (label) {
        pushActiveField();
        seenField = true;
        activeField = { label, value: match[2] ?? '' };
        continue;
      }
    }

    if (activeField) {
      activeField.value = activeField.value
        ? `${activeField.value}\n${line}`
        : line;
      continue;
    }

    if (seenField) {
      bodyParts.push(line);
    } else {
      titleParts.push(line);
    }
  }

  pushActiveField();

  const title = flushBody(titleParts) || (fields[0]?.value.split('\n')[0]?.trim() ?? 'Task');
  const body = flushBody(bodyParts);
  const structured = fields.length > 0;

  if (!structured) {
    return {
      title: text.split('\n')[0]?.trim() || text,
      fields: [],
      body: text.includes('\n') ? text : '',
      raw,
      structured: false,
    };
  }

  return { title, fields, body, raw, structured: true };
}
