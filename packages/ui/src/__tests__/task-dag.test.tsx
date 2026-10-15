import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as ReactFlowModule from '@xyflow/react';
import { TaskDAG } from '../components/TaskDAG.js';
import { makeUITask } from './helpers/mock-invoker.js';
import type { TaskState, WorkflowMeta } from '../types.js';

vi.mock('@xyflow/react', async () => {
  // Vitest hoists mock factories before static helper imports initialize.
  const { createReactFlowMock } = await import('./helpers/mock-react-flow.js');
  return createReactFlowMock();
});

const fitViewMock = (ReactFlowModule as unknown as { __fitViewMock: Mock }).__fitViewMock;
const setCenterMock = (ReactFlowModule as unknown as { __setCenterMock: Mock }).__setCenterMock;
const getZoomMock = (ReactFlowModule as unknown as { __getZoomMock: Mock }).__getZoomMock;

describe('TaskDAG status filters', () => {
  beforeEach(() => {
    fitViewMock.mockClear();
    setCenterMock.mockClear();
    getZoomMock.mockReset();
    getZoomMock.mockReturnValue(1);
  });

  it('keeps queue-assigning tasks visible under the assigning filter', async () => {
    const assigningTask = makeUITask({
      id: 'wf-1/assigning-task',
      workflowId: 'wf-1',
      status: 'pending',
      description: 'assigning task',
      execution: { phase: 'launching', selectedAttemptId: 'wf-1/assigning-task-a1' },
    });
    const pendingTask = makeUITask({
      id: 'wf-1/pending-task',
      workflowId: 'wf-1',
      status: 'pending',
      description: 'pending task',
      dependencies: ['wf-1/assigning-task'],
    });
    const tasks = new Map<string, TaskState>([
      [assigningTask.id, assigningTask],
      [pendingTask.id, pendingTask],
    ]);
    const workflows = new Map<string, WorkflowMeta>([
      ['wf-1', { id: 'wf-1', name: 'wf-1', status: 'running' }],
    ]);

    render(
      <TaskDAG
        tasks={tasks}
        workflows={workflows}
        statusFilters={new Set(['assigning'])}
        runningTaskIds={new Set([assigningTask.id])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId(`rf__node-${assigningTask.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`rf__node-${pendingTask.id}`)).toBeInTheDocument();
    });

    expect(screen.getByText('Assigning')).toBeInTheDocument();

    const assigningNode = screen.getByTestId(`rf__node-${assigningTask.id}`).firstElementChild as HTMLElement;
    const pendingNode = screen.getByTestId(`rf__node-${pendingTask.id}`).firstElementChild as HTMLElement;

    expect(assigningNode.className).not.toContain('opacity-20');
    expect(pendingNode.className).toContain('opacity-20');
  });

  it('omits workflow prefixes from generated edge labels for scoped task ids', async () => {
    const setupTask = makeUITask({
      id: 'wf-alpha/setup-task',
      workflowId: 'wf-alpha',
      status: 'completed',
      description: 'Setup task',
    });
    const renderTask = makeUITask({
      id: 'wf-alpha/render-task',
      workflowId: 'wf-alpha',
      status: 'pending',
      description: 'Render task',
      dependencies: ['wf-alpha/setup-task'],
    });
    const tasks = new Map<string, TaskState>([
      [setupTask.id, setupTask],
      [renderTask.id, renderTask],
    ]);
    const workflows = new Map<string, WorkflowMeta>([
      ['wf-alpha', { id: 'wf-alpha', name: 'Alpha workflow', status: 'running' }],
    ]);

    render(<TaskDAG tasks={tasks} workflows={workflows} />);

    const edge = await screen.findByTestId(`rf__edge-local:${setupTask.id}->${renderTask.id}`);

    await waitFor(() => {
      expect(edge).toHaveAttribute('data-label', 'Setup task → Render task');
    });
    expect(edge.getAttribute('data-label')).not.toContain('wf-alpha');
  });

  it('shows layer and feature-state pills plus the selected task summary', async () => {
    const description = [
      'Check ephemeral handoff artifacts',
      'Layer: docs',
      'Feature state: active',
      'Review claim: Artifacts stay out of the repo',
    ].join('\n');
    const task = makeUITask({
      id: 'wf-1/scrub-handoff-artifacts',
      workflowId: 'wf-1',
      status: 'completed',
      description,
      prompt: 'Check the completed handoff for ephemeral inter-task artifacts.',
    });
    const tasks = new Map<string, TaskState>([[task.id, task]]);
    const workflows = new Map<string, WorkflowMeta>([
      ['wf-1', { id: 'wf-1', name: 'Vue todo', status: 'review_ready' }],
    ]);

    const { rerender } = render(
      <TaskDAG
        tasks={tasks}
        workflows={workflows}
        selectedTaskId={task.id}
      />,
    );

    await screen.findByTestId(`rf__node-${task.id}`);
    expect(screen.getAllByText('docs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('task-graph-selection-summary')).not.toBeInTheDocument();

    rerender(
      <TaskDAG
        tasks={tasks}
        workflows={workflows}
        selectedTaskId={task.id}
        surfaceMode="browser"
      />,
    );

    const summary = screen.getByTestId('task-graph-selection-summary');
    expect(summary).not.toHaveTextContent('Artifacts stay out of the repo');
    fireEvent.click(screen.getByTestId('task-graph-selection-summary-toggle'));
    expect(summary).toHaveTextContent('Artifacts stay out of the repo');
    expect(summary).toHaveTextContent('Check the completed handoff for ephemeral inter-task artifacts.');
  });
});
