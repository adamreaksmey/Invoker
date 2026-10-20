import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createMockInvoker, makePlanningSessionSummary, type MockInvoker } from './helpers/mock-invoker.js';

vi.mock('@xyflow/react', async () => {
  const { createReactFlowMock } = await import('./helpers/mock-react-flow.js');
  return createReactFlowMock();
});

const { App } = await import('../App.js');

describe('planning composer repo binding', () => {
  let mock: MockInvoker;

  beforeEach(() => {
    mock = createMockInvoker();
    mock.install();
  });

  afterEach(() => {
    mock.cleanup();
  });

  function checkPlanningRepo(): void {
    fireEvent.click(screen.getByTestId('invoker-terminal-repo-check'));
  }

  async function openComposerOptions() {
    fireEvent.click(await screen.findByTestId('sidebar-home'));
    const expandPlanningChats = screen.queryByRole('button', { name: 'Expand planning chats' });
    if (expandPlanningChats) fireEvent.click(expandPlanningChats);
    if (!screen.queryByTestId('invoker-terminal-harness')) {
      fireEvent.click(await screen.findByRole('button', { name: 'Options' }));
    }
    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-harness')).toBeInTheDocument();
    });
  }

  it('binds a repo typed into an empty chat and shows it in the details panel', async () => {
    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    checkPlanningRepo();

    await waitFor(() => {
      expect(mock.api.planningChatCreate).toHaveBeenCalledWith({
        presetKey: 'codex',
        title: 'Untitled plan',
        confirmationMode: 'require',
      });
      expect(mock.api.planningChatRebindRepo).toHaveBeenCalledWith({
        sessionId: 'session-1',
        repoUrl: '/tmp/repo-a',
      });
    });

    fireEvent.click(screen.getByTestId('planning-context-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('planning-repo-status')).toHaveTextContent('tmp/repo-a');
    });
    expect(screen.getByTestId('invoker-terminal-clone-status')).toHaveTextContent(
      'Ready: tmp/repo-a on main (isolated planning worktree).',
    );
    expect(screen.getAllByText('Ready: tmp/repo-a on main (isolated planning worktree).').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('invoker-terminal-repo-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('invoker-terminal-repo')).toBeDisabled();
    expect(screen.getByTestId('invoker-terminal-base-branch')).toBeDisabled();
    expect(screen.getByTestId('invoker-terminal-repo-edit')).toBeInTheDocument();
  });

  it('checks the repository again after Edit and Done', async () => {
    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    checkPlanningRepo();
    await screen.findByTestId('invoker-terminal-repo-edit');

    fireEvent.click(screen.getByTestId('invoker-terminal-repo-edit'));
    fireEvent.change(screen.getByTestId('invoker-terminal-repo'), { target: { value: '/tmp/repo-b' } });
    fireEvent.click(screen.getByTestId('invoker-terminal-repo-done'));

    await waitFor(() => {
      expect(mock.api.planningChatRebindRepo).toHaveBeenCalledTimes(2);
    });
    expect(mock.api.planningChatRebindRepo).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      repoUrl: '/tmp/repo-b',
      baseBranch: 'main',
    });
    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-repo')).toBeDisabled();
    });
    expect(screen.queryByTestId('invoker-terminal-repo-validating')).not.toBeInTheDocument();
  });

  it('shows the bind error and keeps the previous binding when the rebind is refused', async () => {
    mock.api.planningChatRebindRepo = vi.fn(async () => ({
      ok: false as const,
      error: 'Set the repo before the conversation or terminal starts.',
    }));

    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-b' } });
    checkPlanningRepo();

    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-repo-error')).toHaveTextContent(
        'Set the repo before the conversation or terminal starts.',
      );
    });
    fireEvent.click(screen.getByTestId('planning-context-toggle'));
    expect(await screen.findByTestId('planning-repo-status')).toHaveTextContent('No repository bound yet');
    expect(screen.getByTestId('invoker-terminal-repo')).toHaveValue('/tmp/repo-b');
  });

  it('sends exactly once when Send is clicked with uncommitted repo text', async () => {
    let createCalls = 0;
    mock.api.planningChatCreate = vi.fn(async () => {
      createCalls += 1;
      return {
        ok: true as const,
        session: makePlanningSessionSummary({
          id: `created-${createCalls}`,
          title: 'Untitled plan',
          status: 'still_discussing',
          presetKey: 'codex',
          messages: [],
          draftPlanAvailable: false,
          draftPlanSummary: undefined,
          draftPlanText: undefined,
        }),
      };
    });
    mock.api.planningChatSend = vi.fn(async (request) => ({
      ok: true as const,
      sessionId: request.sessionId ?? 'server-created',
      reply: 'On it.',
      confirmationMode: 'require' as const,
      draftPlanAvailable: false,
    }));

    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    fireEvent.change(screen.getByTestId('invoker-terminal-input'), { target: { value: 'hello planner' } });

    fireEvent.submit(screen.getByTestId('invoker-terminal-input').closest('form')!);

    await waitFor(() => {
      expect(mock.api.planningChatSend).toHaveBeenCalledTimes(1);
    });
    expect(mock.api.planningChatCreate).toHaveBeenCalledTimes(1);
    expect(mock.api.planningChatRebindRepo).toHaveBeenCalledTimes(1);
    expect(mock.api.planningChatRebindRepo).toHaveBeenCalledWith({
      sessionId: 'created-1',
      repoUrl: '/tmp/repo-a',
    });
    expect(mock.api.planningChatSend).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'created-1',
      message: 'hello planner',
    }));
    // The message renders in the transcript and again as the sidebar preview.
    expect(screen.getAllByText('hello planner').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('On it.').length).toBeGreaterThanOrEqual(1);
    // The composer must clear, or a second click re-sends the same message.
    expect(screen.getByTestId('invoker-terminal-input')).toHaveValue('');
  });

  it('shows the send spinner and defers the send while a send-triggered bind is in flight', async () => {
    let resolveRebind!: (value: { ok: true; action: 'provision'; baseBranch: string }) => void;
    mock.api.planningChatRebindRepo = vi.fn(() => new Promise<{ ok: true; action: 'provision'; baseBranch: string }>((resolve) => {
      resolveRebind = resolve;
    }));

    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    fireEvent.change(screen.getByTestId('invoker-terminal-input'), { target: { value: 'hello planner' } });

    // Clicking Send first blurs the repo field, then submits the form.
    fireEvent.blur(repoInput);
    fireEvent.submit(screen.getByTestId('invoker-terminal-input').closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-send-spinner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('invoker-terminal-input')).toBeDisabled();
    expect(mock.api.planningChatSend).not.toHaveBeenCalled();

    resolveRebind({ ok: true, action: 'provision', baseBranch: 'main' });

    await waitFor(() => {
      expect(mock.api.planningChatSend).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the send spinner during a Check-committed bind without sending', async () => {
    let resolveRebind!: (value: { ok: true; action: 'provision'; baseBranch: string }) => void;
    mock.api.planningChatRebindRepo = vi.fn(() => new Promise<{ ok: true; action: 'provision'; baseBranch: string }>((resolve) => {
      resolveRebind = resolve;
    }));

    render(<App />);
    await openComposerOptions();

    fireEvent.change(screen.getByTestId('invoker-terminal-repo'), { target: { value: '/tmp/repo-a' } });
    checkPlanningRepo();

    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-send-spinner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('invoker-terminal-clone-status')).toHaveTextContent('Preparing repository…');

    resolveRebind({ ok: true, action: 'provision', baseBranch: 'main' });

    await waitFor(() => {
      expect(screen.queryByTestId('invoker-terminal-send-spinner')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('invoker-terminal-clone-status')).toHaveTextContent(
      'Ready: tmp/repo-a on main (isolated planning worktree).',
    );
    expect(mock.api.planningChatSend).not.toHaveBeenCalled();
  });

  it('surfaces a failed bind in the transcript and keeps the typed message', async () => {
    mock.api.planningChatRebindRepo = vi.fn(async () => ({ ok: false as const, error: 'boom' }));

    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    fireEvent.change(screen.getByTestId('invoker-terminal-input'), { target: { value: 'hello planner' } });

    fireEvent.submit(screen.getByTestId('invoker-terminal-input').closest('form')!);

    const errorLines = await screen.findAllByText('Could not bind repository: boom');
    expect(errorLines.length).toBeGreaterThanOrEqual(1);
    expect(mock.api.planningChatSend).not.toHaveBeenCalled();
    expect(screen.getByTestId('invoker-terminal-input')).toHaveValue('hello planner');
    expect(screen.queryByTestId('invoker-terminal-send-spinner')).not.toBeInTheDocument();
  });

  it('keeps the repository fields disabled after the conversation has messages', async () => {
    mock.api.planningChatList = vi.fn(async () => ({
      ok: true,
      sessions: [
        makePlanningSessionSummary({
          id: 'existing-chat',
          title: 'Existing chat',
          status: 'still_discussing',
          draftPlanAvailable: false,
          draftPlanSummary: undefined,
          draftPlanText: undefined,
        }),
      ],
    }));

    render(<App />);
    fireEvent.click(await screen.findByTestId('sidebar-home'));
    const rail = await screen.findByTestId('planning-session-list');
    await waitFor(() => {
      expect(within(rail).getByText('Existing chat')).toBeInTheDocument();
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Options' }));
    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-harness')).toBeInTheDocument();
    });

    expect(screen.getByTestId('invoker-terminal-repo')).toBeDisabled();
    expect(screen.getByTestId('invoker-terminal-base-branch')).toBeDisabled();
    expect(screen.getByTestId('invoker-terminal-repo-edit')).toBeInTheDocument();
  });

  it('keeps an explicitly checked repository after a failed send refresh', async () => {
    let listCallCount = 0;
    mock.api.planningChatList = vi.fn(async () => {
      listCallCount += 1;
      return {
        ok: true as const,
        sessions: [],
        ...(listCallCount === 2 ? { repoBinding: { repoUrl: '/tmp/repo-a', baseBranch: 'main' } } : {}),
      };
    });
    mock.api.planningChatSend = vi.fn(async () => {
      throw new Error('transport failure');
    });

    render(<App />);
    await waitFor(() => {
      expect(listCallCount).toBe(2);
    });

    await openComposerOptions();
    checkPlanningRepo();
    await waitFor(() => {
      expect(screen.getByTestId('invoker-terminal-clone-status')).toHaveTextContent(
        'Ready: tmp/repo-a on main (isolated planning worktree).',
      );
    });

    fireEvent.change(screen.getByTestId('invoker-terminal-input'), { target: { value: 'hello planner' } });
    fireEvent.submit(screen.getByTestId('invoker-terminal-input').closest('form')!);

    await waitFor(() => {
      expect(listCallCount).toBe(3);
    });
    fireEvent.click(screen.getByTestId('planning-context-toggle'));
    expect(await screen.findByTestId('planning-repo-status')).toHaveTextContent('tmp/repo-a');
  });

  it('sends the typed base branch and can retry a failed bind', async () => {
    mock.api.planningChatRebindRepo = vi.fn(async () => ({
      ok: false as const,
      error: 'Base branch "main" was not found on the remote origin',
    }));

    render(<App />);
    await openComposerOptions();

    fireEvent.change(screen.getByTestId('invoker-terminal-repo'), { target: { value: '/tmp/repo-a' } });
    fireEvent.change(screen.getByTestId('invoker-terminal-base-branch'), { target: { value: 'master' } });
    checkPlanningRepo();

    await waitFor(() => {
      expect(mock.api.planningChatRebindRepo).toHaveBeenCalledWith({
        sessionId: 'session-1',
        repoUrl: '/tmp/repo-a',
        baseBranch: 'master',
      });
    });
    expect(await screen.findByTestId('invoker-terminal-repo-error')).toHaveTextContent('Base branch "main" was not found');
    expect(screen.getByTestId('invoker-terminal-repo')).toHaveValue('/tmp/repo-a');
    expect(screen.getByTestId('invoker-terminal-base-branch')).toHaveValue('master');

    fireEvent.click(screen.getByTestId('invoker-terminal-repo-retry'));
    await waitFor(() => {
      expect(mock.api.planningChatRebindRepo).toHaveBeenCalledTimes(2);
    });
  });

  it('does not bind the repository on blur before Check is clicked', async () => {
    render(<App />);
    await openComposerOptions();

    const repoInput = screen.getByTestId('invoker-terminal-repo');
    fireEvent.change(repoInput, { target: { value: '/tmp/repo-a' } });
    fireEvent.blur(repoInput);

    expect(mock.api.planningChatCreate).not.toHaveBeenCalled();
    expect(mock.api.planningChatRebindRepo).not.toHaveBeenCalled();
    expect(screen.getByTestId('invoker-terminal-repo-check')).toBeInTheDocument();
  });

  it('keeps Options non-interactive when there is nothing to expand', async () => {
    render(<App />);
    await openComposerOptions();

    const options = screen.getByTestId('invoker-terminal-options');
    expect(options).toBeDisabled();
    expect(options).toHaveClass('cursor-default');
    expect(options).not.toHaveAttribute('aria-expanded');
  });

  it('does not send a planning message until a repository is entered', async () => {
    render(<App />);
    await openComposerOptions();

    fireEvent.change(screen.getByTestId('invoker-terminal-input'), { target: { value: 'hello planner' } });
    fireEvent.submit(screen.getByTestId('invoker-terminal-input').closest('form')!);

    expect(mock.api.planningChatCreate).not.toHaveBeenCalled();
    expect(mock.api.planningChatSend).not.toHaveBeenCalled();
    expect(screen.getByText('Choose a repository before planning. Invoker will not target a default checkout or an unspecified repo.')).toBeInTheDocument();
  });
});
