import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { resourceCreateSchema, type ResourceCreateInput, type ResourceDto } from '@gantt/shared';

import { useCreateResource, useDeleteResource, useUpdateResource } from '../api/mutations';
import { useAnalysis, useProject } from '../api/queries';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, StatTile } from '../components/ui/Card';
import { ConfirmDialog, Dialog } from '../components/ui/Dialog';
import { TextField } from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/States';
import { formatCurrency, formatDate } from '../lib/format';

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function ResourceDialog({
  open,
  onClose,
  projectId,
  resource,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  resource: ResourceDto | null;
}) {
  const createResource = useCreateResource(projectId);
  const updateResource = useUpdateResource(projectId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResourceCreateInput>({
    resolver: zodResolver(resourceCreateSchema),
    defaultValues: {
      name: resource?.name ?? '',
      email: resource?.email ?? '',
      role: resource?.role ?? '',
      salary: resource?.salary ?? 10_000_000,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (resource) await updateResource.mutateAsync({ id: resource.id, ...values });
    else await createResource.mutateAsync(values);
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={resource ? `Ubah anggota: ${resource.name}` : 'Anggota tim baru'}
      description="Gaji dipakai untuk menghitung tarif harian (gaji / 22) dan biaya tugas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button form="form-anggota" type="submit" loading={isSubmitting}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="form-anggota" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <TextField label="Nama" required error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" required error={errors.email?.message} {...register('email')} />
        <TextField label="Peran" required placeholder="Contoh: Backend Developer" error={errors.role?.message} {...register('role')} />
        <TextField
          label="Gaji per bulan (rupiah)"
          type="number"
          required
          min={0}
          hint="Angka tanpa titik atau koma."
          error={errors.salary?.message}
          {...register('salary', { valueAsNumber: true })}
        />
      </form>
    </Dialog>
  );
}

export default function TeamPage() {
  const { projectId } = useParams();
  const projectQuery = useProject(projectId);
  const analysisQuery = useAnalysis(projectId);

  const [dialog, setDialog] = useState<{ open: boolean; resource: ResourceDto | null }>({
    open: false,
    resource: null,
  });
  const [pendingDelete, setPendingDelete] = useState<ResourceDto | null>(null);

  const deleteResource = useDeleteResource(projectId ?? '');

  const rows = useMemo(() => {
    const data = projectQuery.data;
    if (!data) return [];

    return data.resources.map((resource) => {
      const assignedTasks = data.assignments
        .filter((assignment) => assignment.resourceId === resource.id)
        .map((assignment) => ({
          taskName: data.tasks.find((task) => task.id === assignment.taskId)?.name ?? 'Tugas',
          taskId: assignment.taskId,
          allocationPercent: assignment.allocationPercent,
        }));

      const analysisRow = analysisQuery.data?.resources.find((item) => item.resourceId === resource.id);
      const warnings = (analysisQuery.data?.overAllocations ?? []).filter(
        (warning) => warning.resourceId === resource.id,
      );

      return {
        resource,
        assignedTasks,
        totalCost: analysisRow?.totalCost ?? 0,
        overAllocated: analysisRow?.overAllocated ?? false,
        warnings,
      };
    });
  }, [projectQuery.data, analysisQuery.data]);

  if (projectQuery.isLoading) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <LoadingBlock label="Memuat anggota tim…" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <ErrorState message="Data tim tidak dapat dimuat." onRetry={() => void projectQuery.refetch()} />
      </div>
    );
  }

  const project = projectQuery.data.project;
  const overAllocatedCount = rows.filter((row) => row.overAllocated).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">Tim</h1>
          <p className="mt-1 text-sm text-ink-3">
            Anggota proyek {project.name}, alokasi tugas, dan biaya yang dihasilkan.
          </p>
        </div>
        <Button
          icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
          onClick={() => setDialog({ open: true, resource: null })}
        >
          Tambah anggota
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Anggota tim" value={String(rows.length)} icon={<Users className="h-4 w-4" aria-hidden="true" />} />
        <StatTile
          tone="brand"
          label="Total biaya proyek"
          value={formatCurrency(analysisQuery.data?.cost.total ?? 0)}
          hint="Dihitung dari tugas daun saja"
        />
        <StatTile
          tone={overAllocatedCount > 0 ? 'danger' : 'neutral'}
          label="Peringatan over-alokasi"
          value={String(overAllocatedCount)}
          hint={overAllocatedCount > 0 ? 'Total alokasi melewati 100% pada satu hari' : 'Beban kerja masih aman'}
        />
      </div>

      {overAllocatedCount > 0 ? (
        <div role="alert" className="rounded-md border border-warning/30 bg-warning-bg p-4">
          <p className="flex items-center gap-2 text-label font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Ada anggota dengan beban kerja lebih dari 100%
          </p>
          <ul className="mt-2 space-y-1 text-sm text-warning">
            {(analysisQuery.data?.overAllocations ?? []).slice(0, 6).map((warning) => (
              <li key={`${warning.resourceId}-${warning.date}`}>
                {warning.resourceName} mencapai {warning.totalPercent}% pada {formatDate(warning.date)}.
              </li>
            ))}
          </ul>
          {(analysisQuery.data?.overAllocations ?? []).length > 6 ? (
            <p className="mt-1 text-caption text-warning">
              Lihat rincian lengkapnya di halaman Analisis.
            </p>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="Belum ada anggota tim"
            description="Tambahkan anggota beserta peran dan gajinya, lalu alokasikan ke tugas di halaman Gantt."
            action={
              <Button onClick={() => setDialog({ open: true, resource: null })} icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>
                Tambah anggota
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ resource, assignedTasks, totalCost, overAllocated }) => (
            <Card key={resource.id} as="article">
              <CardHeader
                title={resource.name}
                description={`${resource.role} · ${resource.email}`}
                icon={<span className="text-label font-semibold">{initials(resource.name)}</span>}
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Ubah ${resource.name}`}
                      onClick={() => setDialog({ open: true, resource })}
                      icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                    >
                      <span className="sr-only">Ubah</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Hapus ${resource.name}`}
                      onClick={() => setPendingDelete(resource)}
                      icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                    >
                      <span className="sr-only">Hapus</span>
                    </Button>
                  </div>
                }
              />

              <dl className="grid grid-cols-2 gap-3 px-4 py-3">
                <div>
                  <dt className="text-caption uppercase tracking-wide text-ink-3">Gaji per bulan</dt>
                  <dd className="tabular text-label font-medium text-ink">{formatCurrency(resource.salary)}</dd>
                </div>
                <div>
                  <dt className="text-caption uppercase tracking-wide text-ink-3">Total biaya tugas</dt>
                  <dd className="tabular text-label font-medium text-ink">{formatCurrency(totalCost)}</dd>
                </div>
              </dl>

              <div className="border-t border-line px-4 py-3">
                <p className="text-caption uppercase tracking-wide text-ink-3">
                  Tugas yang dialokasikan ({assignedTasks.length})
                </p>
                {assignedTasks.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-3">Belum ada tugas yang dialokasikan.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {assignedTasks.map((task) => (
                      <li key={task.taskId}>
                        <Badge tone="brand">
                          {task.taskName} · {task.allocationPercent}%
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {overAllocated ? (
                <p className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-sm font-medium text-danger">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Beban kerja melebihi 100% pada beberapa hari kerja.
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {dialog.open ? (
        <ResourceDialog
          key={dialog.resource?.id ?? 'baru'}
          open={dialog.open}
          onClose={() => setDialog({ open: false, resource: null })}
          projectId={project.id}
          resource={dialog.resource}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus anggota tim?"
        message={`${pendingDelete?.name ?? ''} akan dihapus beserta seluruh alokasinya pada tugas.`}
        loading={deleteResource.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void deleteResource.mutateAsync(pendingDelete.id).then(() => setPendingDelete(null));
        }}
      />
    </div>
  );
}
