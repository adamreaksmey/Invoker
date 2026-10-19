import { describe, expect, it } from 'vitest';
import {
  PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH,
  PLANNING_CONTEXT_PANEL_MAX_WIDTH,
  PLANNING_CONTEXT_PANEL_MIN_WIDTH,
  clampPlanningContextPanelWidth,
  readPlanningContextPanelWidth,
  writePlanningContextPanelWidth,
} from './planning-context-panel-width.js';

describe('planning-context-panel-width', () => {
  it('clamps below min and above max', () => {
    expect(clampPlanningContextPanelWidth(100)).toBe(PLANNING_CONTEXT_PANEL_MIN_WIDTH);
    expect(clampPlanningContextPanelWidth(900)).toBe(PLANNING_CONTEXT_PANEL_MAX_WIDTH);
    expect(clampPlanningContextPanelWidth(320)).toBe(320);
  });

  it('reads and writes a clamped width through storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(readPlanningContextPanelWidth(storage)).toBe(PLANNING_CONTEXT_PANEL_DEFAULT_WIDTH);
    expect(writePlanningContextPanelWidth(700, storage)).toBe(PLANNING_CONTEXT_PANEL_MAX_WIDTH);
    expect(readPlanningContextPanelWidth(storage)).toBe(PLANNING_CONTEXT_PANEL_MAX_WIDTH);
  });
});
