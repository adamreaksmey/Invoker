/**
 * Regression: Needs Attention with an empty rail ("All clear") must not fight
 * the default-workflow auto-select effect. Previously the attention surface
 * cleared selectedWorkflowId while a sibling effect immediately re-selected
 * the first workflow, toggling the task DAG vs workflow graph every render
 * (visible flicker, React error #185).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { createMockInvoker, makeUITask, type MockInvoker } from './helpers/mock-invoker.js';
import type { WorkflowMeta } from '../types.js';

vi.mock('@xyflow/react', async () => {
  const { createReactFlowMock } = await import('./helpers/mock-react-flow.js');
  return createReactFlowMock();
});

vi.setConfig({ testTimeout: 20_000 });

const { App } = await import('../App.js');

const workflow: WorkflowMeta = { id: 'wf-run', name: 'Running Plan', status: 'running' };

const taskOne = makeUITask({
  id: 'wf-run/one',
  description: 'First task',
  status: 'completed',
  workflowId: 'wf-run',
  taskStateVersion: 1,
});
const taskTwo = makeUITask({
  id: 'wf-run/two',
  description: 'Second task',
  status: 'running',
  workflowId: 'wf-run',
  dependencies: ['wf-run/one'],
  taskStateVersion: 1,
});

describe('Needs Attention empty rail selection stability', () => {
  let mock: MockInvoker;

  beforeEach(() => {
    mock = createMockInvoker();
    mock.install();
  });

  afterEach(() => {
    mock.cleanup();
  });

  it('keeps the task graph mounted while live updates stream on an all-clear attention surface', async () => {
    mock.setTasks([taskOne, taskTwo], [workflow]);
    render(<App />);

    fireEvent.click(await screen.findByTestId('sidebar-planning'));
    fireEvent.click(await screen.findByTestId('rf__node-wf-run'));
    await waitFor(() => {
      expect(screen.getByTestId('selected-workflow-mini-dag')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('sidebar-attention'));
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-attention')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('All clear')).toBeInTheDocument();
    });

    expect(screen.getByTestId('selected-workflow-mini-dag')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-graph-content')).not.toBeInTheDocument();

    for (let version = 2; version <= 25; version += 1) {
      await act(async () => {
        mock.fireDelta({
          type: 'updated',
          taskId: 'wf-run/two',
          changes: { status: version % 2 === 0 ? 'running' : 'running' },
          taskStateVersion: version,
          previousTaskStateVersion: version - 1,
        });
      });
      expect(screen.getByTestId('selected-workflow-mini-dag')).toBeInTheDocument();
      expect(screen.queryByTestId('workflow-graph-content')).not.toBeInTheDocument();
    }
  });
});
