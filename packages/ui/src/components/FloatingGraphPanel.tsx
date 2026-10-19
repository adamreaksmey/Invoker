import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';

interface FloatingGraphPanelProps {
  title: string;
  children: ReactNode;
  boundsRef: RefObject<HTMLElement>;
  className?: string;
  contentClassName?: string;
  testId?: string;
  dragHandleTestId?: string;
}

interface DragState {
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
}

const PANEL_MARGIN = 12;
const COMPACT_PANEL_CLASS = 'h-[210px] w-[315px]';
const EXPANDED_PANEL_CLASS = 'h-[420px] w-[640px]';
const PANEL_SIZE_STORAGE_KEY = 'invoker.floating-task-dag-size';
const PANEL_SIZE_EXPANDED = 'expanded';
const LARGER_PANEL_LABEL = 'Larger';
const SMALLER_PANEL_LABEL = 'Smaller';

type PanelSize = 'compact' | 'expanded';

function readStoredPanelSize(): PanelSize {
  try {
    return window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY) === PANEL_SIZE_EXPANDED
      ? 'expanded'
      : 'compact';
  } catch {
    return 'compact';
  }
}

function storePanelSize(size: PanelSize): void {
  try {
    window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, size);
  } catch {
    return;
  }
}

function panelSizeClass(size: PanelSize): string {
  return size === 'expanded' ? EXPANDED_PANEL_CLASS : COMPACT_PANEL_CLASS;
}

export function FloatingGraphPanel({
  title,
  children,
  boundsRef,
  className = '',
  contentClassName = '',
  testId,
  dragHandleTestId,
}: FloatingGraphPanelProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [panelSize, setPanelSize] = useState<PanelSize>(readStoredPanelSize);

  const clampPosition = useCallback((left: number, top: number): { left: number; top: number } => {
    const bounds = boundsRef.current;
    const panel = panelRef.current;
    if (!bounds || !panel) return { left, top };

    const maxLeft = Math.max(PANEL_MARGIN, bounds.clientWidth - panel.offsetWidth - PANEL_MARGIN);
    const maxTop = Math.max(PANEL_MARGIN, bounds.clientHeight - panel.offsetHeight - PANEL_MARGIN);
    return {
      left: Math.min(Math.max(PANEL_MARGIN, left), maxLeft),
      top: Math.min(Math.max(PANEL_MARGIN, top), maxTop),
    };
  }, [boundsRef]);

  useEffect(() => {
    if (!position) return;
    setPosition(clampPosition(position.left, position.top));
  }, [clampPosition, position?.left, position?.top]);

  const handleDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== undefined) return;
    const bounds = boundsRef.current;
    const panel = panelRef.current;
    if (!bounds || !panel) return;

    const boundsRect = bounds.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const start = clampPosition(panelRect.left - boundsRect.left, panelRect.top - boundsRect.top);
    setPosition(start);
    dragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: start.left,
      startTop: start.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, [boundsRef, clampPosition]);

  const handleDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current;
    if (!dragState) return;
    setPosition(clampPosition(
      dragState.startLeft + event.clientX - dragState.startClientX,
      dragState.startTop + event.clientY - dragState.startClientY,
    ));
    event.preventDefault();
    event.stopPropagation();
  }, [clampPosition]);

  const handleDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const togglePanelSize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setPanelSize((current) => {
      const next = current === 'compact' ? 'expanded' : 'compact';
      storePanelSize(next);
      return next;
    });
  }, []);

  return (
    <div
      ref={panelRef}
      data-testid={testId}
      className={`absolute top-3 right-3 z-10 flex flex-col rounded border border-border bg-background/95 overflow-hidden shadow-lg ${panelSizeClass(panelSize)} ${className}`}
      style={{
        ...(position ? { left: position.left, top: position.top, right: 'auto' } : {}),
        pointerEvents: 'auto',
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        data-testid={dragHandleTestId}
        className="flex shrink-0 cursor-move select-none items-center gap-2 border-b border-border px-2 py-1 text-[11px] text-muted-foreground"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <button
          type="button"
          data-testid="floating-graph-panel-size"
          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-foreground hover:bg-muted"
          onPointerDown={togglePanelSize}
        >
          {panelSize === 'expanded' ? SMALLER_PANEL_LABEL : LARGER_PANEL_LABEL}
        </button>
      </div>
      <div className={`min-h-0 flex-1 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
