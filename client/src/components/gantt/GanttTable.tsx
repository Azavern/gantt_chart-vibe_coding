import { ChevronDown, ChevronRight, Users } from 'lucide-react';

import { PriorityBadge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { formatDate } from '../../lib/format';
import { ROW_HEIGHT, type GanttRow } from '../../lib/gantt';

const INDENT = 14;

export function GanttTableHeader() {
  return (
    <div className="flex h-full items-center gap-2 px-3">
      <span className="w-8 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3">WBS</span>
      <span className="flex-1 text-caption font-semibold uppercase tracking-wide text-ink-3">Tugas</span>
      <span className="hidden w-16 shrink-0 text-right text-caption font-semibold uppercase tracking-wide text-ink-3 sm:block">
        Durasi
      </span>
      <span className="hidden w-24 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3 xl:block">
        Mulai
      </span>
      <span className="hidden w-24 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3 xl:block">
        Selesai
      </span>
      <span className="hidden w-28 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3 lg:block">
        Prioritas
      </span>
      <span className="hidden w-32 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3 xl:block">
        Penanggung jawab
      </span>
      <span className="hidden w-32 shrink-0 text-caption font-semibold uppercase tracking-wide text-ink-3 lg:block">
        Progres
      </span>
    </div>
  );
}

export function GanttTableRow({
  row,
  selected,
  critical,
  showCritical,
  onSelect,
  onToggleCollapse,
}: {
  row: GanttRow;
  selected: boolean;
  critical: boolean;
  showCritical: boolean;
  onSelect: () => void;
  onToggleCollapse: () => void;
}) {
  const { task, depth, hasChildren, collapsed, wbs, assigneeNames } = row;
  const dimmed = showCritical && !critical;

  return (
    <div
      role="row"
      aria-selected={selected}
      style={{ height: ROW_HEIGHT }}
      className={`flex items-center gap-2 border-b border-line px-3 transition-colors ${
        selected ? 'bg-brand-50' : 'hover:bg-surface2'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      <span className="tabular w-8 shrink-0 text-caption text-ink-3">{wbs}</span>

      <span className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: (depth - 1) * INDENT }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? `Perluas ${task.name}` : `Lipat ${task.name}`}
            aria-expanded={!collapsed}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-line hover:text-ink"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden="true" />
        )}

        <span
          aria-hidden="true"
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: task.color }}
        />
        <button
          type="button"
          onClick={onSelect}
          className={`min-w-0 truncate rounded-sm px-1 text-left text-label hover:underline ${
            hasChildren ? 'font-semibold text-ink' : 'text-ink-2'
          }`}
          title={task.name}
        >
          {task.name}
        </button>
      </span>

      <span className="tabular hidden w-16 shrink-0 text-right text-label text-ink-2 sm:block">
        {task.durationDays} hari
      </span>
      <span className="tabular hidden w-24 shrink-0 text-label text-ink-2 xl:block">
        {formatDate(task.scheduledStart)}
      </span>
      <span className="tabular hidden w-24 shrink-0 text-label text-ink-2 xl:block">
        {formatDate(task.scheduledEnd)}
      </span>

      <span className="hidden w-28 shrink-0 lg:block">
        <PriorityBadge priority={task.priority} />
      </span>

      <span className="hidden w-32 shrink-0 truncate text-label text-ink-2 xl:block" title={assigneeNames.join(', ')}>
        {assigneeNames.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
            {assigneeNames.join(', ')}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </span>

      <span className="hidden w-32 shrink-0 lg:block">
        <ProgressBar value={task.progress} color={task.color} label={`Progres ${task.name}`} size="sm" />
      </span>
      {/* Kolom penanggung jawab dan tanggal disembunyikan pada lebar kecil
          agar tabel tetap terbaca; semuanya tersedia di dialog tugas. */}
    </div>
  );
}
