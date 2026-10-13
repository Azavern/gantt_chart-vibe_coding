import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../ui/Toast';
import { buildFixture } from '../../test/fixtures';
import TaskDialog from './TaskDialog';

const fixture = buildFixture();

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TaskDialog
          open
          onClose={vi.fn()}
          project={fixture.project}
          tasks={fixture.tasks}
          dependencies={fixture.dependencies}
          resources={fixture.resources}
          assignments={fixture.assignments}
          task={null}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('TaskDialog', () => {
  it('menampilkan pesan validasi saat nama tugas kosong', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));

    expect(await screen.findByText('Nama tugas wajib diisi.')).toBeInTheDocument();
  });

  it('menolak durasi kurang dari satu hari kerja', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Nama tugas/i), { target: { value: 'Tugas baru' } });
    fireEvent.change(screen.getByLabelText(/Durasi \(hari kerja\)/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));

    expect(await screen.findByText('Durasi minimal 1 hari kerja.')).toBeInTheDocument();
  });

  it('menolak progres di luar 0 sampai 100', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Nama tugas/i), { target: { value: 'Tugas baru' } });
    fireEvent.change(screen.getByLabelText(/Progres \(%\)/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));

    expect(await screen.findByText('Progres maksimal 100.')).toBeInTheDocument();
  });

  it('menyediakan pilihan induk dan warna default pada mode tambah', () => {
    renderDialog();

    const parentSelect = screen.getByLabelText(/Tugas induk/i);
    expect(parentSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Perencanaan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Warna indikator/i)).toBeInTheDocument();
  });

  it('menampilkan catatan bahwa predecessor ditambahkan setelah tugas disimpan', () => {
    renderDialog();

    expect(
      screen.getByText(/Predecessor dan penanggung jawab bisa ditambahkan setelah tugas disimpan/i),
    ).toBeInTheDocument();
  });

  it('mengirim nilai default yang valid saat form lengkap', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Nama tugas/i), { target: { value: 'Uji coba' } });
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Nama tugas wajib diisi.')).not.toBeInTheDocument();
    });
  });
});
