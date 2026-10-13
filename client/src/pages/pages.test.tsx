import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPert,
  computeCpm,
  costByResource,
  findOverAllocations,
  getLeafTasks,
  projectCost,
  type AnalysisResult,
  type ProjectSnapshot,
} from '@gantt/shared';

import App from '../App';
import { ToastProvider } from '../components/ui/Toast';
import { AuthProvider } from '../lib/auth';
import { buildFixture } from '../test/fixtures';

const fixture = buildFixture();

function buildAnalysis(): AnalysisResult {
  const dependencies = fixture.dependencies;
  const calendar = fixture.calendar;
  const projectStart = fixture.project.startDate;

  const cpm = computeCpm(fixture.tasks, dependencies, calendar, projectStart);
  const pert = buildPert(fixture.tasks, dependencies, calendar, projectStart);
  const leaves = getLeafTasks(fixture.tasks);
  const nameById = new Map(fixture.tasks.map((task) => [task.id, task.name]));
  const overAllocations = findOverAllocations(
    fixture.tasks,
    fixture.assignments,
    fixture.resources,
    calendar,
  );

  return {
    summary: {
      startDate: leaves[0]?.scheduledStart ?? null,
      endDate: leaves[leaves.length - 1]?.scheduledEnd ?? null,
      totalWorkingDays: 30,
      totalCost: projectCost(fixture.tasks, fixture.assignments, fixture.resources),
      criticalTaskCount: cpm.criticalTaskIds.length,
      leafTaskCount: leaves.length,
    },
    cpm: cpm.nodes.map((node) => ({
      taskId: node.taskId,
      name: nameById.get(node.taskId) ?? node.taskId,
      durationDays: node.durationDays,
      es: node.es,
      ef: node.ef,
      ls: node.ls,
      lf: node.lf,
      totalFloat: node.totalFloat,
      critical: node.critical,
    })),
    criticalPath: cpm.criticalPath,
    pert,
    cost: {
      total: projectCost(fixture.tasks, fixture.assignments, fixture.resources),
      byResource: costByResource(fixture.tasks, fixture.assignments, fixture.resources),
    },
    resources: fixture.resources.map((resource) => ({
      resourceId: resource.id,
      name: resource.name,
      role: resource.role,
      salary: resource.salary,
      totalCost: 0,
      taskCount: 0,
      overAllocated: false,
    })),
    overAllocations,
  };
}

const snapshot: ProjectSnapshot = {
  project: fixture.project,
  tasks: fixture.tasks,
  dependencies: fixture.dependencies,
  resources: fixture.resources,
  assignments: fixture.assignments,
  holidays: fixture.holidays,
};

const RESPONSES: Record<string, unknown> = {
  '/api/auth/me': { user: { id: 'user-1', name: 'Pengguna Demo', email: 'demo@example.com', createdAt: '2026-10-01T00:00:00.000Z' } },
  '/api/projects': {
    projects: [
      {
        ...fixture.project,
        taskCount: fixture.tasks.length,
        resourceCount: fixture.resources.length,
      },
    ],
  },
  '/api/projects/project-1': snapshot,
  '/api/projects/project-1/analysis': buildAnalysis(),
};

function renderApp(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem('gantt.token', 'token-pengujian');

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input).replace(/^https?:\/\/[^/]+/, '');
      const normalized = url.split('?')[0];
      const body = RESPONSES[normalized];

      if (body === undefined) {
        return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Tidak ada mock untuk ${normalized}`, details: {} } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('halaman aplikasi', () => {
  it('menampilkan daftar proyek beserta jumlah tugas dan anggota', async () => {
    renderApp('/projects');

    expect(await screen.findByText('Pengembangan Aplikasi Mobile Toko Online')).toBeInTheDocument();
    expect(screen.getByText(/6 tugas/)).toBeInTheDocument();
    expect(screen.getByText(/2 anggota/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buka proyek/i })).toBeInTheDocument();
  });

  it('menampilkan halaman Gantt dengan tabel tugas dan toolbar', async () => {
    renderApp('/projects/project-1/gantt');

    expect(await screen.findByRole('heading', { name: /Pengembangan Aplikasi Mobile Toko Online/i })).toBeInTheDocument();
    expect(screen.getByText('Kickoff dan kebutuhan')).toBeInTheDocument();
    expect(screen.getByText('Implementasi backend')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Tugas baru$/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Timeline Gantt/i })).toBeInTheDocument();
  });

  it('menampilkan halaman Tim dengan gaji dan biaya', async () => {
    renderApp('/projects/project-1/team');

    expect(await screen.findByText('Andi Pratama')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getAllByText(/Rp 15\.000\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Total biaya proyek/i)).toBeInTheDocument();
  });

  it('menampilkan halaman Kalender dengan akhir pekan, hari libur, dan kalender mini', async () => {
    renderApp('/projects/project-1/calendar');

    expect(await screen.findByRole('heading', { name: 'Kalender' })).toBeInTheDocument();
    expect(screen.getAllByText('Cuti bersama').length).toBeGreaterThan(0);
    expect(screen.getByText(/Akhir pekan:/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Sabtu' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Senin' })).not.toBeChecked();
  });

  it('menampilkan halaman Analisis dengan jalur kritis, tabel CPM, dan diagram PERT', async () => {
    renderApp('/projects/project-1/analysis');

    expect(await screen.findByRole('heading', { name: 'Analisis' })).toBeInTheDocument();
    expect(screen.getAllByText(/Jalur kritis/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimasi jalur kritis/i)).toBeInTheDocument();
    expect(screen.getByText('Tabel CPM')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Diagram PERT/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Rp /).length).toBeGreaterThan(0);
  });

  it('mengalihkan pengguna tanpa sesi ke halaman login', async () => {
    window.localStorage.clear();
    renderApp('/projects');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument();
    });
  });
});
