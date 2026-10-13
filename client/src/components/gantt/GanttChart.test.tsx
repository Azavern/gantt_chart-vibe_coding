import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildFixture } from '../../test/fixtures';
import { ToastProvider } from '../ui/Toast';
import GanttChart from './GanttChart';

const fixture = buildFixture();

/** jsdom tidak menyediakan PointerEvent, jadi dipakai MouseEvent dengan tipe pointer. */
function pointerEvent(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
}

function renderChart(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GanttChart
          project={fixture.project}
          tasks={fixture.tasks}
          dependencies={fixture.dependencies}
          resources={fixture.resources}
          assignments={fixture.assignments}
          holidays={fixture.holidays}
          selectedId={null}
          onSelectTask={vi.fn()}
          onCreateTask={vi.fn()}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function patchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url).includes('/api/tasks/') && (init as RequestInit | undefined)?.method === 'PATCH')
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));
}

beforeEach(() => {
  window.localStorage.setItem('gantt.token', 'token-pengujian');
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('GanttChart - geser dan tarik bar', () => {
  it('mengirim startDate baru setelah bar tugas daun digeser dua hari', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ tasks: fixture.tasks }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { container } = renderChart(fetchMock);
    const backend = fixture.tasks.find((task) => task.id === 't21');
    expect(backend?.scheduledStart).toBe('2026-10-29');

    // Bar ketiga pada urutan baris adalah tugas daun pertama (t11, t12, t21).
    const dragTargets = container.querySelectorAll('rect.cursor-move');
    const target = dragTargets[2] as SVGRectElement;

    fireEvent(target, pointerEvent('pointerdown', 100));
    await waitFor(() => expect(container.querySelectorAll('rect.cursor-move').length).toBeGreaterThan(2));
    fireEvent(window, pointerEvent('pointermove', 100 + 34 * 2));
    fireEvent(window, pointerEvent('pointerup', 100 + 34 * 2));

    await waitFor(() => {
      expect(patchCalls(fetchMock)).toHaveLength(1);
    });

    // 29 Oktober + 2 hari = Sabtu 31 Oktober, digeser ke hari kerja berikutnya.
    expect(patchCalls(fetchMock)[0]).toEqual({
      url: '/api/tasks/t21',
      body: { startDate: '2026-11-02' },
    });
  });

  it('mengirim durationDays baru setelah tepi kanan bar ditarik', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ tasks: fixture.tasks }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { container } = renderChart(fetchMock);
    const resizer = container.querySelector('rect.cursor-ew-resize') as SVGRectElement;
    expect(resizer).not.toBeNull();

    fireEvent(resizer, pointerEvent('pointerdown', 200));
    fireEvent(window, pointerEvent('pointermove', 200 - 34));
    fireEvent(window, pointerEvent('pointerup', 200 - 34));

    await waitFor(() => {
      expect(patchCalls(fetchMock)).toHaveLength(1);
    });

    // Kickoff dan kebutuhan semula 3 hari (19-21 Oktober) menjadi 2 hari kerja.
    expect(patchCalls(fetchMock)[0]).toEqual({
      url: '/api/tasks/t11',
      body: { durationDays: 2 },
    });
  });

  it('tidak mengirim permintaan saat bar dilepas tanpa digeser', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ tasks: fixture.tasks }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { container } = renderChart(fetchMock);
    const target = container.querySelectorAll('rect.cursor-move')[2] as SVGRectElement;

    fireEvent(target, pointerEvent('pointerdown', 300));
    fireEvent(window, pointerEvent('pointerup', 300));

    await new Promise((resolve) => window.setTimeout(resolve, 30));
    expect(patchCalls(fetchMock)).toHaveLength(0);
  });
});
