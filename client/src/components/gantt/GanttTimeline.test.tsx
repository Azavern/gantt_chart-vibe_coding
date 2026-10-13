import { render } from '@testing-library/react';
import { diffInDays } from '@gantt/shared';
import { describe, expect, it, vi } from 'vitest';

import { buildRows, computeRange, criticalTaskIds, DAY_WIDTH } from '../../lib/gantt';
import { buildFixture, taskById } from '../../test/fixtures';
import { GanttTimeline } from './GanttTimeline';

const fixture = buildFixture();
const rows = buildRows(fixture.tasks, fixture.assignments, fixture.resources, new Set());
const range = computeRange(fixture.tasks, fixture.project);
const holidayNames = new Map(fixture.holidays.map((holiday) => [holiday.date, holiday.name]));

function renderTimeline(options: { showCritical?: boolean; criticalIds?: Set<string> } = {}) {
  const criticalIds =
    options.criticalIds ??
    (options.showCritical
      ? criticalTaskIds(fixture.tasks, fixture.dependencies, fixture.calendar, fixture.project.startDate)
      : new Set<string>());

  return render(
    <GanttTimeline
      rows={rows}
      tasks={fixture.tasks}
      dependencies={fixture.dependencies}
      calendar={fixture.calendar}
      holidayNames={holidayNames}
      range={range}
      dayWidth={DAY_WIDTH.day}
      criticalIds={criticalIds}
      showCritical={options.showCritical ?? false}
      selectedId={null}
      today="2026-10-21"
      onSelectTask={vi.fn()}
      onCommitDrag={vi.fn()}
    />,
  );
}

describe('GanttTimeline', () => {
  it('menggambar bar menurut tanggal kalender sehingga melintasi akhir pekan', () => {
    const { container } = renderTimeline();

    const backend = taskById(fixture, 't21');
    const titles = Array.from(container.querySelectorAll('title')).map((node) => node.textContent ?? '');
    expect(
      titles.some(
        (title) =>
          title.includes('Implementasi backend') &&
          title.includes(`${backend.scheduledStart} sampai ${backend.scheduledEnd}`),
      ),
    ).toBe(true);

    // 10 hari kerja backend membentang lebih dari 10 hari kalender karena akhir pekan.
    const calendarDays = diffInDays(backend.scheduledStart, backend.scheduledEnd) + 1;
    expect(calendarDays).toBeGreaterThan(backend.durationDays);
    expect(container.querySelectorAll(`rect[width="${calendarDays * DAY_WIDTH.day}"]`).length).toBeGreaterThan(0);

    expect(container.querySelectorAll('rect.cursor-move').length).toBe(4);
  });

  it('menggambar panah dependensi FS dan SS sesuai jumlah dependensi', () => {
    const { container } = renderTimeline();

    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(fixture.dependencies.length);

    const labels = Array.from(container.querySelectorAll('text')).map((node) => node.textContent);
    expect(labels).toContain('SS +2');
  });

  it('menandai bar tugas kritis dengan garis merah saat sorotan aktif', () => {
    const criticalIds = criticalTaskIds(
      fixture.tasks,
      fixture.dependencies,
      fixture.calendar,
      fixture.project.startDate,
    );
    expect(criticalIds.has('t21')).toBe(true);

    const { container } = renderTimeline({ showCritical: true, criticalIds });

    const redStrokes = container.querySelectorAll('[stroke="#B91C1C"]');
    expect(redStrokes.length).toBeGreaterThan(0);
  });

  it('mengarsir akhir pekan dan hari libur serta menggambar garis hari ini', () => {
    const { container } = renderTimeline();

    const titles = Array.from(container.querySelectorAll('title')).map((node) => node.textContent);
    expect(titles).toContain('Hari libur: Cuti bersama');
    expect(titles).toContain('Akhir pekan');
    expect(titles).toContain('Garis hari ini');

    // 23 Oktober 2026 adalah Jumat, sehingga lebar bar tiga hari kerja tetap 5 hari kalender.
    const kickoff = taskById(fixture, 't11');
    expect(kickoff.scheduledStart).toBe('2026-10-19');
    expect(kickoff.scheduledEnd).toBe('2026-10-21');
  });

  it('tidak menyediakan pegangan geser untuk bar tugas induk', () => {
    const { container } = renderTimeline();

    const resizers = container.querySelectorAll('rect.cursor-ew-resize');
    const leafCount = fixture.tasks.filter(
      (task) => !fixture.tasks.some((candidate) => candidate.parentId === task.id),
    ).length;

    expect(resizers.length).toBe(leafCount);
  });
});
