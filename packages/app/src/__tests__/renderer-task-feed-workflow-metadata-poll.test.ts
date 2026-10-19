import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workflow } from '@invoker/data-store';
import { createRendererTaskFeed } from '../window/renderer-task-feed.js';

const DB_POLL_INTERVAL_MS = 2_000;
const DOWNSTREAM_WORKFLOW_ID = 'wf-downstream';
const UPSTREAM_WORKFLOW_ID = 'wf-upstream';

function workflowRecord(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: DOWNSTREAM_WORKFLOW_ID,
    name: 'Downstream',
    status: 'review_ready',
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
    ...overrides,
  } as Workflow;
}

function createFeedWithLiveWindow(listWorkflows: () => Workflow[]) {
  const requestWorkflowMetadataPublish = vi.fn();
  const feed = createRendererTaskFeed({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    persistence: {
      listWorkflows,
      loadTasks: () => [],
      loadTasksForWorkflows: () => [],
      loadTask: () => undefined,
      writeActivityLog: vi.fn(),
      appendOutputChunk: vi.fn(),
      getOutputTail: () => [],
      appendTaskOutput: vi.fn(),
    },
    messageBus: { publish: vi.fn() },
    getOrchestrator: () => ({
      getAllTasks: () => [],
      getMergeNode: () => undefined,
      syncAllFromDb: vi.fn(),
      handleWorkerResponse: vi.fn(),
      reclaimStalledFixSession: vi.fn(),
    }),
    taskHandles: { has: () => false },
    taskGraphEventPublisher: { publishDelta: vi.fn() },
    getMainWindow: () => ({ isDestroyed: () => false }) as never,
    setStartupWorkflowId: vi.fn(),
    requestWorkflowMetadataPublish,
    scheduleAutoFix: vi.fn(),
    logAutoFixDebug: vi.fn(),
    uiPerfStats: {
      mainDeltaToUi: 0,
      dbPollCreated: 0,
      dbPollUpdatedAsCreated: 0,
      workflowMetadataPublishes: 0,
      workflowMetadataCoalescedRequests: 0,
    },
    traceUiDeltaFlow: false,
    traceDbPollPerTask: false,
    traceTaskOutput: false,
    executingStallTimeoutMs: 120_000,
    pollLaunchDispatcher: vi.fn(),
  });
  return { feed, requestWorkflowMetadataPublish };
}

describe('renderer task feed db-poll workflow metadata', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('republishes workflows when an owner-side attach changes metadata without changing the count', async () => {
    let workflows = [workflowRecord(), workflowRecord({ id: UPSTREAM_WORKFLOW_ID, name: 'Upstream', status: 'completed' })];
    const { feed, requestWorkflowMetadataPublish } = createFeedWithLiveWindow(() => workflows);
    const handle = feed.startDbPolling();

    await vi.advanceTimersByTimeAsync(DB_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(DB_POLL_INTERVAL_MS);
    requestWorkflowMetadataPublish.mockClear();

    workflows = [
      workflowRecord({
        updatedAt: '2026-10-16T00:00:05.000Z',
        externalDependencies: [{ workflowId: UPSTREAM_WORKFLOW_ID, taskId: '__merge__', requiredStatus: 'completed', gatePolicy: 'completed' }],
      }),
      workflows[1],
    ];
    await vi.advanceTimersByTimeAsync(DB_POLL_INTERVAL_MS);

    expect(requestWorkflowMetadataPublish).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('does not republish when no workflow changed between polls', async () => {
    const workflows = [workflowRecord()];
    const { feed, requestWorkflowMetadataPublish } = createFeedWithLiveWindow(() => workflows);
    const handle = feed.startDbPolling();

    await vi.advanceTimersByTimeAsync(DB_POLL_INTERVAL_MS);
    requestWorkflowMetadataPublish.mockClear();
    await vi.advanceTimersByTimeAsync(DB_POLL_INTERVAL_MS * 3);

    expect(requestWorkflowMetadataPublish).not.toHaveBeenCalled();
    handle.stop();
  });
});
