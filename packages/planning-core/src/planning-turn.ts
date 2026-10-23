import {
  hasExplicitDraftIntent,
  isDraftingAuthorized,
  looksLikeQuestion,
  type PlanningMessage,
} from './lifecycle.js';
import { isExactPlanningSubmitCommand } from './planning-surface.js';
import {
  summarizePlanText,
  type PlanSummary,
} from './plan-summary.js';

export type PlanningInteractionMode =
  | 'conversation'
  | 'direct_task'
  | 'planned_workflow';

export interface ResolvePlanningInteractionModeInput {
  userMessage: string;
  messagesBeforeTurn?: readonly PlanningMessage[];
  explicitDirectTask?: boolean;
  explicitPlannedWorkflow?: boolean;
  draftingPreauthorized?: boolean;
  conversationalPlanning?: boolean;
  sessionConversationMode?: 'agent' | 'plan';
}

const GREETING_PATTERN = /^(hi|hello|hey|yo|sup|thanks|thank you|good morning|good afternoon|good evening)\b/i;

const PLAN_PREFIX_PATTERN = /^plan:\s*.+/i;

const PLAN_TO_INVOKER_PATTERN = /\bplan-to-invoker\b/i;

export function resolvePlanningInteractionMode({
  userMessage,
  messagesBeforeTurn = [],
  explicitDirectTask = false,
  explicitPlannedWorkflow = false,
  draftingPreauthorized = false,
  conversationalPlanning = false,
  sessionConversationMode,
}: ResolvePlanningInteractionModeInput): PlanningInteractionMode {
  const message = userMessage.trim();
  if (!message) return 'conversation';

  const agentSession = sessionConversationMode === 'agent';
  const submitPreparesReview = isExactPlanningSubmitCommand(message) && !agentSession;
  const wantsPlannedWorkflow = explicitPlannedWorkflow
    || draftingPreauthorized
    || submitPreparesReview
    || (isDraftingAuthorized(message, messagesBeforeTurn)
      && !(agentSession && isExactPlanningSubmitCommand(message)))
    || PLAN_PREFIX_PATTERN.test(message)
    || PLAN_TO_INVOKER_PATTERN.test(message)
    || (hasExplicitDraftIntent(message) && !(agentSession && isExactPlanningSubmitCommand(message)));

  if (wantsPlannedWorkflow) return 'planned_workflow';

  if (explicitDirectTask || agentSession) return 'direct_task';

  if (GREETING_PATTERN.test(message) || looksLikeQuestion(message)) {
    return 'conversation';
  }

  if (conversationalPlanning) return 'conversation';

  return sessionConversationMode === 'plan' ? 'planned_workflow' : 'conversation';
}

export function requiresPlanningWorktree(mode: PlanningInteractionMode): boolean {
  return mode === 'planned_workflow';
}

export type SharedPlanningTurn =
  | {
      kind: 'message';
      text: string;
      status: 'still_discussing' | 'waiting_for_answer';
      draftingAuthorized: boolean;
    }
  | {
      kind: 'draft_ready';
      text: string;
      planText: string;
      summary: PlanSummary;
      draftingAuthorized: boolean;
    };

export interface EvaluatePlanningTurnInput {
  userMessage: string;
  messagesBeforeTurn: readonly PlanningMessage[];
  assistantReply: string;
  immediateDraftPlanText: string | null | undefined;
  requireDraftAuthorization?: boolean;
  hasExistingDraft?: boolean;
}

export function evaluatePlanningTurn({
  userMessage,
  messagesBeforeTurn,
  assistantReply,
  immediateDraftPlanText,
  requireDraftAuthorization = true,
  hasExistingDraft = false,
}: EvaluatePlanningTurnInput): SharedPlanningTurn {
  const draftingAuthorized = !requireDraftAuthorization
    || isDraftingAuthorized(userMessage, messagesBeforeTurn);
  const planText = immediateDraftPlanText?.trim() || null;
  const summary = planText ? summarizePlanText(planText) : null;

  if (planText && summary && (!hasExistingDraft || draftingAuthorized)) {
    return {
      kind: 'draft_ready',
      text: assistantReply,
      planText,
      summary,
      draftingAuthorized,
    };
  }

  return {
    kind: 'message',
    text: assistantReply,
    status: assistantReply.includes('?') ? 'waiting_for_answer' : 'still_discussing',
    draftingAuthorized,
  };
}
