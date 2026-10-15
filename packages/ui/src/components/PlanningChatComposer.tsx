import { useState, type ChangeEvent, type FormEvent, type JSX, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { PlanningConfirmationMode } from '@invoker/contracts';
import { PLANNING_CLONE_IN_PROGRESS } from '@invoker/contracts/planning-clone-status';
import { ArrowUpIcon, ChevronDownIcon, GitBranchIcon, OptionsIcon, RepositoryIcon } from './icons/index.js';

const COMPOSER_PLACEHOLDER = 'Describe what you want to build';
const READ_ONLY_WINDOW_PLACEHOLDER = 'This window is read-only.';
const READ_ONLY_SUBMITTED_PLACEHOLDER = 'This planning session was already submitted.';
const REPO_PLACEHOLDER = 'URL or path';
const BASE_BRANCH_PLACEHOLDER = 'main';
const REPO_SUGGESTIONS_ID = 'invoker-terminal-repo-suggestions';
const REPO_REQUIRED_MESSAGE = 'Required before planning';
const REPO_EDIT_LABEL = 'Edit';
const REPO_DONE_LABEL = 'Done';
const REPO_ACTION_BUTTON_CLASS = 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-xs text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50';
const HARNESS_EMPTY_LABEL = 'None';
const MODEL_EMPTY_LABEL = 'Default';
const MODEL_LOADING_LABEL = 'Loading models…';
const MODEL_LOADING_STATUS = 'Checking Cursor models…';
const REVIEW_ASK_FIRST_LABEL = 'Ask first';
const FIELD_ICON_CLASS = 'h-3.5 w-3.5 shrink-0 text-muted-foreground';
const MENU_CLASS = 'relative inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2 focus-within:border-border-strong';
const OVERLAY_SELECT_CLASS = 'absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed';
const SEND_BUTTON_CLASS = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-neutral-950 shadow-sm transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:shadow-none disabled:hover:bg-gray-700 disabled:opacity-50';
const CANCEL_BUTTON_CLASS = 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const CONFIRMATION_LABELS: Record<PlanningConfirmationMode, string> = {
  require: REVIEW_ASK_FIRST_LABEL,
  auto_submit: 'Auto submit',
};

export interface ComposerHarnessChoice {
  tool: string;
  label: string;
}

export interface ComposerModelOption {
  key: string;
  label: string;
  section?: 'recommended' | 'more';
}

export interface PlanningChatComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  busy: boolean;
  binding: boolean;
  readOnly: boolean;
  readOnlyReason: 'submitted' | 'window';
  expanded: boolean;
  disabledCursorClass: string;
  onValueChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  repoBound: boolean;
  repoEditing: boolean;
  repoValue: string;
  repoSuggestions: string[];
  baseBranchValue: string;
  repoMissing: boolean;
  repoNotice: string | null;
  repoError: string | null;
  onRepoInputChange?: (value: string) => void;
  onBaseBranchInputChange?: (value: string) => void;
  onRepoCommit?: () => void;
  onRepoEdit?: () => void;
  harnessChoices: ComposerHarnessChoice[];
  selectedHarnessValue: string;
  hasPlanningTools: boolean;
  onHarnessChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  selectedConfirmationMode: PlanningConfirmationMode;
  onConfirmationModeChange: (mode: PlanningConfirmationMode) => void;
  showModelSelect: boolean;
  modelOptions: ComposerModelOption[];
  selectedModelPresetKey: string;
  onPresetChange: (presetKey: string) => void;
  planningPresetsLoading: boolean;
  cursorDiscoveryWarning: string | null;
  emptyToolsMessage: string;
  sendDisabled: boolean;
  sendDisabledCursorClass: string;
  onCancelTurn?: () => void;
}

function fieldClass(extra: string): string {
  return `flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 ${extra}`;
}

function composerPlaceholder(composer: PlanningChatComposerProps): string {
  if (!composer.readOnly) return COMPOSER_PLACEHOLDER;
  if (composer.readOnlyReason === 'window') return READ_ONLY_WINDOW_PLACEHOLDER;
  return READ_ONLY_SUBMITTED_PLACEHOLDER;
}

function harnessValueLabel(composer: PlanningChatComposerProps): string {
  const match = composer.harnessChoices.find((choice) => choice.tool === composer.selectedHarnessValue);
  return match?.label ?? HARNESS_EMPTY_LABEL;
}

function commitFieldOnEnter(event: KeyboardEvent<HTMLInputElement>, commit: (() => void) | undefined): void {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  commit?.();
}

function ComposerPrompt({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  const promptClass = `min-h-14 w-full resize-none border-0 bg-transparent px-1.5 py-2.5 font-sans text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 ${composer.disabledCursorClass}`;
  return (
    <textarea
      ref={composer.inputRef}
      data-testid="invoker-terminal-input"
      value={composer.value}
      disabled={composer.busy || composer.binding || composer.readOnly}
      rows={composer.expanded ? 5 : 1}
      onChange={composer.onValueChange}
      onKeyDown={composer.onInputKeyDown}
      placeholder={composerPlaceholder(composer)}
      className={promptClass}
    />
  );
}

interface ComposerTextFieldProps {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  testId: string;
  fieldClassName: string;
  listId?: string;
  suggestions?: string[];
  onValueChange: (value: string) => void;
  onCommit?: () => void;
}

function FieldSuggestions({ listId, suggestions }: { listId?: string; suggestions?: string[] }): JSX.Element | null {
  if (!listId || !suggestions) return null;
  return (
    <datalist id={listId}>
      {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
    </datalist>
  );
}

function ComposerTextField(props: ComposerTextFieldProps): JSX.Element {
  return (
    <label className={props.fieldClassName}>
      {props.icon}
      <span className="shrink-0 text-xs text-muted-foreground">{props.label}</span>
      <input
        data-testid={props.testId}
        list={props.listId}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(event) => props.onValueChange(event.target.value)}
        onBlur={() => props.onCommit?.()}
        onKeyDown={(event) => commitFieldOnEnter(event, props.onCommit)}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      />
      <FieldSuggestions listId={props.listId} suggestions={props.suggestions} />
    </label>
  );
}

function repoFieldsDisabled(composer: PlanningChatComposerProps): boolean {
  const editsLocked = composer.repoBound && !composer.repoEditing;
  return composer.readOnly || composer.binding || editsLocked;
}

function RepoField({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <ComposerTextField
      icon={<RepositoryIcon className={FIELD_ICON_CLASS} />}
      label="Repository"
      value={composer.repoValue}
      placeholder={REPO_PLACEHOLDER}
      disabled={repoFieldsDisabled(composer)}
      testId="invoker-terminal-repo"
      listId={REPO_SUGGESTIONS_ID}
      suggestions={composer.repoSuggestions}
      fieldClassName={fieldClass('flex-[1.35]')}
      onValueChange={(next) => composer.onRepoInputChange?.(next)}
      onCommit={composer.onRepoCommit}
    />
  );
}

function BaseBranchField({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <ComposerTextField
      icon={<GitBranchIcon className={FIELD_ICON_CLASS} />}
      label="Base branch:"
      value={composer.baseBranchValue}
      placeholder={BASE_BRANCH_PLACEHOLDER}
      disabled={repoFieldsDisabled(composer)}
      testId="invoker-terminal-base-branch"
      fieldClassName={fieldClass('flex-1')}
      onValueChange={(next) => composer.onBaseBranchInputChange?.(next)}
      onCommit={composer.onRepoCommit}
    />
  );
}

function RepoMissingNotice({ missing }: { missing: boolean }): JSX.Element | null {
  if (!missing) return null;
  return <span className="px-1 text-[11px] text-muted-foreground">{REPO_REQUIRED_MESSAGE}</span>;
}

function CloneProgressNotice({ binding }: { binding: boolean }): JSX.Element | null {
  if (!binding) return null;
  return (
    <span className="px-1 text-xs text-muted-foreground" data-testid="invoker-terminal-clone-status">
      {PLANNING_CLONE_IN_PROGRESS}
    </span>
  );
}

function CloneSuccessNotice({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (composer.binding || !composer.repoNotice || composer.repoError) return null;
  return (
    <span className="px-1 text-xs text-emerald-600 dark:text-emerald-400" data-testid="invoker-terminal-clone-status">
      {composer.repoNotice}
    </span>
  );
}

function RepoErrorNotice({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (!composer.repoError) return null;
  return (
    <span className="px-1 text-xs text-red-400" data-testid="invoker-terminal-repo-error">
      {composer.repoError}
      <button
        type="button"
        data-testid="invoker-terminal-repo-retry"
        disabled={composer.binding}
        onClick={() => composer.onRepoCommit?.()}
        className="ml-2 rounded border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-secondary disabled:opacity-60"
      >
        Retry
      </button>
    </span>
  );
}

function ComposerRepoNotices({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <>
      <RepoMissingNotice missing={composer.repoMissing} />
      <CloneProgressNotice binding={composer.binding} />
      <CloneSuccessNotice composer={composer} />
      <RepoErrorNotice composer={composer} />
    </>
  );
}

function RepoEditButton({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (!composer.repoBound || composer.readOnly || composer.binding) return null;
  if (composer.repoEditing) {
    return (
      <button
        type="button"
        data-testid="invoker-terminal-repo-done"
        onClick={() => composer.onRepoCommit?.()}
        className={REPO_ACTION_BUTTON_CLASS}
      >
        {REPO_DONE_LABEL}
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid="invoker-terminal-repo-edit"
      onClick={() => composer.onRepoEdit?.()}
      className={REPO_ACTION_BUTTON_CLASS}
    >
      {REPO_EDIT_LABEL}
    </button>
  );
}

function ComposerRepoSection({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <div className="mb-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <RepoField composer={composer} />
        <BaseBranchField composer={composer} />
        <RepoEditButton composer={composer} />
      </div>
      <ComposerRepoNotices composer={composer} />
    </div>
  );
}

interface ComposerMenuProps {
  label: string;
  valueLabel: string;
  testId: string;
  value: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}

function ComposerMenu(props: ComposerMenuProps): JSX.Element {
  const menuClass = props.disabled ? `${MENU_CLASS} opacity-60` : MENU_CLASS;
  return (
    <div className={menuClass}>
      <span className="pointer-events-none text-xs text-muted-foreground">{props.label}</span>
      <span className="pointer-events-none max-w-[7.5rem] truncate text-xs font-semibold text-foreground">{props.valueLabel}</span>
      <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 text-muted-foreground" />
      <select
        data-testid={props.testId}
        aria-label={props.label}
        value={props.value}
        disabled={props.disabled}
        onChange={props.onChange}
        className={OVERLAY_SELECT_CLASS}
      >
        {props.children}
      </select>
    </div>
  );
}

function HarnessMenu({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <ComposerMenu
      label="Harness"
      valueLabel={harnessValueLabel(composer)}
      testId="invoker-terminal-harness"
      value={composer.selectedHarnessValue}
      disabled={composer.readOnly || !composer.hasPlanningTools}
      onChange={composer.onHarnessChange}
    >
      {composer.harnessChoices.map((choice) => (
        <option key={choice.tool} value={choice.tool}>{choice.label}</option>
      ))}
    </ComposerMenu>
  );
}

function ReviewMenu({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  return (
    <ComposerMenu
      label="Review"
      valueLabel={CONFIRMATION_LABELS[composer.selectedConfirmationMode]}
      testId="invoker-terminal-confirmation-mode"
      value={composer.selectedConfirmationMode}
      disabled={composer.readOnly}
      onChange={(event) => composer.onConfirmationModeChange(event.target.value as PlanningConfirmationMode)}
    >
      <option value="require">{REVIEW_ASK_FIRST_LABEL}</option>
    </ComposerMenu>
  );
}

function OptionsButton({ open, onToggle }: { open: boolean; onToggle: () => void }): JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <OptionsIcon className="h-3.5 w-3.5" />
      Options
    </button>
  );
}

function ModelOptionItems({ options }: { options: ComposerModelOption[] }): JSX.Element {
  return (
    <>
      {options.map((option) => (
        <option key={option.key} value={option.key}>{option.label}</option>
      ))}
    </>
  );
}

function ModelOptions({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  const recommended = composer.modelOptions.filter((option) => option.section !== 'more');
  const more = composer.modelOptions.filter((option) => option.section === 'more');
  if (composer.planningPresetsLoading && composer.modelOptions.length === 0) {
    return <option value="">{MODEL_LOADING_LABEL}</option>;
  }
  if (recommended.length === 0 || more.length === 0) {
    return <ModelOptionItems options={composer.modelOptions} />;
  }
  return (
    <>
      <optgroup label="Recommended">
        <ModelOptionItems options={recommended} />
      </optgroup>
      <optgroup label="More…">
        <ModelOptionItems options={more} />
      </optgroup>
    </>
  );
}

function modelValueLabel(composer: PlanningChatComposerProps): string {
  const selected = composer.modelOptions.find((option) => option.key === composer.selectedModelPresetKey);
  return selected?.label ?? MODEL_EMPTY_LABEL;
}

function ModelMenu({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (!composer.showModelSelect) return null;
  return (
    <ComposerMenu
      label="Model"
      valueLabel={modelValueLabel(composer)}
      testId="invoker-terminal-model"
      value={composer.selectedModelPresetKey}
      disabled={composer.readOnly || composer.planningPresetsLoading}
      onChange={(event) => composer.onPresetChange(event.target.value)}
    >
      <ModelOptions composer={composer} />
    </ComposerMenu>
  );
}

function ModelsLoading({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (!composer.planningPresetsLoading) return null;
  return (
    <span data-testid="invoker-terminal-models-loading" className="text-[11px] text-muted-foreground">
      {MODEL_LOADING_STATUS}
    </span>
  );
}

function ModelsWarning({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (!composer.cursorDiscoveryWarning || composer.planningPresetsLoading) return null;
  return (
    <span
      data-testid="invoker-terminal-models-warning"
      className="max-w-md text-[11px] text-amber-600 dark:text-amber-400"
      title={composer.cursorDiscoveryWarning}
    >
      {composer.cursorDiscoveryWarning}
    </span>
  );
}

function composerHasExtraOptions(composer: PlanningChatComposerProps): boolean {
  return composer.planningPresetsLoading || Boolean(composer.cursorDiscoveryWarning);
}

function ComposerOptionsPanel({ composer, open }: { composer: PlanningChatComposerProps; open: boolean }): JSX.Element | null {
  if (!open || !composerHasExtraOptions(composer)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <ModelsLoading composer={composer} />
      <ModelsWarning composer={composer} />
    </div>
  );
}

function EmptyToolsNotice({ composer }: { composer: PlanningChatComposerProps }): JSX.Element | null {
  if (composer.hasPlanningTools) return null;
  return (
    <p data-testid="invoker-terminal-planning-tools-empty" className="mt-2 text-xs text-muted-foreground">
      {composer.emptyToolsMessage}
    </p>
  );
}

function CancelButton({ onCancel }: { onCancel?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      aria-label="Cancel"
      data-testid="invoker-terminal-cancel"
      onClick={() => onCancel?.()}
      className={CANCEL_BUTTON_CLASS}
    >
      Cancel
    </button>
  );
}

function SendButton({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  const buttonClass = `${SEND_BUTTON_CLASS} ${composer.sendDisabledCursorClass}`;
  return (
    <button type="submit" aria-label="Send" disabled={composer.sendDisabled} className={buttonClass}>
      {composer.binding ? (
        <span
          data-testid="invoker-terminal-send-spinner"
          aria-hidden="true"
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-500 border-t-gray-100"
        />
      ) : (
        <ArrowUpIcon data-testid="invoker-terminal-send-icon" className="h-4 w-4" />
      )}
    </button>
  );
}

function ComposerSendControl({ composer }: { composer: PlanningChatComposerProps }): JSX.Element {
  if (composer.busy && !composer.binding) return <CancelButton onCancel={composer.onCancelTurn} />;
  return <SendButton composer={composer} />;
}

function ComposerToolbar({
  composer,
  optionsOpen,
  onToggleOptions,
}: {
  composer: PlanningChatComposerProps;
  optionsOpen: boolean;
  onToggleOptions: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <HarnessMenu composer={composer} />
        <ReviewMenu composer={composer} />
        <ModelMenu composer={composer} />
        <OptionsButton open={optionsOpen} onToggle={onToggleOptions} />
      </div>
      <ComposerSendControl composer={composer} />
    </div>
  );
}

function ComposerCard({
  composer,
  optionsOpen,
  onToggleOptions,
}: {
  composer: PlanningChatComposerProps;
  optionsOpen: boolean;
  onToggleOptions: () => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card px-3.5 pb-3 pt-1.5 focus-within:border-border-strong">
      <ComposerPrompt composer={composer} />
      <div className="mx-1.5 mb-2.5 border-t border-border" />
      <ComposerRepoSection composer={composer} />
      <ComposerToolbar composer={composer} optionsOpen={optionsOpen} onToggleOptions={onToggleOptions} />
      <ComposerOptionsPanel composer={composer} open={optionsOpen} />
      <EmptyToolsNotice composer={composer} />
    </div>
  );
}

export function PlanningChatComposer(props: PlanningChatComposerProps): JSX.Element {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const toggleOptions = (): void => {
    setOptionsOpen((open) => !open);
  };
  return (
    <form className="bg-background px-3 pb-3 pt-1" onSubmit={props.onFormSubmit}>
      <ComposerCard composer={props} optionsOpen={optionsOpen} onToggleOptions={toggleOptions} />
    </form>
  );
}
