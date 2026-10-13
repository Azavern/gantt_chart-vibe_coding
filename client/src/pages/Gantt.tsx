import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarRange, Pencil, Plus, RefreshCw } from 'lucide-react';
import { projectUpdateSchema, type ProjectUpdateInput, type TaskDto } from '@gantt/shared';

import { useProject } from '../api/queries';
import { useUpdateProject } from '../api/mutations';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { TextAreaField, TextField } from '../components/ui/Field';
import { ErrorState, LoadingBlock } from '../components/ui/States';
import GanttChart from '../components/gantt/GanttChart';
import TaskDialog from '../components/gantt/TaskDialog';
import { formatDate } from '../lib/format';
import type { ProjectDto } from '@gantt/shared';

function ProjectDetailsDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDto;
}) {
  const updateProject = useUpdateProject(project.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectUpdateInput>({
    resolver: zodResolver(projectUpdateSchema),
    defaultValues: {
      name: project.name,
      description: project.description ?? '',
      startDate: project.startDate,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await updateProject.mutateAsync({
      ...values,
      description: values.description?.trim() ? values.description : null,
    });
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detail proyek"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button form="form-detail-proyek" type="submit" loading={isSubmitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="form-detail-proyek" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <TextField label="Nama proyek" required error={errors.name?.message} {...register('name')} />
        <TextAreaField label="Deskripsi" error={errors.description?.message} {...register('description')} />
        <TextField
          label="Tanggal mulai proyek"
          type="date"
          required
          hint="Dipakai sebagai ordinal 0 pada perhitungan jalur kritis."
          error={errors.startDate?.message}
          {...register('startDate')}
        />
      </form>
    </Dialog>
  );
}

export default function GanttPage() {
  const { projectId } = useParams();
  const projectQuery = useProject(projectId);

  const [dialog, setDialog] = useState<{ open: boolean; task: TaskDto | null; parentId: string | null }>({
    open: false,
    task: null,
    parentId: null,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (projectQuery.isLoading) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <LoadingBlock label="Memuat proyek…" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <ErrorState
          title="Proyek tidak dapat dimuat"
          message="Proyek tidak ditemukan atau Anda tidak memiliki akses."
          onRetry={() => void projectQuery.refetch()}
        />
      </div>
    );
  }

  const { project, tasks, dependencies, resources, assignments, holidays } = projectQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">{project.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-3">
            {project.description ?? 'Belum ada deskripsi proyek.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="info" icon={<CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />}>
              Mulai {formatDate(project.startDate)}
            </Badge>
            <Badge tone="neutral">{tasks.length} tugas</Badge>
            <Badge tone="neutral">{resources.length} anggota</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void projectQuery.refetch()}
          >
            Muat ulang
          </Button>
          <Button
            variant="secondary"
            icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setDetailsOpen(true)}
          >
            Detail proyek
          </Button>
          <Button
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setDialog({ open: true, task: null, parentId: null })}
          >
            Tugas baru
          </Button>
        </div>
      </div>

      <GanttChart
        project={project}
        tasks={tasks}
        dependencies={dependencies}
        resources={resources}
        assignments={assignments}
        holidays={holidays}
        selectedId={dialog.open ? dialog.task?.id ?? null : null}
        onSelectTask={(task) => setDialog({ open: true, task, parentId: null })}
        onCreateTask={() => setDialog({ open: true, task: null, parentId: null })}
      />

      {dialog.open ? (
        <TaskDialog
          key={dialog.task?.id ?? 'baru'}
          open={dialog.open}
          onClose={() => setDialog({ open: false, task: null, parentId: null })}
          project={project}
          tasks={tasks}
          dependencies={dependencies}
          resources={resources}
          assignments={assignments}
          task={dialog.task}
          defaultParentId={dialog.parentId}
        />
      ) : null}

      {detailsOpen ? (
        <ProjectDetailsDialog open={detailsOpen} onClose={() => setDetailsOpen(false)} project={project} />
      ) : null}
    </div>
  );
}
