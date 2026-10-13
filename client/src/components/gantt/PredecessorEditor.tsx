import { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import {
  DEPENDENCY_TYPE_LABELS,
  type DependencyDto,
  type DependencyType,
  type TaskDto,
} from '@gantt/shared';

import { useAddDependency, useDeleteDependency, useUpdateDependency } from '../../api/mutations';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';

/**
 * Editor predecessor (blueprint 8.1): setiap baris berisi tugas, tipe FS/SS, dan jeda hari.
 * Hanya tugas daun yang boleh punya dependensi.
 */
export default function PredecessorEditor({
  projectId,
  task,
  tasks,
  dependencies,
}: {
  projectId: string;
  task: TaskDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
}) {
  const addDependency = useAddDependency(projectId);
  const updateDependency = useUpdateDependency(projectId);
  const deleteDependency = useDeleteDependency(projectId);

  const parentIds = new Set(tasks.map((candidate) => candidate.parentId).filter(Boolean) as string[]);
  const existing = dependencies.filter((dependency) => dependency.successorId === task.id);
  const usedPredesessorIds = new Set(existing.map((dependency) => dependency.predecessorId));

  const candidates = tasks.filter(
    (candidate) =>
      candidate.id !== task.id && !parentIds.has(candidate.id) && !usedPredesessorIds.has(candidate.id),
  );

  const [predecessorId, setPredecessorId] = useState('');
  const [type, setType] = useState<DependencyType>('FS');
  const [lag, setLag] = useState('0');

  const nameById = new Map(tasks.map((candidate) => [candidate.id, candidate.name]));

  const handleAdd = async (): Promise<void> => {
    if (!predecessorId) return;
    await addDependency.mutateAsync({
      taskId: task.id,
      predecessorId,
      type,
      lagDays: Number.isFinite(Number(lag)) ? Math.trunc(Number(lag)) : 0,
    });
    setPredecessorId('');
    setLag('0');
    setType('FS');
  };

  return (
    <section className="rounded-sm border border-line p-3">
      <header className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-brand-700" aria-hidden="true" />
        <h3 className="text-label font-semibold text-ink">Predecessor</h3>
      </header>
      <p className="mt-1 text-caption text-ink-3">
        FS: penerus mulai setelah predecessor selesai. SS: penerus mulai bersamaan (ditambah jeda).
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {existing.length === 0 ? (
          <li className="rounded-sm bg-surface2 px-3 py-2 text-sm text-ink-3">
            Belum ada predecessor untuk tugas ini.
          </li>
        ) : (
          existing.map((dependency) => (
            <li
              key={dependency.id}
              className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-2"
            >
              <span className="min-w-0 flex-1 truncate text-label text-ink" title={nameById.get(dependency.predecessorId)}>
                {nameById.get(dependency.predecessorId) ?? 'Tugas tidak ditemukan'}
              </span>

              <label className="text-caption text-ink-3">
                Tipe
                <select
                  aria-label={`Tipe dependensi dari ${nameById.get(dependency.predecessorId) ?? ''}`}
                  className="mt-0.5 block h-10 rounded-sm border border-line-input bg-surface px-2 text-label text-ink"
                  value={dependency.type}
                  onChange={(event) =>
                    updateDependency.mutate({
                      id: dependency.id,
                      type: event.target.value as DependencyType,
                    })
                  }
                >
                  <option value="FS">FS</option>
                  <option value="SS">SS</option>
                </select>
              </label>

              <label className="text-caption text-ink-3">
                Jeda (hari kerja)
                <input
                  type="number"
                  aria-label={`Jeda dependensi dari ${nameById.get(dependency.predecessorId) ?? ''}`}
                  className="tabular mt-0.5 block h-10 w-24 rounded-sm border border-line-input bg-surface px-2 text-label text-ink"
                  defaultValue={dependency.lagDays}
                  min={-365}
                  max={365}
                  onBlur={(event) => {
                    const value = Math.trunc(Number(event.target.value));
                    if (!Number.isFinite(value) || value === dependency.lagDays) return;
                    updateDependency.mutate({ id: dependency.id, lagDays: value });
                  }}
                />
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteDependency.mutate(dependency.id)}
                aria-label={`Hapus dependensi dari ${nameById.get(dependency.predecessorId) ?? ''}`}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              >
                <span className="sr-only">Hapus</span>
              </Button>
            </li>
          ))
        )}
      </ul>

      {candidates.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-sm bg-surface2 p-2">
          <SelectField
            label="Tambah predecessor"
            containerClassName="min-w-[180px] flex-1"
            value={predecessorId}
            onChange={(event) => setPredecessorId(event.target.value)}
          >
            <option value="">Pilih tugas…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Tipe"
            containerClassName="w-44"
            value={type}
            onChange={(event) => setType(event.target.value as DependencyType)}
          >
            {(['FS', 'SS'] as DependencyType[]).map((value) => (
              <option key={value} value={value}>
                {DEPENDENCY_TYPE_LABELS[value]}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Jeda"
            type="number"
            containerClassName="w-24"
            value={lag}
            min={-365}
            max={365}
            onChange={(event) => setLag(event.target.value)}
          />

          <Button
            onClick={() => void handleAdd()}
            disabled={!predecessorId}
            loading={addDependency.isPending}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Tambah
          </Button>
        </div>
      ) : null}
    </section>
  );
}
