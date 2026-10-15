import type { WorkflowMeta } from '../types.js';

const FINISHED_WORKFLOW_STATUSES = new Set(['completed', 'closed']);

export interface PendingWorkflowAttach {
  workflowId: string;
  upstreamWorkflowId: string;
  downstreamName: string;
  upstreamName: string;
}

export interface AttachPickerEntry {
  id: string;
  name: string;
}

export function finishedWorkflowAttachOptions(
  status: string | undefined,
): { force: true } | undefined {
  if (status && FINISHED_WORKFLOW_STATUSES.has(status)) return { force: true };
  return undefined;
}

export function workflowDependsOnUpstream(
  workflow: Pick<WorkflowMeta, 'externalDependencies'> | undefined,
  upstreamWorkflowId: string,
): boolean {
  return (workflow?.externalDependencies ?? []).some(
    (dependency) => dependency.workflowId === upstreamWorkflowId,
  );
}

export function attachPickerEntries(
  workflows: Iterable<Pick<WorkflowMeta, 'id' | 'name' | 'externalDependencies'>>,
  downstreamWorkflowId: string | null,
): AttachPickerEntry[] {
  const workflowList = [...workflows];
  const linked = linkedUpstreamIds(workflowList, downstreamWorkflowId);
  return workflowList
    .filter((workflow) => workflow.id !== downstreamWorkflowId && !linked.has(workflow.id))
    .map((workflow) => ({ id: workflow.id, name: workflow.name }));
}

export function attachedWorkflowNotice(pending: PendingWorkflowAttach): string {
  return `Attached "${pending.downstreamName}" to upstream "${pending.upstreamName}". The dependency was added.`;
}

export function duplicateAttachMessage(downstreamName: string, upstreamName: string): string {
  return `${downstreamName} is already attached to ${upstreamName}.`;
}

export function workflowPickerMatches(value: string, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (query.length === 0) return true;
  return value.toLowerCase().includes(query);
}

export function upstreamWaitLabel(
  dependencies: readonly { workflowId: string }[] | undefined,
  names: ReadonlyMap<string, string>,
): string | undefined {
  const attached = dependencies ?? [];
  if (attached.length === 0) return undefined;
  if (attached.length === 1) {
    const upstreamId = attached[0].workflowId;
    return `Waits on ${names.get(upstreamId) ?? upstreamId}`;
  }
  return `Waits on ${attached.length} upstream workflows`;
}

function linkedUpstreamIds(
  workflows: Iterable<Pick<WorkflowMeta, 'id' | 'externalDependencies'>>,
  downstreamWorkflowId: string | null,
): Set<string> {
  const downstream = [...workflows].find((workflow) => workflow.id === downstreamWorkflowId);
  return new Set((downstream?.externalDependencies ?? []).map((dependency) => dependency.workflowId));
}
