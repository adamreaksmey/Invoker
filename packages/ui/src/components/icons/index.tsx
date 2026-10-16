import type { JSX } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Clock,
  Compass,
  Cpu,
  Folder,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Layers,
  Moon,
  Network,
  Play,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sun,
  TerminalSquare,
  type LucideProps,
} from 'lucide-react';

const DEFAULT_STROKE_WIDTH = 1.75;

function withDefaults<C extends React.FC<LucideProps>>(Icon: C, defaults?: LucideProps) {
  return function InvokerIcon(props: LucideProps): JSX.Element {
    return (
      <Icon
        strokeWidth={DEFAULT_STROKE_WIDTH}
        aria-hidden={props['aria-hidden'] ?? 'true'}
        {...defaults}
        {...props}
      />
    );
  };
}

export const AttentionIcon = withDefaults(AlertTriangle);
export const AlertCircleIcon = withDefaults(AlertCircle);
export const RefreshIcon = withDefaults(RefreshCw);
export const StopIcon = withDefaults(CircleStop);
export const RunningIcon = withDefaults(Clock);
export const WorkerIcon = withDefaults(Cpu);
export const WorkflowsIcon = withDefaults(Layers);
export const GraphIcon = withDefaults(Network);
export const PlanningTerminalIcon = withDefaults(TerminalSquare);
export const SettingsIcon = withDefaults(Settings);
export const InvokerIcon = withDefaults(Compass);
export const ChevronLeftIcon = withDefaults(ChevronLeft);
export const ChevronRightIcon = withDefaults(ChevronRight);
export const ChevronDownIcon = withDefaults(ChevronDown);
export const PlayIcon = withDefaults(Play);
export const GitPullRequestIcon = withDefaults(GitPullRequest);
export const GitMergeIcon = withDefaults(GitMerge);
export const SunIcon = withDefaults(Sun);
export const MoonIcon = withDefaults(Moon);
export const ArrowUpIcon = withDefaults(ArrowUp);
export const RepositoryIcon = withDefaults(Folder);
export const GitBranchIcon = withDefaults(GitBranch);
export const OptionsIcon = withDefaults(SlidersHorizontal);
