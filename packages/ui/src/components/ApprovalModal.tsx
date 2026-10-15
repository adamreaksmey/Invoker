/**
 * ApprovalModal — Modal for approving or rejecting a task.
 *
 * Shows task summary and approve/reject buttons.
 * Reject optionally collects a reason.
 */

import { useState, useEffect } from 'react';
import type { TaskState, ClaudeMessage, AgentSessionData } from '../types.js';
import { githubMergeNotice, mergeGateLeavesMergeToGitHub } from '../lib/merge-gate.js';
import { MarkdownText } from './MarkdownText.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './primitives/index.js';

const SUBMITTING_DECISION_LABEL = 'Working...';
const GITHUB_PULL_REQUEST_HEADING = 'Pull request is on GitHub';

interface ApprovalModalProps {
  task: TaskState;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string, reason?: string) => void;
  onClose: () => void;
  initialAction?: 'approve' | 'reject';
  onFinish?: string;
  mergeMode?: string;
  decisionError?: string;
}

export function ApprovalModal({
  task,
  onApprove,
  onReject,
  onClose,
  initialAction = 'approve',
  onFinish,
  mergeMode,
  decisionError,
}: ApprovalModalProps) {
  const extractSessionFromEvents = (
    events: Array<{ eventType?: string; payload?: string }>,
  ): { sessionId?: string; agentName?: string } => {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (event?.eventType !== 'task.awaiting_approval') continue;
      const raw = event.payload;
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw);
        const exec = parsed?.execution;
        return {
          sessionId: exec?.agentSessionId ? String(exec.agentSessionId) : undefined,
          agentName: typeof exec?.agentName === 'string'
            ? exec.agentName
            : typeof exec?.lastAgentName === 'string'
              ? exec.lastAgentName
              : undefined,
        };
      } catch {
        return {};
      }
    }
    return {};
  };

  const extractSessionIdFromError = (err?: string): string | undefined => {
    if (!err) return undefined;
    const m = err.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    return m?.[0];
  };

  const isFixApproval = Boolean(task.execution.pendingFixError);
  const isMergeNode = Boolean(task.config.isMergeNode);
  const leavesMergeOnGitHub = mergeGateLeavesMergeToGitHub(task, { onFinish, mergeMode });
  const fallbackSessionId = extractSessionIdFromError(task.execution.pendingFixError);
  const [eventSessionId, setEventSessionId] = useState<string | undefined>(undefined);
  const [eventAgentName, setEventAgentName] = useState<string | undefined>(undefined);
  const sessionId = task.execution.agentSessionId
    ?? task.execution.lastAgentSessionId
    ?? fallbackSessionId
    ?? eventSessionId;
  const effectiveAgentName = task.execution.agentName
    ?? task.execution.lastAgentName
    ?? eventAgentName;

  const agentLabel = effectiveAgentName
    ? effectiveAgentName.charAt(0).toUpperCase() + effectiveAgentName.slice(1)
    : 'Claude';

  const defaultReason = [
    sessionId && `${agentLabel} session: ${sessionId}`,
    isFixApproval && `Original error: ${task.execution.pendingFixError}`,
  ].filter(Boolean).join('\n');

  const [reason, setReason] = useState(defaultReason);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(initialAction === 'reject');
  const [sessionMessages, setSessionMessages] = useState<ClaudeMessage[] | null>(null);
  const [sessionState, setSessionState] = useState<AgentSessionData['state'] | null>(null);
  const [sessionSource, setSessionSource] = useState<AgentSessionData['source'] | undefined>(undefined);
  const [sessionReason, setSessionReason] = useState<string | undefined>(undefined);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task.execution.agentSessionId || task.execution.lastAgentSessionId || fallbackSessionId) return;
    let cancelled = false;
    window.invoker
      .getEvents(task.id, { limit: 50, sortBy: 'desc' })
      .then((events) => {
        if (cancelled) return;
        const recovered = extractSessionFromEvents(events as Array<{ eventType?: string; payload?: string }>);
        if (recovered.sessionId) {
          setEventSessionId(recovered.sessionId);
        }
        if (recovered.agentName) {
          setEventAgentName(recovered.agentName);
        }
      })
      .catch(() => {
        // Best-effort fallback only
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.execution.agentSessionId, task.execution.lastAgentSessionId, fallbackSessionId]);

  useEffect(() => {
    if (!reasonTouched) {
      setReason(defaultReason);
    }
  }, [defaultReason, reasonTouched]);

  useEffect(() => {
    if (!sessionId) return;
    setSessionLoading(true);
    setSessionState(null);
    setSessionSource(undefined);
    setSessionReason(undefined);
    setSessionError(false);
    window.invoker
      .getAgentSession(sessionId, effectiveAgentName)
      .then((result) => {
        const msgs = Array.isArray(result)
          ? result
          : ((result as AgentSessionData | null)?.messages ?? null);
        const isError = !Array.isArray(result) && !!result && result.state === 'error';
        if (!Array.isArray(result) && result) {
          setSessionState(result.state);
          setSessionSource(result.source);
          setSessionReason(result.reason);
        }
        setSessionMessages(msgs);
        setSessionError(isError);
        setSessionLoading(false);
      })
      .catch(() => {
        setSessionError(true);
        setSessionLoading(false);
      });
  }, [sessionId, effectiveAgentName]);

  useEffect(() => {
    if (!decisionError) return;
    setSubmitting(false);
  }, [decisionError]);

  const handleApprove = () => {
    if (submitting) return;
    setSubmitting(true);
    onApprove(task.id);
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    onReject(task.id, reason || undefined);
  };

  const heading = approvalHeading({
    isFixApproval,
    isMergeNode,
    onFinish,
    leavesMergeOnGitHub,
  });
  const approveButtonLabel = approvalButtonLabel({ isFixApproval, isMergeNode, onFinish });

  const mergeRejectLabel = onFinish === 'pull_request' ? 'Reject PR' : 'Reject Merge';
  const mergeConfirmRejectLabel =
    onFinish === 'pull_request' ? 'Confirm Reject PR' : 'Confirm Reject Merge';
  const rejectButtonLabel = showRejectInput
    ? (isFixApproval ? 'Confirm Reject Fix' : isMergeNode ? mergeConfirmRejectLabel : 'Confirm Reject')
    : (isFixApproval ? 'Reject Fix' : isMergeNode ? mergeRejectLabel : 'Reject');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Task: <span className="font-mono text-foreground">{task.id}</span>
            </p>
            <p className="text-sm text-muted-foreground break-words">{task.description}</p>
          </div>
          {sessionId && (
            <div className="bg-muted/50 rounded p-3" data-testid="claude-session-context">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">{agentLabel} Session</h3>
              <p className="text-xs text-muted-foreground mb-2 font-mono">{sessionId}</p>
              {sessionState && (
                <p className="text-xs text-muted-foreground mb-2" data-testid="session-state">
                  State: <span className="font-mono">{sessionState}</span>
                  {sessionSource ? <> {' '}({sessionSource})</> : null}
                </p>
              )}
              {sessionLoading && <p className="text-xs text-muted-foreground" data-testid="session-loading">Loading conversation...</p>}
              {sessionMessages && (
                <div className="space-y-2" data-testid="session-messages">
                  {sessionMessages.map((msg, i) => (
                    <div key={i} className="text-xs">
                      <span className={msg.role === 'user' ? 'text-foreground' : 'text-green-400'}>
                        {msg.role === 'user' ? 'Human' : agentLabel}:
                      </span>
                      <pre className="text-muted-foreground whitespace-pre-wrap mt-0.5">{msg.content}</pre>
                    </div>
                  ))}
                </div>
              )}
              {sessionReason && !sessionError && (
                <p className="text-xs text-muted-foreground mt-2" data-testid="session-reason">{sessionReason}</p>
              )}
              {sessionError && <p className="text-xs text-red-400" data-testid="session-error">Could not load session</p>}
            </div>
          )}

          {task.config.summary && (
            <div className="bg-muted/50 rounded p-3">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Summary</h3>
              <div className="text-xs text-muted-foreground max-h-[20vh] overflow-y-auto" data-testid="approval-summary">
                <MarkdownText text={task.config.summary} />
              </div>
            </div>
          )}

          {leavesMergeOnGitHub && (
            <p className="text-sm text-muted-foreground" data-testid="github-merge-notice">
              {githubMergeNotice(task.execution.reviewUrl)}
            </p>
          )}

          {decisionError && !submitting && (
            <p className="text-sm text-red-400" role="alert" data-testid="approval-decision-error">
              {decisionError}
            </p>
          )}

          {showRejectInput && (
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Rejection reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReasonTouched(true);
                  setReason(e.target.value);
                }}
                className="w-full bg-muted border border-border-strong rounded p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                rows={3}
                placeholder="Why is this being rejected?"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 shrink-0 border-t border-border sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!leavesMergeOnGitHub && (
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={handleReject}
            >
              {submitting && showRejectInput ? SUBMITTING_DECISION_LABEL : rejectButtonLabel}
            </Button>
          )}
          {!showRejectInput && !leavesMergeOnGitHub && (
            <Button
              type="button"
              disabled={submitting}
              className="bg-green-600 text-white hover:bg-green-500"
              onClick={handleApprove}
            >
              {submitting && !showRejectInput ? SUBMITTING_DECISION_LABEL : approveButtonLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function approvalHeading(input: {
  isFixApproval: boolean;
  isMergeNode: boolean;
  onFinish?: string;
  leavesMergeOnGitHub: boolean;
}): string {
  if (input.isFixApproval) return 'Approve AI Fix';
  if (input.leavesMergeOnGitHub) return GITHUB_PULL_REQUEST_HEADING;
  if (!input.isMergeNode) return 'Manual Approval Required';
  if (input.onFinish === 'merge') return 'Confirm Merge';
  return 'Approve Merge';
}

function approvalButtonLabel(input: {
  isFixApproval: boolean;
  isMergeNode: boolean;
  onFinish?: string;
}): string {
  if (input.isFixApproval) return 'Approve Fix';
  if (!input.isMergeNode) return 'Approve';
  if (input.onFinish === 'merge') return 'Confirm Merge';
  return 'Approve Merge';
}
