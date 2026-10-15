import { describe, expect, it } from 'vitest';
import { parsePlanningDraftTaskDescription } from './planning-draft-task-view.js';

describe('parsePlanningDraftTaskDescription', () => {
  it('parses labeled review metadata into structured fields', () => {
    const raw = [
      'Build a complete, responsive Vue task manager with client-only state.',
      'Layer: ui',
      'Feature state: active',
      'Review claim: Deliver an accessible task management interface.',
      'Review lane: behavior',
      'Safety invariant: Keep all task data in client memory.',
      'Files: packages/web-app/src/App.vue, packages/web-app/src/main.ts',
      'Verify: pnpm --filter @invoker/web-app build',
    ].join('\n');

    const view = parsePlanningDraftTaskDescription(raw);

    expect(view.structured).toBe(true);
    expect(view.title).toBe('Build a complete, responsive Vue task manager with client-only state.');
    expect(view.fields).toEqual([
      { label: 'Layer', value: 'ui' },
      { label: 'Feature state', value: 'active' },
      { label: 'Review claim', value: 'Deliver an accessible task management interface.' },
      { label: 'Review lane', value: 'behavior' },
      { label: 'Safety invariant', value: 'Keep all task data in client memory.' },
      { label: 'Files', value: 'packages/web-app/src/App.vue, packages/web-app/src/main.ts' },
      { label: 'Verify', value: 'pnpm --filter @invoker/web-app build' },
    ]);
    expect(view.body).toBe('');
  });

  it('keeps multi-line field values until the next known label', () => {
    const raw = [
      'Define contracts',
      'Review claim: Define `contracts`',
      'Implementation details: Inspect the existing frontend.',
      'Include filters and empty states.',
      'Acceptance criteria: build exits 0',
    ].join('\n');

    const view = parsePlanningDraftTaskDescription(raw);

    expect(view.fields.find((field) => field.label === 'Implementation details')?.value).toBe(
      'Inspect the existing frontend.\nInclude filters and empty states.',
    );
    expect(view.fields.find((field) => field.label === 'Acceptance criteria')?.value).toBe(
      'build exits 0',
    );
  });

  it('keeps a layer exception out of the layer pill value', () => {
    const raw = [
      'Review claim: The terminal check reports leaked handoff artifacts without changing repository state.',
      'Layer: e2e_regression',
      'Layer exception: allowed — this repository hygiene check is the required terminal gate after the UI implementation, and it makes no product-layer changes.',
      'Feature state: active',
    ].join('\n');

    const view = parsePlanningDraftTaskDescription(raw);

    expect(view.fields.find((field) => field.label === 'Layer')?.value).toBe('e2e_regression');
    expect(view.fields.find((field) => field.label === 'Layer exception')?.value).toContain('allowed');
    expect(view.fields.find((field) => field.label === 'Feature state')?.value).toBe('active');
  });

  it('passes through unlabeled text without structured fields', () => {
    const raw = 'Verify contracts';
    const view = parsePlanningDraftTaskDescription(raw);

    expect(view.structured).toBe(false);
    expect(view.title).toBe('Verify contracts');
    expect(view.fields).toEqual([]);
    expect(view.body).toBe('');
    expect(view.raw).toBe(raw);
  });

  it('uses the first line as title for unlabeled multi-line blobs', () => {
    const raw = 'First line\nSecond line without labels';
    const view = parsePlanningDraftTaskDescription(raw);

    expect(view.structured).toBe(false);
    expect(view.title).toBe('First line');
    expect(view.body).toBe(raw);
  });
});
