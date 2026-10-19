import { useEffect, useRef, type JSX } from 'react';
import { GitBranch } from 'lucide-react';
import { workflowPickerMatches } from '../lib/attach-workflow-request.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './primitives/index.js';

const NO_ATTACH_CANDIDATES = 'No other workflow can be attached. Already-attached workflows stay hidden.';

export interface AttachWorkflowPickerEntry {
  id: string;
  name: string;
}

export interface AttachWorkflowPickerProps {
  open: boolean;
  downstreamName: string;
  entries: AttachWorkflowPickerEntry[];
  onSelect: (upstreamWorkflowId: string) => void;
  onClose: () => void;
}

export function AttachWorkflowPicker({
  open,
  downstreamName,
  entries,
  onSelect,
  onClose,
}: AttachWorkflowPickerProps): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Attach ${downstreamName} to...`}
      data-testid="attach-workflow-picker"
      data-state="open"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[18vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border-strong bg-card text-card-foreground shadow-lg">
        <Command
          loop
          shouldFilter
          filter={(value, search) => (workflowPickerMatches(value, search) ? 1 : 0)}
        >
          <CommandInput
            ref={inputRef}
            placeholder={`Attach "${downstreamName}" to which upstream workflow?`}
          />
          <CommandList>
            {entries.length === 0 ? (
              <p className="px-3 py-6 text-center text-body text-muted-foreground">{NO_ATTACH_CANDIDATES}</p>
            ) : (
              <>
                <CommandEmpty>No matching workflows.</CommandEmpty>
                <CommandGroup heading="Workflows">
                  {entries.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={`${entry.name} ${entry.id}`}
                      onSelect={() => onSelect(entry.id)}
                    >
                      <GitBranch strokeWidth={1.75} />
                      <span className="truncate">{entry.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}
