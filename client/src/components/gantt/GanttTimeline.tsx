import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  addDays,
  nextWorkingDay,
  recomputeSchedule,
  workingDaysBetween,
  type DependencyDto,
  type ProjectCalendar,
  type TaskDto,
} from '@gantt/shared';

import { HEADER_HEIGHT, ROW_HEIGHT, barWidth, xOfDate, type GanttRange, type GanttRow } from '../../lib/gantt';

export type DragMode = 'move' | 'resize';

interface DragState {
  taskId: string;
  mode: DragMode;
  deltaDays: number;
}

export interface GanttTimelineProps {
  rows: GanttRow[];
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  calendar: ProjectCalendar;
  /** Nama hari libur per tanggal untuk keterangan arsiran. */
  holidayNames: Map<string, string>;
  range: GanttRange;
  dayWidth: number;
  criticalIds: Set<string>;
  showCritical: boolean;
  selectedId: string | null;
  today: string;
  onSelectTask: (task: TaskDto) => void;
  onCommitDrag: (task: TaskDto, mode: DragMode, deltaDays: number) => void;
}

const LEAF_BAR_HEIGHT = 20;
const SUMMARY_BAR_HEIGHT = 6;

function applyModification(task: TaskDto, drag: DragState, calendar: ProjectCalendar): TaskDto {
  if (task.id !== drag.taskId) return task;

  if (drag.mode === 'move') {
    return { ...task, startDate: nextWorkingDay(calendar, addDays(task.scheduledStart, drag.deltaDays)) };
  }

  const end = addDays(task.scheduledEnd, drag.deltaDays);
  const durationDays = Math.max(1, workingDaysBetween(calendar, task.scheduledStart, end));
  return { ...task, durationDays };
}

export function GanttTimeline(props: GanttTimelineProps) {
  const {
    rows,
    tasks,
    dependencies,
    calendar,
    holidayNames,
    range,
    dayWidth,
    criticalIds,
    showCritical,
    selectedId,
    today,
    onSelectTask,
    onCommitDrag,
  } = props;

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragValueRef = useRef<DragState | null>(null);
  const pointerStartRef = useRef<{ x: number; taskId: string; mode: DragMode } | null>(null);

  useEffect(() => {
    dragValueRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent): void => {
      const start = pointerStartRef.current;
      if (!start) return;
      const deltaDays = Math.round((event.clientX - start.x) / dayWidth);
      setDrag((current) => (current && current.deltaDays === deltaDays ? current : current ? { ...current, deltaDays } : current));
    };

    const finish = (): void => {
      const start = pointerStartRef.current;
      const state = dragValueRef.current;
      pointerStartRef.current = null;
      setDrag(null);
      document.body.style.userSelect = '';

      if (!start || !state) return;
      const task = tasks.find((candidate) => candidate.id === state.taskId);
      if (!task) return;

      if (state.mode === 'move' && state.deltaDays === 0) return;
      const durationChanged =
        state.mode === 'resize' &&
        Math.max(1, workingDaysBetween(calendar, task.scheduledStart, addDays(task.scheduledEnd, state.deltaDays))) !==
          task.durationDays;
      if (state.mode === 'resize' && !durationChanged) return;

      onCommitDrag(task, state.mode, state.deltaDays);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [drag, dayWidth, tasks, calendar, onCommitDrag]);

  /** Pratinjau memakai mesin penjadwalan `shared` yang sama dengan server. */
  const previewTasks = useMemo<TaskDto[]>(() => {
    if (!drag) return tasks;

    try {
      return recomputeSchedule(
        tasks.map((task) => applyModification(task, drag, calendar)),
        dependencies,
        calendar,
      ) as TaskDto[];
    } catch {
      return tasks;
    }
  }, [drag, tasks, dependencies, calendar]);

  const rowIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.task.id, index));
    return map;
  }, [rows]);

  const taskById = useMemo(
    () => new Map(previewTasks.map((task) => [task.id, task])),
    [previewTasks],
  );

  const width = range.days * dayWidth;
  const height = Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT);
  const todayX = xOfDate(today, range.start, dayWidth);

  const startDrag = (
    event: ReactPointerEvent,
    task: TaskDto,
    mode: DragMode,
    hasChildren: boolean,
  ): void => {
    if (hasChildren) return;
    event.preventDefault();
    event.stopPropagation();
    pointerStartRef.current = { x: event.clientX, taskId: task.id, mode };
    setDrag({ taskId: task.id, mode, deltaDays: 0 });
    document.body.style.userSelect = 'none';
  };

  /** Arsiran akhir pekan dan hari libur. */
  const shadings = useMemo(() => {
    const items: Array<{ x: number; kind: 'weekend' | 'holiday'; date: string }> = [];
    let cursor = range.start;

    while (cursor < range.end) {
      const day = new Date(`${cursor}T00:00:00.000Z`).getUTCDay();
      const isWeekend = calendar.weekendDays.includes(day);
      const isHoliday = calendar.holidays.has(cursor);
      if (isWeekend || isHoliday) {
        items.push({
          x: xOfDate(cursor, range.start, dayWidth),
          kind: isHoliday ? 'holiday' : 'weekend',
          date: cursor,
        });
      }
      cursor = addDays(cursor, 1);
    }

    return items;
  }, [range.start, range.end, calendar, dayWidth]);

  return (
    <svg
      width={width}
      height={height}
      className="block"
      role="img"
      aria-label="Timeline Gantt berisi bar tugas dan panah dependensi"
    >
      {shadings.map((shading) => (
        <rect
          key={shading.date}
          x={shading.x}
          y={0}
          width={dayWidth}
          height={height}
          fill={shading.kind === 'holiday' ? '#FEF3C7' : '#F1F5F9'}
        >
          <title>
            {shading.kind === 'holiday'
              ? `Hari libur: ${holidayNames.get(shading.date) ?? shading.date}`
              : 'Akhir pekan'}
          </title>
        </rect>
      ))}

      {rows.map((row, index) => (
        <g key={row.task.id}>
          {selectedId === row.task.id ? (
            <rect x={0} y={index * ROW_HEIGHT} width={width} height={ROW_HEIGHT} fill="#F0FDFA" />
          ) : null}
          <line
            x1={0}
            x2={width}
            y1={(index + 1) * ROW_HEIGHT - 0.5}
            y2={(index + 1) * ROW_HEIGHT - 0.5}
            stroke="#E2E8F0"
          />
        </g>
      ))}

      {todayX >= 0 && todayX <= width ? (
        <g>
          <line x1={todayX} x2={todayX} y1={0} y2={height} stroke="#B91C1C" strokeWidth={1.5} strokeDasharray="4 3" />
          <title>Garis hari ini</title>
        </g>
      ) : null}

      {/* Panah dependensi: FS dari ujung kanan bar predecessor, SS dari ujung kiri. */}
      {dependencies.map((dependency) => {
        const predecessor = taskById.get(dependency.predecessorId);
        const successor = taskById.get(dependency.successorId);
        const sourceIndex = rowIndex.get(dependency.predecessorId);
        const targetIndex = rowIndex.get(dependency.successorId);
        if (!predecessor || !successor || sourceIndex === undefined || targetIndex === undefined) return null;

        const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const sourceX =
          dependency.type === 'FS'
            ? xOfDate(predecessor.scheduledEnd, range.start, dayWidth) + dayWidth
            : xOfDate(predecessor.scheduledStart, range.start, dayWidth);
        const targetX = xOfDate(successor.scheduledStart, range.start, dayWidth);
        const elbowX = targetX - 12;

        const isCritical =
          showCritical && criticalIds.has(predecessor.id) && criticalIds.has(successor.id);
        const stroke = isCritical ? '#B91C1C' : '#94A3B8';
        const label =
          dependency.type === 'SS' || dependency.lagDays !== 0
            ? `${dependency.type}${dependency.lagDays === 0 ? '' : dependency.lagDays > 0 ? ` +${dependency.lagDays}` : ` ${dependency.lagDays}`}`
            : null;

        return (
          <g key={dependency.id}>
            <path
              d={`M ${sourceX} ${sourceY} H ${elbowX} V ${targetY} H ${targetX}`}
              fill="none"
              stroke={stroke}
              strokeWidth={isCritical ? 2 : 1.25}
            />
            <polygon
              points={`${targetX},${targetY} ${targetX - 7},${targetY - 4} ${targetX - 7},${targetY + 4}`}
              fill={stroke}
            />
            {label && dayWidth > 10 ? (
              <text x={elbowX + 3} y={(sourceY + targetY) / 2 - 4} fontSize={10} fill="#64748B">
                {label}
              </text>
            ) : null}
            <title>{`Dependensi ${dependency.type}${dependency.lagDays ? ` lag ${dependency.lagDays}` : ''}`}</title>
          </g>
        );
      })}

      {/* Bar tugas. */}
      {rows.map((row) => {
        const task = taskById.get(row.task.id);
        const index = rowIndex.get(row.task.id);
        if (!task || index === undefined) return null;

        const x = xOfDate(task.scheduledStart, range.start, dayWidth);
        const width_ = barWidth(task, dayWidth);
        const isCritical = criticalIds.has(task.id);
        const dimmed = showCritical && !isCritical;
        const barY =
          index * ROW_HEIGHT + (row.hasChildren ? (ROW_HEIGHT - SUMMARY_BAR_HEIGHT) / 2 : (ROW_HEIGHT - LEAF_BAR_HEIGHT) / 2);
        const barH = row.hasChildren ? SUMMARY_BAR_HEIGHT : LEAF_BAR_HEIGHT;

        return (
          <g key={`bar-${task.id}`} opacity={dimmed ? 0.35 : 1}>
            <title>
              {`${task.name} · ${task.scheduledStart} sampai ${task.scheduledEnd} · ${task.durationDays} hari kerja · progres ${task.progress}%`}
            </title>

            {row.hasChildren ? (
              <>
                <rect x={x} y={barY} width={width_} height={barH} rx={2} fill={task.color} />
                <rect x={x} y={barY - 4} width={3} height={barH + 8} fill={task.color} />
                <rect x={x + width_ - 3} y={barY - 4} width={3} height={barH + 8} fill={task.color} />
              </>
            ) : (
              <>
                <rect x={x} y={barY} width={width_} height={barH} rx={5} fill={task.color} opacity={0.35} />
                <rect
                  x={x}
                  y={barY}
                  width={Math.max(2, (width_ * Math.min(100, Math.max(0, task.progress))) / 100)}
                  height={barH}
                  rx={5}
                  fill={task.color}
                />
                <rect
                  x={x}
                  y={barY}
                  width={width_}
                  height={barH}
                  rx={5}
                  fill="none"
                  stroke={isCritical && showCritical ? '#B91C1C' : 'rgba(15,23,42,0.18)'}
                  strokeWidth={isCritical && showCritical ? 2 : 1}
                />
              </>
            )}

            {selectedId === task.id ? (
              <rect
                x={x - 2}
                y={barY - 2}
                width={width_ + 4}
                height={barH + 4}
                rx={6}
                fill="none"
                stroke="#0F766E"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            ) : null}

            <rect
              x={x}
              y={index * ROW_HEIGHT}
              width={Math.max(width_, 6)}
              height={ROW_HEIGHT}
              fill="transparent"
              className={row.hasChildren ? 'cursor-pointer' : 'cursor-move'}
              onPointerDown={(event) => startDrag(event, task, 'move', row.hasChildren)}
              onClick={() => onSelectTask(task)}
            />

            {!row.hasChildren ? (
              <rect
                x={x + width_ - 5}
                y={index * ROW_HEIGHT + 6}
                width={10}
                height={ROW_HEIGHT - 12}
                fill="transparent"
                className="cursor-ew-resize"
                onPointerDown={(event) => startDrag(event, task, 'resize', false)}
              >
                <title>Tarik untuk mengubah durasi</title>
              </rect>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function GanttHeader({
  range,
  dayWidth,
}: {
  range: GanttRange;
  dayWidth: number;
}) {
  const width = range.days * dayWidth;

  const months = useMemo(() => {
    const items: Array<{ x: number; width: number; label: string }> = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    let cursor = range.start;
    while (cursor < range.end) {
      const date = new Date(`${cursor}T00:00:00.000Z`);
      const month = date.getUTCMonth();
      const year = date.getUTCFullYear();
      const monthStart = cursor;
      let monthEnd = cursor;

      while (monthEnd < range.end) {
        const next = addDays(monthEnd, 1);
        const nextDate = new Date(`${next}T00:00:00.000Z`);
        if (nextDate.getUTCMonth() !== month || nextDate.getUTCFullYear() !== year) break;
        monthEnd = next;
      }

      items.push({
        x: xOfDate(monthStart, range.start, dayWidth),
        width: (xOfDate(monthEnd, range.start, dayWidth) + dayWidth) - xOfDate(monthStart, range.start, dayWidth),
        label: `${monthNames[month]} ${year}`,
      });

      cursor = addDays(monthEnd, 1);
    }

    return items;
  }, [range.start, range.end, dayWidth]);

  const ticks = useMemo(() => {
    const items: Array<{ x: number; label: string; strong: boolean }> = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    let cursor = range.start;

    while (cursor <= range.end) {
      const date = new Date(`${cursor}T00:00:00.000Z`);
      const day = date.getUTCDate();
      const weekday = date.getUTCDay();

      if (dayWidth >= 24) {
        items.push({ x: xOfDate(cursor, range.start, dayWidth), label: String(day), strong: weekday === 1 });
      } else if (dayWidth >= 12 && weekday === 1) {
        items.push({ x: xOfDate(cursor, range.start, dayWidth), label: `${day}/${date.getUTCMonth() + 1}`, strong: true });
      } else if (dayWidth < 12 && day <= 7 && weekday === 1) {
        items.push({ x: xOfDate(cursor, range.start, dayWidth), label: dayNames[weekday], strong: true });
      }

      cursor = addDays(cursor, 1);
    }

    return items;
  }, [range.start, range.end, dayWidth]);

  return (
    <svg width={width} height={HEADER_HEIGHT} className="block" role="img" aria-label="Header timeline">
      {months.map((month) => (
        <g key={`${month.label}-${month.x}`}>
          <line x1={month.x} x2={month.x} y1={0} y2={HEADER_HEIGHT} stroke="#CBD5E1" />
          <text x={month.x + 6} y={16} fontSize={12} fontWeight={600} fill="#475569">
            {month.label}
          </text>
        </g>
      ))}

      {ticks.map((tick) => (
        <g key={`${tick.x}-${tick.label}`}>
          <line x1={tick.x} x2={tick.x} y1={28} y2={HEADER_HEIGHT} stroke={tick.strong ? '#CBD5E1' : '#E2E8F0'} />
          <text x={tick.x + dayWidth / 2} y={44} fontSize={11} textAnchor="middle" fill="#64748B">
            {tick.label}
          </text>
        </g>
      ))}

      <line x1={0} x2={width} y1={HEADER_HEIGHT - 0.5} y2={HEADER_HEIGHT - 0.5} stroke="#E2E8F0" />
    </svg>
  );
}
