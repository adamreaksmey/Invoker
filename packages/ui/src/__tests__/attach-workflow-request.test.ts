import { describe, expect, it } from 'vitest';
import {
  attachPickerEntries,
  attachedWorkflowNotice,
  duplicateAttachMessage,
  finishedWorkflowAttachOptions,
  upstreamWaitLabel,
  workflowDependsOnUpstream,
  workflowPickerMatches,
} from '../lib/attach-workflow-request.js';

describe('attach workflow request', () => {
  it('forces a finished plan so the line is recorded without rerunning it', () => {
    expect(finishedWorkflowAttachOptions('completed')).toEqual({ force: true });
    expect(finishedWorkflowAttachOptions('closed')).toEqual({ force: true });
    expect(finishedWorkflowAttachOptions('review_ready')).toBeUndefined();
  });

  it('hides an upstream that is already attached', () => {
    const workflows = [
      {
        id: 'wf-down',
        name: 'Downstream',
        externalDependencies: [{ workflowId: 'wf-up', taskId: '__merge__', requiredStatus: 'completed' as const, gatePolicy: 'completed' as const }],
      },
      { id: 'wf-up', name: 'Upstream' },
      { id: 'wf-other', name: 'Other' },
    ];

    expect(workflowDependsOnUpstream(workflows[0], 'wf-up')).toBe(true);
    expect(attachPickerEntries(workflows, 'wf-down')).toEqual([{ id: 'wf-other', name: 'Other' }]);
    const liveWorkflows = new Map(workflows.map((workflow) => [workflow.id, workflow]));
    expect(attachPickerEntries(liveWorkflows.values(), 'wf-down')).toEqual([
      { id: 'wf-other', name: 'Other' },
    ]);
    expect(duplicateAttachMessage('Downstream', 'Upstream')).toBe(
      'Downstream is already attached to Upstream.',
    );
    expect(attachedWorkflowNotice({
      workflowId: 'wf-down',
      upstreamWorkflowId: 'wf-up',
      downstreamName: 'Downstream',
      upstreamName: 'Upstream',
    })).toContain('The dependency was added.');
  });

  it('matches a workflow name even when the query is only part of it', () => {
    expect(workflowPickerMatches('Apply Times New Roman wf-2', '')).toBe(true);
    expect(workflowPickerMatches('Apply Times New Roman wf-2', 'times new')).toBe(true);
    expect(workflowPickerMatches('Apply Times New Roman wf-2', 'vue')).toBe(false);
  });

  it('names the upstream a plan waits on', () => {
    const upstreams = new Map([['wf-up', { name: 'Set all app text to 15px', status: 'running' as const }]]);
    expect(upstreamWaitLabel([{ workflowId: 'wf-up' }], upstreams)).toBe('Waits on Set all app text to 15px');
    expect(upstreamWaitLabel([{ workflowId: 'wf-up' }, { workflowId: 'wf-other' }], upstreams)).toBe(
      'Waits on 2 upstream workflows',
    );
    expect(upstreamWaitLabel([], upstreams)).toBeUndefined();
  });

  it('only counts upstreams that have not completed yet', () => {
    const upstreams = new Map([
      ['wf-done', { name: 'Done upstream', status: 'completed' as const }],
      ['wf-closed', { name: 'Closed upstream', status: 'closed' as const }],
      ['wf-running', { name: 'Running upstream', status: 'running' as const }],
    ]);
    expect(upstreamWaitLabel([{ workflowId: 'wf-done' }], upstreams)).toBeUndefined();
    expect(upstreamWaitLabel([{ workflowId: 'wf-done' }, { workflowId: 'wf-running' }], upstreams)).toBe(
      'Waits on Running upstream',
    );
    expect(upstreamWaitLabel([{ workflowId: 'wf-closed' }], upstreams)).toBe('Waits on Closed upstream');
    expect(upstreamWaitLabel([{ workflowId: 'wf-missing' }], upstreams)).toBe('Waits on wf-missing');
  });
});
