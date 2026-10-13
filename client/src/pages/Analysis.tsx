import { useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, CircleDollarSign, Route, Timer, TriangleAlert } from 'lucide-react';

import { useAnalysis, useProject } from '../api/queries';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, StatTile } from '../components/ui/Card';
import { ErrorState, LoadingBlock } from '../components/ui/States';
import PertChart from '../components/pert/PertChart';
import { formatCurrency, formatDate, formatNumber } from '../lib/format';

export default function AnalysisPage() {
  const { projectId } = useParams();
  const projectQuery = useProject(projectId);
  const analysisQuery = useAnalysis(projectId);

  if (projectQuery.isLoading || analysisQuery.isLoading) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <LoadingBlock label="Menghitung analisis proyek…" />
      </div>
    );
  }

  if (projectQuery.isError || analysisQuery.isError || !analysisQuery.data) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <ErrorState
          message="Analisis proyek tidak dapat dimuat."
          onRetry={() => {
            void projectQuery.refetch();
            void analysisQuery.refetch();
          }}
        />
      </div>
    );
  }

  const analysis = analysisQuery.data;
  const { summary, cpm, criticalPath, pert, cost, resources, overAllocations } = analysis;
  const nameById = new Map(cpm.map((row) => [row.taskId, row.name]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">Analisis</h1>
          <p className="mt-1 text-sm text-ink-3">
            Critical path (CPM), jalur kritis, diagram PERT, dan biaya proyek.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void analysisQuery.refetch()}
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
        >
          Hitung ulang
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Mulai"
          value={summary.startDate ? formatDate(summary.startDate) : '—'}
          hint={summary.endDate ? `Selesai ${formatDate(summary.endDate)}` : 'Belum ada tugas daun'}
        />
        <StatTile
          label="Total hari kerja"
          value={summary.startDate ? `${formatNumber(summary.totalWorkingDays)} hari` : '—'}
          hint={`${summary.leafTaskCount} tugas daun`}
        />
        <StatTile
          tone="brand"
          label="Total biaya"
          value={formatCurrency(summary.totalCost)}
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
        />
        <StatTile
          label="Tugas kritis"
          value={`${summary.criticalTaskCount} dari ${summary.leafTaskCount}`}
          icon={<Route className="h-4 w-4" aria-hidden="true" />}
          hint="Float total sama dengan 0"
        />
        <StatTile
          tone={overAllocations.length > 0 ? 'danger' : 'neutral'}
          label="Peringatan beban kerja"
          value={`${overAllocations.length} hari`}
          icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
          hint={overAllocations.length > 0 ? 'Ada alokasi melebihi 100%' : 'Beban kerja aman'}
        />
      </div>

      <Card>
        <CardHeader
          title="Jalur kritis"
          description="Rangkaian tugas kritis yang terhubung, diurutkan menurut Early Start."
          icon={<Route className="h-4 w-4" aria-hidden="true" />}
        />
        <div className="p-4">
          {criticalPath.length === 0 ? (
            <p className="text-sm text-ink-3">Belum ada jalur kritis karena proyek belum punya tugas daun.</p>
          ) : (
            <ol className="flex flex-wrap items-center gap-2">
              {criticalPath.map((taskId, index) => (
                <li key={taskId} className="flex items-center gap-2">
                  {index > 0 ? (
                    <ArrowRight className="h-4 w-4 text-danger" aria-hidden="true" />
                  ) : null}
                  <span className="rounded-sm bg-danger-bg px-2.5 py-1 text-label font-medium text-danger">
                    {nameById.get(taskId) ?? taskId}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Tabel CPM"
          description="ES/EF = Early Start/Finish, LS/LF = Late Start/Finish dalam ordinal hari kerja."
          icon={<Timer className="h-4 w-4" aria-hidden="true" />}
        />
        {cpm.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-3">Belum ada tugas daun untuk dihitung.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <caption className="sr-only">Hasil perhitungan Critical Path Method per tugas daun</caption>
              <thead className="bg-surface2 text-caption uppercase tracking-wide text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Tugas</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Durasi</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">ES</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">EF</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">LS</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">LF</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Float</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cpm.map((row) => (
                  <tr key={row.taskId} className={row.critical ? 'bg-danger-bg/40' : undefined}>
                    <th scope="row" className="px-4 py-2 text-left text-label font-medium text-ink">
                      {row.name}
                    </th>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.durationDays}</td>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.es}</td>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.ef}</td>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.ls}</td>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.lf}</td>
                    <td className="tabular px-3 py-2 text-right text-label text-ink-2">{row.totalFloat}</td>
                    <td className="px-4 py-2">
                      {row.critical ? <Badge tone="danger">Kritis</Badge> : <Badge tone="neutral">Ada float</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Diagram PERT"
          description="Activity-on-node dengan ES, EF, LS, LF, dan slack. Node serta panah kritis berwarna merah."
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
        />
        <div className="p-4">
          <PertChart nodes={pert.nodes} edges={pert.edges} />

          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm bg-surface2 px-3 py-2">
              <dt className="text-caption uppercase tracking-wide text-ink-3">Estimasi jalur kritis (te)</dt>
              <dd className="tabular text-label font-medium text-ink">
                {pert.expectedDuration === null ? 'Tidak ada estimasi tiga titik' : `${pert.expectedDuration.toFixed(2)} hari`}
              </dd>
            </div>
            <div className="rounded-sm bg-surface2 px-3 py-2">
              <dt className="text-caption uppercase tracking-wide text-ink-3">Total variansi</dt>
              <dd className="tabular text-label font-medium text-ink">
                {pert.totalVariance === null ? '—' : pert.totalVariance.toFixed(3)}
              </dd>
            </div>
            <div className="rounded-sm bg-surface2 px-3 py-2">
              <dt className="text-caption uppercase tracking-wide text-ink-3">Simpangan baku</dt>
              <dd className="tabular text-label font-medium text-ink">
                {pert.standardDeviation === null ? '—' : `${pert.standardDeviation.toFixed(2)} hari`}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-caption text-ink-3">
            Estimasi tiga titik (optimistis, paling mungkin, pesimistis) hanya informasi tambahan dan tidak
            mengubah jadwal.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Biaya per anggota"
            description="Tarif harian = gaji bulanan / 22 hari kerja."
            icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
          />
          {resources.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-3">Belum ada anggota tim.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <caption className="sr-only">Biaya tugas per anggota tim</caption>
                <thead className="bg-surface2 text-caption uppercase tracking-wide text-ink-3">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Anggota</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Tugas</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Total biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {resources.map((resource) => (
                    <tr key={resource.resourceId}>
                      <th scope="row" className="px-4 py-2 text-left">
                        <span className="block text-label font-medium text-ink">{resource.name}</span>
                        <span className="block text-caption text-ink-3">{resource.role}</span>
                      </th>
                      <td className="tabular px-3 py-2 text-right text-label text-ink-2">{resource.taskCount}</td>
                      <td className="tabular px-4 py-2 text-right text-label font-medium text-ink">
                        {formatCurrency(resource.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <th scope="row" colSpan={2} className="px-4 py-2 text-left text-label font-semibold text-ink">
                      Total proyek
                    </th>
                    <td className="tabular px-4 py-2 text-right text-label font-semibold text-ink">
                      {formatCurrency(cost.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Beban kerja berlebih"
            description="Total alokasi seorang anggota melebihi 100% pada hari kerja yang sama."
            icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          />
          <div className="p-4">
            {overAllocations.length === 0 ? (
              <p className="text-sm text-ink-3">Tidak ada over-alokasi pada proyek ini.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {overAllocations.map((warning) => (
                  <li
                    key={`${warning.resourceId}-${warning.date}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-warning-bg px-3 py-2"
                  >
                    <span className="text-label font-medium text-warning">{warning.resourceName}</span>
                    <span className="tabular text-label text-warning">
                      {warning.totalPercent}% pada {formatDate(warning.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
