import { useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import type { AssignmentDto, ResourceDto, TaskDto } from '@gantt/shared';

import { formatCurrency } from '../../lib/format';
import { useAddAssignment, useDeleteAssignment, useUpdateAssignment } from '../../api/mutations';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';

/**
 * Editor penanggung jawab (blueprint 8.1): resource dan persentase alokasi.
 * Biaya tugas dihitung server memakai tarif harian = gaji / 22.
 */
export default function AssignmentEditor({
  projectId,
  task,
  resources,
  assignments,
}: {
  projectId: string;
  task: TaskDto;
  resources: ResourceDto[];
  assignments: AssignmentDto[];
}) {
  const addAssignment = useAddAssignment(projectId);
  const updateAssignment = useUpdateAssignment(projectId);
  const deleteAssignment = useDeleteAssignment(projectId);

  const existing = assignments.filter((assignment) => assignment.taskId === task.id);
  const usedResourceIds = new Set(existing.map((assignment) => assignment.resourceId));
  const candidates = resources.filter((resource) => !usedResourceIds.has(resource.id));

  const [resourceId, setResourceId] = useState('');
  const [percent, setPercent] = useState('100');

  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

  const dailyCost = (resource: ResourceDto | undefined, allocationPercent: number): number => {
    if (!resource) return 0;
    return (resource.salary / 22) * task.durationDays * (allocationPercent / 100);
  };

  return (
    <section className="rounded-sm border border-line p-3">
      <header className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-brand-700" aria-hidden="true" />
        <h3 className="text-label font-semibold text-ink">Penanggung jawab</h3>
      </header>
      <p className="mt-1 text-caption text-ink-3">
        Alokasi menentukan beban kerja dan biaya tugas. Total di atas 100% pada hari yang sama memunculkan
        peringatan di halaman Tim.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {existing.length === 0 ? (
          <li className="rounded-sm bg-surface2 px-3 py-2 text-sm text-ink-3">
            Belum ada anggota yang dialokasikan.
          </li>
        ) : (
          existing.map((assignment) => {
            const resource = resourceById.get(assignment.resourceId);
            return (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-2 rounded-sm border border-line bg-surface p-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label text-ink">
                    {resource?.name ?? 'Anggota tidak ditemukan'}
                  </span>
                  <span className="block truncate text-caption text-ink-3">
                    {resource?.role ?? '—'} · biaya {formatCurrency(dailyCost(resource, assignment.allocationPercent))}
                  </span>
                </span>

                <label className="text-caption text-ink-3">
                  Alokasi (%)
                  <input
                    type="number"
                    aria-label={`Alokasi ${resource?.name ?? ''}`}
                    className="tabular mt-0.5 block h-10 w-24 rounded-sm border border-line-input bg-surface px-2 text-label text-ink"
                    defaultValue={assignment.allocationPercent}
                    min={1}
                    max={100}
                    onBlur={(event) => {
                      const value = Math.trunc(Number(event.target.value));
                      if (!Number.isFinite(value) || value === assignment.allocationPercent) return;
                      if (value < 1 || value > 100) return;
                      updateAssignment.mutate({ id: assignment.id, allocationPercent: value });
                    }}
                  />
                </label>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAssignment.mutate(assignment.id)}
                  aria-label={`Hapus alokasi ${resource?.name ?? ''}`}
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                >
                  <span className="sr-only">Hapus</span>
                </Button>
              </li>
            );
          })
        )}
      </ul>

      {resources.length === 0 ? (
        <p className="mt-3 rounded-sm bg-warning-bg px-3 py-2 text-sm text-warning">
          Belum ada anggota tim. Tambahkan anggota di halaman Tim sebelum mengalokasikan tugas.
        </p>
      ) : candidates.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-sm bg-surface2 p-2">
          <SelectField
            label="Tambah anggota"
            containerClassName="min-w-[180px] flex-1"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">Pilih anggota…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} — {candidate.role}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Alokasi (%)"
            type="number"
            containerClassName="w-28"
            value={percent}
            min={1}
            max={100}
            onChange={(event) => setPercent(event.target.value)}
          />

          <Button
            disabled={!resourceId}
            loading={addAssignment.isPending}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              const value = Math.trunc(Number(percent));
              void addAssignment
                .mutateAsync({
                  taskId: task.id,
                  resourceId,
                  allocationPercent: Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : 100,
                })
                .then(() => {
                  setResourceId('');
                  setPercent('100');
                });
            }}
          >
            Alokasikan
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-caption text-ink-3">Semua anggota tim sudah dialokasikan pada tugas ini.</p>
      )}
    </section>
  );
}
