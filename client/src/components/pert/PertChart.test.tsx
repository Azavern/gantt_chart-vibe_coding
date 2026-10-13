import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { buildPert, type TaskDto } from '@gantt/shared';
import { describe, expect, it } from 'vitest';

import { buildFixture, PROJECT_START } from '../../test/fixtures';
import PertChart from './PertChart';

const fixture = buildFixture();

/** Menambah satu tugas non-kritis agar warna kritis dan non-kritis bisa dibandingkan. */
const tasks: TaskDto[] = [
  ...fixture.tasks,
  {
    id: 't23',
    projectId: fixture.project.id,
    parentId: 'p2',
    position: 3,
    name: 'Dokumentasi rilis',
    description: null,
    durationDays: 1,
    startDate: PROJECT_START,
    scheduledStart: '2026-11-12',
    scheduledEnd: '2026-11-12',
    priority: 'LOW',
    color: '#1D4ED8',
    progress: 0,
    optimisticDays: null,
    pessimisticDays: null,
  },
];

const dependencies = [
  ...fixture.dependencies,
  { id: 'd4', predecessorId: 't21', successorId: 't23', type: 'FS' as const, lagDays: 0 },
];

const pert = buildPert(tasks, dependencies, fixture.calendar, PROJECT_START);

describe('PertChart', () => {
  it('menandai node kritis merah dan node lainnya netral', () => {
    const criticalIds = pert.nodes.filter((node) => node.critical).map((node) => node.taskId);
    expect(criticalIds.sort()).toEqual(['t11', 't12', 't21', 't22']);

    const { container } = render(<PertChart nodes={pert.nodes} edges={pert.edges} />);

    expect(container.querySelectorAll('rect[stroke="#B91C1C"]').length).toBe(criticalIds.length);
    expect(container.querySelectorAll('rect[stroke="#CBD5E1"]').length).toBe(
      pert.nodes.length - criticalIds.length,
    );
  });

  it('memakai panah merah hanya pada dependensi kritis', () => {
    const { container } = render(<PertChart nodes={pert.nodes} edges={pert.edges} />);

    const criticalEdgeCount = pert.edges.filter((edge) => edge.critical).length;
    expect(criticalEdgeCount).toBeGreaterThan(0);
    expect(criticalEdgeCount).toBeLessThan(pert.edges.length);

    expect(container.querySelectorAll('path[marker-end="url(#pert-arrow-critical)"]').length).toBe(
      criticalEdgeCount,
    );
    expect(container.querySelectorAll('path[marker-end="url(#pert-arrow)"]').length).toBe(
      pert.edges.length - criticalEdgeCount,
    );
  });

  it('menampilkan nama, durasi, dan slack pada setiap node', () => {
    render(<PertChart nodes={pert.nodes} edges={pert.edges} />);

    expect(screen.getByText(/Implementasi frontend/)).toBeInTheDocument();
    expect(screen.getByText('Durasi 12 hari')).toBeInTheDocument();
    // Empat tugas kritis punya slack 0, satu tugas non-kritis punya slack 3.
    expect(screen.getAllByText('slack 0')).toHaveLength(4);
    expect(screen.getByText('slack 3')).toBeInTheDocument();
  });

  it('memperbesar dan memperkecil diagram', () => {
    render(<PertChart nodes={pert.nodes} edges={pert.edges} />);

    const svg = screen.getByRole('img', { name: /Diagram PERT/i });
    const initialWidth = Number(svg.getAttribute('width'));

    fireEvent.click(screen.getByRole('button', { name: /Perbesar diagram/i }));
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(initialWidth);

    fireEvent.click(screen.getByRole('button', { name: /Perkecil diagram/i }));
    expect(Number(svg.getAttribute('width'))).toBe(initialWidth);
  });
});
