export const PLANNING_CONTEXT_PANEL_WIDTH_STORAGE_KEY = 'invoker.planningContextPanelWidth';
export const PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH = 288;
export const PLANNING_CONTEXT_PANEL_MIN_WIDTH = 280;
export const PLANNING_CONTEXT_PANEL_MAX_WIDTH = 560;
export const PLANNING_CONTEXT_PANEL_COLLAPSED_WIDTH = 64;

export function clampPlanningContextPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH;
  return Math.min(
    PLANNING_CONTEXT_PANEL_MAX_WIDTH,
    Math.max(PLANNING_CONTEXT_PANEL_MIN_WIDTH, Math.round(width)),
  );
}

export function readPlanningContextPanelWidth(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage === 'undefined'
    ? null
    : localStorage,
): number {
  if (!storage) return PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH;
  try {
    const raw = storage.getItem(PLANNING_CONTEXT_PANEL_WIDTH_STORAGE_KEY);
    if (raw == null || raw === '') return PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH;
    return clampPlanningContextPanelWidth(Number(raw));
  } catch {
    return PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH;
  }
}

export function writePlanningContextPanelWidth(
  width: number,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage === 'undefined'
    ? null
    : localStorage,
): number {
  const clamped = clampPlanningContextPanelWidth(width);
  if (!storage) return clamped;
  try {
    storage.setItem(PLANNING_CONTEXT_PANEL_WIDTH_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore quota / private-mode failures; in-memory width still applies.
  }
  return clamped;
}
