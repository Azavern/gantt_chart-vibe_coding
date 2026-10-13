import { useCallback, useMemo, useRef, useState } from 'react';
import {
  addDays,
  nextWorkingDay,
  workingDaysBetween,
  type AssignmentDto,
  type DependencyDto,
  type HolidayDto,
  type ProjectDto,
  type ResourceDto,
  type TaskDto,
} from '@gantt/shared';
import { CalendarClock, CalendarX2, Plus, Sparkles, Sunrise } from 'lucide-react';

import { Button } from '../ui/Button';
import { EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { useUpdateTask } from '../../api/mutations';
import { formatDate, todayISO } from '../../lib/format';
import {
  DAY_WIDTH,
  HEADER_HEIGHT,
  ZOOM_LABELS,
  buildCalendar,
  buildRows,
  computeRange,
  criticalTaskIds,
  xOfDate,
  type ZoomLevel,
} from '../../lib/gantt';
import { GanttTableHeader, GanttTableRow } from './GanttTable';
import { GanttHeader, GanttTimeline, type DragMode } from './GanttTimeline';

export interface GanttChartProps {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
  selectedId: string | null;
  onSelectTask: (task: TaskDto) => void;
  onCreateTask: () => void;
}

const LEFT_COLUMN = 'w-[230px] shrink-0 sm:w-[330px] lg:w-[560px] xl:w-[900px]';

export default function GanttChart({
  project,
  tasks,
  dependencies,
  resources,
  assignments,
  holidays,
  selectedId,
  onSelectTask,
  onCreateTask,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCritical, setShowCritical] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const updateTask = useUpdateTask(project.id, { successMessage: null });

  const calendar = useMemo(() => buildCalendar(project, holidays), [project, holidays]);
  const rows = useMemo(
    () => buildRows(tasks, assignments, resources, collapsed),
    [tasks, assignments, resources, collapsed],
  );
  const range = useMemo(() => computeRange(tasks, project), [tasks, project]);
  const dayWidth = DAY_WIDTH[zoom];
  const today = todayISO();

  const criticalIds = useMemo(
    () => (showCritical ? criticalTaskIds(tasks, dependencies, calendar, project.startDate) : new Set<string>()),
    [showCritical, tasks, dependencies, calendar, project.startDate],
  );

  const holidayNames = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday.name])),
    [holidays],
  );

  const commitDrag = useCallback(
    async (task: TaskDto, mode: DragMode, deltaDays: number) => {
      try {
        if (mode === 'move') {
          const requestedStart = nextWorkingDay(calendar, addDays(task.scheduledStart, deltaDays));
          const updated = await updateTask.mutateAsync({ id: task.id, startDate: requestedStart });
          const result = updated.find((candidate) => candidate.id === task.id);

          if (result && result.scheduledStart !== requestedStart) {
            toast.info(
              `Tugas dikembalikan ke batas predecessor: ${formatDate(result.scheduledStart)}.`,
            );
          }
        } else {
          const durationDays = Math.max(
            1,
            workingDaysBetween(calendar, task.scheduledStart, addDays(task.scheduledEnd, deltaDays)),
          );
          await updateTask.mutateAsync({ id: task.id, durationDays });
        }
      } catch {
        // Pesan error sudah ditampilkan oleh hook mutasi.
      }
    },
    [calendar, toast, updateTask],
  );

  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const offset = leftColumnRef.current?.clientWidth ?? 0;
    const x = xOfDate(today, range.start, dayWidth);
    container.scrollTo({ left: Math.max(0, x + offset - 160), behavior: 'smooth' });
  }, [dayWidth, range.start, today]);

  const toggleCollapse = (taskId: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Zoom timeline"
          className="flex items-center gap-0.5 rounded-sm border border-line bg-surface p-0.5"
        >
          {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={zoom === level}
              onClick={() => setZoom(level)}
              className={`rounded-sm px-3 py-1.5 text-label font-medium transition-colors ${
                zoom === level ? 'bg-brand-700 text-white' : 'text-ink-2 hover:bg-surface2'
              }`}
            >
              {ZOOM_LABELS[level]}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={scrollToToday}
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        >
          Hari ini
        </Button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-label text-ink-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-700"
            checked={showCritical}
            onChange={(event) => setShowCritical(event.target.checked)}
          />
          <Sparkles className="h-4 w-4 text-danger" aria-hidden="true" />
          Sorot jalur kritis
        </label>

        <span className="hidden items-center gap-3 text-caption text-ink-3 md:flex">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-4 rounded-sm bg-surface2 ring-1 ring-line" aria-hidden="true" /> Akhir pekan
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-4 rounded-sm bg-warning-bg ring-1 ring-line" aria-hidden="true" /> Hari libur
          </span>
        </span>

        <Button
          size="sm"
          className="ml-auto"
          onClick={onCreateTask}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Tugas baru
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="scroll-slim overflow-auto rounded-md border border-line bg-surface"
        style={{ maxHeight: '72vh' }}
      >
        <div className="min-w-max">
          <div className="sticky top-0 z-20 flex border-b border-line bg-surface" style={{ height: HEADER_HEIGHT }}>
            <div className={`${LEFT_COLUMN} sticky left-0 z-30 border-r border-line bg-surface`} ref={leftColumnRef}>
              <GanttTableHeader />
            </div>
            <GanttHeader range={range} dayWidth={dayWidth} />
          </div>

          <div className="flex">
            <div className={`${LEFT_COLUMN} sticky left-0 z-10 border-r border-line bg-surface`}>
              {rows.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<CalendarX2 className="h-5 w-5" aria-hidden="true" />}
                    title="Belum ada tugas"
                    description="Tambahkan tugas pertama untuk melihat bar dan panah dependensinya."
                    action={
                      <Button size="sm" onClick={onCreateTask} icon={<Plus className="h-4 w-4" aria-hidden="true" />}>
                        Tugas baru
                      </Button>
                    }
                  />
                </div>
              ) : (
                rows.map((row) => (
                  <GanttTableRow
                    key={row.task.id}
                    row={row}
                    selected={selectedId === row.task.id}
                    critical={criticalIds.has(row.task.id)}
                    showCritical={showCritical}
                    onSelect={() => onSelectTask(row.task)}
                    onToggleCollapse={() => toggleCollapse(row.task.id)}
                  />
                ))
              )}
            </div>

            {rows.length > 0 ? (
              <GanttTimeline
                rows={rows}
                tasks={tasks}
                dependencies={dependencies}
                calendar={calendar}
                holidayNames={holidayNames}
                range={range}
                dayWidth={dayWidth}
                criticalIds={criticalIds}
                showCritical={showCritical}
                selectedId={selectedId}
                today={today}
                onSelectTask={onSelectTask}
                onCommitDrag={(task, mode, deltaDays) => void commitDrag(task, mode, deltaDays)}
              />
            ) : (
              <div className="h-24" />
            )}
          </div>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-3">
        <span className="inline-flex items-center gap-1">
          <Sunrise className="h-3.5 w-3.5" aria-hidden="true" />
          Geser bar untuk mengubah tanggal mulai, tarik tepi kanan untuk durasi.
        </span>
        <span>Bar induk tidak bisa digeser karena jadwalnya dihitung dari anak.</span>
      </p>
    </div>
  );
}
