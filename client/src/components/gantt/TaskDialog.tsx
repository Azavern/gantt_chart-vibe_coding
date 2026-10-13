import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AssignmentDto, DependencyDto, ProjectDto, ResourceDto, TaskDto } from '@gantt/shared';
import { computeTaskDepth, hexColorSchema, isoDateSchema, MAX_TASK_DEPTH, prioritySchema } from '@gantt/shared';
import { Info, Save, Trash2 } from 'lucide-react';

import { useCreateTask, useDeleteTask, useMoveTask, useUpdateTask } from '../../api/mutations';
import { Button } from '../ui/Button';
import { ConfirmDialog, Dialog } from '../ui/Dialog';
import { SelectField, TextAreaField, TextField } from '../ui/Field';
import AssignmentEditor from './AssignmentEditor';
import PredecessorEditor from './PredecessorEditor';

const taskFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama tugas wajib diisi.').max(200, 'Nama maksimal 200 karakter.'),
  description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter.'),
  parentId: z.string(),
  durationDays: z
    .number({ invalid_type_error: 'Durasi wajib diisi.' })
    .int('Durasi harus bilangan bulat.')
    .min(1, 'Durasi minimal 1 hari kerja.')
    .max(3650, 'Durasi maksimal 3650 hari kerja.'),
  startDate: isoDateSchema,
  priority: prioritySchema,
  color: hexColorSchema,
  progress: z
    .number({ invalid_type_error: 'Progres wajib diisi.' })
    .int('Progres harus bilangan bulat.')
    .min(0, 'Progres minimal 0.')
    .max(100, 'Progres maksimal 100.'),
  optimisticDays: z.number().int('Estimasi harus bilangan bulat.').min(1).max(3650).nullable(),
  pessimisticDays: z.number().int('Estimasi harus bilangan bulat.').min(1).max(3650).nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const COLOR_SWATCHES = ['#0F766E', '#1D4ED8', '#7C3AED', '#B45309', '#15803D', '#B91C1C'];

const numberOrNull = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  /** null berarti membuat tugas baru. */
  task: TaskDto | null;
  defaultParentId?: string | null;
}

export default function TaskDialog({
  open,
  onClose,
  project,
  tasks,
  dependencies,
  resources,
  assignments,
  task,
  defaultParentId = null,
}: TaskDialogProps) {
  const createTask = useCreateTask(project.id);
  const updateTask = useUpdateTask(project.id, { successMessage: null });
  const moveTask = useMoveTask(project.id);
  const deleteTask = useDeleteTask(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const item of tasks) {
      if (!item.parentId) continue;
      map.set(item.parentId, [...(map.get(item.parentId) ?? []), item]);
    }
    return map;
  }, [tasks]);

  const isSummary = Boolean(task && (childrenByParent.get(task.id) ?? []).length > 0);

  const parentOptions = useMemo(() => {
    const depths = computeTaskDepth(tasks);
    const descendants = new Set<string>();

    if (task) {
      const stack = [task.id];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        for (const item of tasks) {
          if (item.parentId === current && !descendants.has(item.id)) {
            descendants.add(item.id);
            stack.push(item.id);
          }
        }
      }
    }

    const heightOf = (taskId: string): number => {
      const children = childrenByParent.get(taskId) ?? [];
      return children.length === 0 ? 1 : 1 + Math.max(...children.map((child) => heightOf(child.id)));
    };

    const height = task ? heightOf(task.id) : 1;

    return tasks.filter(
      (candidate) =>
        candidate.id !== task?.id &&
        !descendants.has(candidate.id) &&
        (depths.get(candidate.id) ?? 1) + height <= MAX_TASK_DEPTH,
    );
  }, [tasks, task, childrenByParent]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: task?.name ?? '',
      description: task?.description ?? '',
      parentId: task?.parentId ?? defaultParentId ?? '',
      durationDays: task?.durationDays ?? 1,
      startDate: task?.startDate ?? project.startDate,
      priority: task?.priority ?? 'MEDIUM',
      color: task?.color ?? '#0D9488',
      progress: task?.progress ?? 0,
      optimisticDays: task?.optimisticDays ?? null,
      pessimisticDays: task?.pessimisticDays ?? null,
    },
  });

  const color = watch('color');

  const onSubmit = handleSubmit(async (values) => {
    const shared = {
      name: values.name,
      description: values.description.trim() ? values.description.trim() : null,
      priority: values.priority,
      color: values.color,
    };

    try {
      if (!task) {
        await createTask.mutateAsync({
          ...shared,
          parentId: values.parentId ? values.parentId : null,
          durationDays: values.durationDays,
          startDate: values.startDate,
          progress: values.progress,
          optimisticDays: values.optimisticDays,
          pessimisticDays: values.pessimisticDays,
        });
        onClose();
        return;
      }

      if (isSummary) {
        // Tugas induk hanya boleh diubah nama, deskripsi, warna, dan prioritasnya.
        await updateTask.mutateAsync({ id: task.id, ...shared });
      } else {
        await updateTask.mutateAsync({
          id: task.id,
          ...shared,
          durationDays: values.durationDays,
          startDate: values.startDate,
          progress: values.progress,
          optimisticDays: values.optimisticDays,
          pessimisticDays: values.pessimisticDays,
        });

        const nextParentId = values.parentId ? values.parentId : null;
        if (nextParentId !== task.parentId) {
          await moveTask.mutateAsync({ id: task.id, parentId: nextParentId, position: 9999 });
        }
      }

      onClose();
    } catch {
      // Pesan error sudah ditampilkan lewat toast oleh hook mutasi.
    }
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title={task ? `Ubah tugas: ${task.name}` : 'Tugas baru'}
        description={
          isSummary
            ? 'Tugas induk menghitung durasi dan progresnya otomatis dari anak-anaknya.'
            : 'Durasi dihitung dalam hari kerja; akhir pekan dan hari libur tidak dihitung.'
        }
        footer={
          <>
            {task ? (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                onClick={() => setConfirmDelete(true)}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              >
                Hapus tugas
              </Button>
            ) : null}
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button form="form-tugas" type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" aria-hidden="true" />}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="form-tugas" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <TextField
            label="Nama tugas"
            required
            placeholder="Contoh: Implementasi API pembayaran"
            error={errors.name?.message}
            {...register('name')}
          />

          <TextAreaField
            label="Deskripsi"
            placeholder="Catatan singkat mengenai tugas ini"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tugas induk"
              hint={task ? 'Mengubah induk akan memindahkan tugas beserta anaknya.' : undefined}
              error={errors.parentId?.message}
              {...register('parentId')}
            >
              <option value="">Tanpa induk (level 1)</option>
              {parentOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Durasi (hari kerja)"
              required
              type="number"
              min={1}
              max={3650}
              disabled={isSummary}
              hint={isSummary ? 'Dihitung otomatis dari anak-anaknya.' : undefined}
              error={errors.durationDays?.message}
              {...register('durationDays', { valueAsNumber: true })}
            />

            <TextField
              label="Mulai paling awal"
              required
              type="date"
              disabled={isSummary}
              hint={isSummary ? 'Mengikuti anak paling awal.' : undefined}
              error={errors.startDate?.message}
              {...register('startDate')}
            />

            <TextField
              label="Progres (%)"
              type="number"
              min={0}
              max={100}
              disabled={isSummary}
              hint={isSummary ? 'Rata-rata berbobot durasi anak.' : undefined}
              error={errors.progress?.message}
              {...register('progress', { valueAsNumber: true })}
            />

            <SelectField label="Prioritas" required error={errors.priority?.message} {...register('priority')}>
              <option value="LOW">Rendah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HIGH">Tinggi</option>
            </SelectField>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="warna-tugas" className="text-label font-medium text-ink">
                Warna indikator
                <span className="ml-1 text-danger">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="warna-tugas"
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-sm border border-line-input bg-surface p-1"
                  {...register('color')}
                />
                <span className="tabular text-label text-ink-2">{color}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Pakai warna ${swatch}`}
                    onClick={() => setValue('color', swatch, { shouldValidate: true })}
                    className="h-7 w-7 rounded-sm ring-1 ring-line transition-transform hover:scale-110"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              {errors.color ? (
                <p role="alert" className="text-caption font-medium text-danger">
                  {errors.color.message}
                </p>
              ) : null}
            </div>

            <TextField
              label="Estimasi optimistis (hari)"
              type="number"
              min={1}
              max={3650}
              disabled={isSummary}
              placeholder="opsional"
              error={errors.optimisticDays?.message}
              {...register('optimisticDays', { setValueAs: numberOrNull })}
            />

            <TextField
              label="Estimasi pesimistis (hari)"
              type="number"
              min={1}
              max={3650}
              disabled={isSummary}
              placeholder="opsional"
              error={errors.pessimisticDays?.message}
              {...register('pessimisticDays', { setValueAs: numberOrNull })}
            />
          </div>

          {isSummary ? (
            <p className="flex items-start gap-2 rounded-sm bg-info-bg px-3 py-2 text-sm text-info">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Tugas induk: nama, deskripsi, prioritas, dan warna bisa diubah; durasi, tanggal, serta progres
              dihitung otomatis dari anak-anaknya.
            </p>
          ) : null}

          {task && !isSummary ? (
            <>
              <PredecessorEditor
                projectId={project.id}
                task={task}
                tasks={tasks}
                dependencies={dependencies}
              />
              <AssignmentEditor
                projectId={project.id}
                task={task}
                resources={resources}
                assignments={assignments}
              />
            </>
          ) : null}

          {!task ? (
            <p className="rounded-sm bg-surface2 px-3 py-2 text-sm text-ink-3">
              Predecessor dan penanggung jawab bisa ditambahkan setelah tugas disimpan.
            </p>
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus tugas?"
        message={`Tugas "${task?.name ?? ''}" beserta sub-tugas, dependensi, dan alokasinya akan dihapus permanen.`}
        loading={deleteTask.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!task) return;
          void deleteTask.mutateAsync(task.id).then(() => {
            setConfirmDelete(false);
            onClose();
          });
        }}
      />
    </>
  );
}
