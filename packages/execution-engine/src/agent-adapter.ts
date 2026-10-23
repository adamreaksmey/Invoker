import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';

import type { WorkRequest } from '@invoker/contracts';
import type { SessionUsageEvent } from './session-driver.js';
import type { AgentRegistry } from './agent-registry.js';
import {
  assertExecutionModelSupported,
  DEFAULT_EXECUTION_AGENT,
  type ExecutionAgent,
} from './agent.js';
import { materializeLocalAgentPrompt } from './agent-prompt-transport.js';
import {
  cleanElectronEnv,
  killProcessGroup,
  resolveExecutableOnCurrentPath,
  SIGKILL_TIMEOUT_MS,
} from './process-utils.js';

const READ_ONLY_UPSTREAM_RE =
  /do not modify|does not modify (production )?code|only runs the repo test script|do not modify source files/i;

export interface PredecessorArtifact {
  taskId: string;
  description: string;
  summary?: string;
  commitSha?: string;
  commitMessage?: string;
  filesChanged?: string[];
  verificationReceipt?: string;
}

export interface TaskExecutionInput {
  executionId: string;
  objective: string;
  constraints?: string;
  verificationCommand?: string;
  executionAgent?: string;
  executionModel?: string;
  maxTurns?: number;
  cwd: string;
  predecessors?: PredecessorArtifact[];
}

export type AgentEvent =
  | { type: 'started'; executionId: string; agentName: string; sessionId: string }
  | { type: 'output'; executionId: string; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'tool_execution'; executionId: string; detail: string }
  | { type: 'usage'; executionId: string; usage: SessionUsageEvent }
  | { type: 'completed'; executionId: string; exitCode: number; sessionId: string; displayOutput: string }
  | { type: 'failed'; executionId: string; exitCode: number; message: string }
  | { type: 'cancelled'; executionId: string };

export interface AgentAdapter {
  execute(input: TaskExecutionInput): AsyncIterable<AgentEvent>;
  cancel(executionId: string): Promise<void>;
}

function formatPredecessorForPrompt(artifact: PredecessorArtifact): string {
  const haystack = `${artifact.description}\n${artifact.summary ?? ''}\n${artifact.commitMessage ?? ''}`;
  if (READ_ONLY_UPSTREAM_RE.test(haystack)) {
    const lines = [
      `[Completed upstream task: ${artifact.taskId}]`,
      'Status: completed (read-only verification).',
    ];
    if (artifact.summary) lines.push(`Summary: ${artifact.summary}`);
    if (artifact.commitSha) lines.push(`Commit: ${artifact.commitSha}`);
    if (artifact.verificationReceipt) lines.push(`Verification: ${artifact.verificationReceipt}`);
    return lines.join('\n');
  }
  let line = `[Completed upstream task: ${artifact.taskId}]\nDescription: ${artifact.description}\nSummary: ${artifact.summary ?? 'N/A'}`;
  if (artifact.commitSha) line += `\nCommit: ${artifact.commitSha}`;
  if (artifact.commitMessage) line += `\nCommit message:\n${artifact.commitMessage}`;
  if (artifact.filesChanged?.length) {
    line += `\nFiles changed:\n${artifact.filesChanged.map((path) => `- ${path}`).join('\n')}`;
  }
  if (artifact.verificationReceipt) line += `\nVerification receipt: ${artifact.verificationReceipt}`;
  return line;
}

export function buildTaskExecutionPrompt(input: TaskExecutionInput): string {
  const sections: string[] = [input.objective.trim()];
  const constraints = input.constraints?.trim();
  if (constraints && constraints !== input.objective.trim()) {
    sections.push('', 'Constraints:', constraints);
  }
  if (input.verificationCommand?.trim()) {
    sections.push('', 'Verification command (must pass before task completion):', input.verificationCommand.trim());
  }
  const predecessors = input.predecessors ?? [];
  if (predecessors.length > 0) {
    sections.push(
      '',
      'Completed upstream dependencies (context only).',
      'Do not adopt upstream Non-goals. Your job is the task above; make the required file changes and commit them.',
      '',
      predecessors.map((artifact) => formatPredecessorForPrompt(artifact)).join('\n\n'),
    );
  }
  return sections.join('\n');
}

export function workRequestToTaskExecutionInput(
  request: WorkRequest,
  cwd: string,
): TaskExecutionInput {
  const predecessors = (request.inputs.upstreamContext ?? []).map((ctx) => ({
    taskId: ctx.taskId,
    description: ctx.description,
    summary: ctx.summary,
    commitSha: ctx.commitHash,
    commitMessage: ctx.commitMessage,
  }));
  return {
    executionId: request.attemptId ?? request.requestId,
    objective: request.inputs.prompt ?? '',
    constraints: request.inputs.description,
    verificationCommand: request.inputs.command,
    executionAgent: request.inputs.executionAgent,
    executionModel: request.inputs.executionModel,
    maxTurns: request.inputs.maxTurns,
    cwd,
    predecessors: predecessors.length > 0 ? predecessors : undefined,
  };
}

interface ActiveAgentRun {
  child: ChildProcess;
  cancelled: boolean;
}

export class RegistryAgentAdapter implements AgentAdapter {
  private readonly activeRuns = new Map<string, ActiveAgentRun>();

  constructor(private readonly registry: AgentRegistry) {}

  async *execute(input: TaskExecutionInput): AsyncIterable<AgentEvent> {
    const agentName = input.executionAgent ?? DEFAULT_EXECUTION_AGENT;
    const agent = this.registry.getOrThrow(agentName);
    assertExecutionModelSupported(agent, input.executionModel);
    const driver = this.registry.getSessionDriver(agentName);
    const fullPrompt = buildTaskExecutionPrompt(input);
    const promptTransport = materializeLocalAgentPrompt(fullPrompt);
    const spec = agent.buildCommand(promptTransport.effectivePrompt, {
      executionModel: input.executionModel,
      maxTurns: input.maxTurns,
    });
    const sessionId = spec.sessionId ?? randomUUID();
    const cmd = resolveExecutableOnCurrentPath(spec.cmd) ?? spec.cmd;
    const executionId = input.executionId;

    yield { type: 'started', executionId, agentName, sessionId };

    const child = spawn(cmd, spec.args, {
      cwd: input.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanElectronEnv(),
      detached: process.platform !== 'win32',
    });
    const activeRun: ActiveAgentRun = { child, cancelled: false };
    this.activeRuns.set(executionId, activeRun);

    let stdout = '';
    let stderr = '';
    let settled = false;

    const cleanup = (): void => {
      promptTransport.cleanup();
      this.activeRuns.delete(executionId);
    };

    try {
      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on('error', (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        });
        child.on('close', (code, signal) => {
          if (settled) return;
          settled = true;
          if (activeRun.cancelled) {
            resolve(typeof code === 'number' ? code : 1);
            return;
          }
          if (signal) {
            resolve(typeof code === 'number' ? code : 1);
            return;
          }
          resolve(code ?? 1);
        });
      });

      for (const event of this.collectOutputEvents(executionId, stdout, stderr)) {
        yield event;
      }

      const effectiveSessionId = driver?.extractSessionId?.(stdout) ?? sessionId;
      const displayOutput = driver ? driver.processOutput(effectiveSessionId, stdout) : stdout;
      for (const usage of driver?.extractUsage?.(stdout) ?? []) {
        yield { type: 'usage', executionId, usage };
      }

      if (activeRun.cancelled) {
        yield { type: 'cancelled', executionId };
        return;
      }

      if (exitCode === 0) {
        yield {
          type: 'completed',
          executionId,
          exitCode,
          sessionId: effectiveSessionId,
          displayOutput,
        };
        return;
      }

      yield {
        type: 'failed',
        executionId,
        exitCode,
        message: stderr.trim() || displayOutput.trim() || `Agent exited with code ${exitCode}`,
      };
    } finally {
      cleanup();
    }
  }

  async cancel(executionId: string): Promise<void> {
    const activeRun = this.activeRuns.get(executionId);
    if (!activeRun) return;
    activeRun.cancelled = true;
    killProcessGroup(activeRun.child, 'SIGTERM');
    setTimeout(() => {
      if (activeRun.child.exitCode == null) killProcessGroup(activeRun.child, 'SIGKILL');
    }, SIGKILL_TIMEOUT_MS).unref?.();
  }

  private *collectOutputEvents(
    executionId: string,
    stdout: string,
    stderr: string,
  ): Generator<AgentEvent> {
    if (stdout) yield { type: 'output', executionId, stream: 'stdout', text: stdout };
    if (stderr) yield { type: 'output', executionId, stream: 'stderr', text: stderr };
  }
}

export function createRegistryAgentAdapter(registry: AgentRegistry): AgentAdapter {
  return new RegistryAgentAdapter(registry);
}

export function buildAgentCommandFromWorkRequest(
  request: WorkRequest,
  cwd: string,
  agent: ExecutionAgent,
): { cmd: string; args: string[]; agentSessionId?: string; fullPrompt?: string } {
  assertExecutionModelSupported(agent, request.inputs.executionModel);
  const input = workRequestToTaskExecutionInput(request, cwd);
  const fullPrompt = buildTaskExecutionPrompt(input);
  const spec = agent.buildCommand(fullPrompt, {
    executionModel: request.inputs.executionModel,
    maxTurns: request.inputs.maxTurns,
  });
  return {
    cmd: spec.cmd,
    args: spec.args,
    agentSessionId: spec.sessionId,
    fullPrompt: spec.fullPrompt,
  };
}
