import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays,
  FolderKanban,
  Plus,
  Trash2,
  Users,
  ListChecks,
} from 'lucide-react';
import { projectCreateSchema, type ProjectCreateInput, type ProjectSummaryDto } from '@gantt/shared';

import { useCreateProject, useDeleteProject } from '../api/mutations';
import { useProjects } from '../api/queries';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { CheckboxField, TextAreaField, TextField } from '../components/ui/Field';
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/States';
import { formatDate, todayISO } from '../lib/format';

const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function weekendLabel(days: number[]): string {
  if (days.length === 0) return 'Tanpa akhir pekan';
  return days.map((day) => WEEKDAY_LABELS[day].slice(0, 3)).join(' & ');
}

function ProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createProject = useCreateProject();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: todayISO(),
      weekendDays: [0, 6],
    },
  });

  const weekendDays = watch('weekendDays') ?? [0, 6];

  const onSubmit = handleSubmit(async (values) => {
    await createProject.mutateAsync({
      ...values,
      description: values.description?.trim() ? values.description : null,
    });
    reset();
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Proyek baru"
      description="Tentukan nama, tanggal mulai, dan pola akhir pekan proyek."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button form="form-proyek" type="submit" loading={isSubmitting}>
            Simpan proyek
          </Button>
        </>
      }
    >
      <form id="form-proyek" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Nama proyek"
          required
          placeholder="Contoh: Pengembangan Aplikasi Mobile"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextAreaField
          label="Deskripsi"
          placeholder="Ringkasan singkat tujuan proyek"
          error={errors.description?.message}
          {...register('description')}
        />
        <TextField
          label="Tanggal mulai"
          type="date"
          required
          error={errors.startDate?.message}
          {...register('startDate')}
        />

        <fieldset className="rounded-sm border border-line p-3">
          <legend className="px-1 text-label font-medium text-ink">Akhir pekan</legend>
          <p className="mb-2 text-caption text-ink-3">
            Hari yang tidak dihitung sebagai hari kerja.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAY_LABELS.map((label, index) => (
              <CheckboxField
                key={label}
                label={label}
                checked={weekendDays.includes(index)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...weekendDays, index].sort((a, b) => a - b)
                    : weekendDays.filter((day) => day !== index);
                  setValue('weekendDays', next, { shouldValidate: true });
                }}
              />
            ))}
          </div>
          {errors.weekendDays ? (
            <p role="alert" className="mt-2 text-caption font-medium text-danger">
              {errors.weekendDays.message ?? 'Akhir pekan tidak boleh berisi ketujuh hari.'}
            </p>
          ) : null}
        </fieldset>
      </form>
    </Dialog>
  );
}

function ProjectCard({ project, onDelete }: { project: ProjectSummaryDto; onDelete: () => void }) {
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-h3 font-semibold text-ink">{project.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-3">
            {project.description ?? 'Belum ada deskripsi.'}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700"
        >
          <FolderKanban className="h-5 w-5" />
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4">
        <Badge tone="info" icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}>
          Mulai {formatDate(project.startDate)}
        </Badge>
        <Badge tone="neutral">{weekendLabel(project.weekendDays)}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-ink-3" aria-hidden="true" />
          <dt className="sr-only">Jumlah tugas</dt>
          <dd className="tabular text-ink-2">{project.taskCount} tugas</dd>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-ink-3" aria-hidden="true" />
          <dt className="sr-only">Jumlah anggota</dt>
          <dd className="tabular text-ink-2">{project.resourceCount} anggota</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-3">
        <Link to={`/projects/${project.id}/gantt`} className="flex-1">
          <Button variant="primary" size="sm" block>
            Buka proyek
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Hapus proyek ${project.name}`}
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        >
          <span className="sr-only sm:not-sr-only">Hapus</span>
        </Button>
      </div>
    </Card>
  );
}

export default function ProjectsPage() {
  const projectsQuery = useProjects();
  const deleteProject = useDeleteProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummaryDto | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">Proyek</h1>
          <p className="mt-1 text-sm text-ink-3">
            Semua proyek tersimpan di database dan siap dijadwalkan.
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setDialogOpen(true)}
        >
          Proyek baru
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <Card>
          <SkeletonRows rows={4} columns={3} />
        </Card>
      ) : projectsQuery.isError ? (
        <Card>
          <ErrorState
            message="Tidak dapat memuat daftar proyek. Periksa koneksi ke server."
            onRetry={() => void projectsQuery.refetch()}
          />
        </Card>
      ) : (projectsQuery.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" aria-hidden="true" />}
            title="Belum ada proyek"
            description="Buat proyek pertama Anda untuk mulai menyusun tugas, dependensi, dan jadwal Gantt."
            action={
              <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setDialogOpen(true)}>
                Buat proyek
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(projectsQuery.data ?? []).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => setPendingDelete(project)}
            />
          ))}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus proyek?"
        message={`Proyek "${pendingDelete?.name ?? ''}" beserta seluruh tugas, dependensi, anggota, dan hari liburnya akan dihapus permanen.`}
        loading={deleteProject.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProject.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
