import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  addDays,
  holidayCreateSchema,
  parseISODate,
  type HolidayCreateInput,
} from '@gantt/shared';

import { useAddHoliday, useDeleteHoliday, useUpdateCalendar } from '../api/mutations';
import { useProject } from '../api/queries';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { CheckboxField, TextField } from '../components/ui/Field';
import { ErrorState, LoadingBlock } from '../components/ui/States';
import { dayShort, formatDate, formatMonth, todayISO } from '../lib/format';

const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Grid kalender bulanan: 6 baris x 7 kolom berisi tanggal ISO atau null. */
function monthGrid(monthISODate: string): Array<string | null> {
  const first = parseISODate(`${monthISODate.slice(0, 7)}-01`);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const firstWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: Array<string | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push(iso);
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarPage() {
  const { projectId } = useParams();
  const projectQuery = useProject(projectId);
  const updateCalendar = useUpdateCalendar(projectId ?? '');
  const addHoliday = useAddHoliday(projectId ?? '');
  const deleteHoliday = useDeleteHoliday(projectId ?? '');

  const [monthCursor, setMonthCursor] = useState(() => `${todayISO().slice(0, 7)}-01`);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayCreateInput>({
    resolver: zodResolver(holidayCreateSchema),
    defaultValues: { date: todayISO(), name: '' },
  });

  const project = projectQuery.data?.project;
  const holidays = projectQuery.data?.holidays ?? [];
  const holidayDates = useMemo(() => new Set(holidays.map((holiday) => holiday.date)), [holidays]);
  const holidayNames = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.date, holiday.name])),
    [holidays],
  );

  const grid = useMemo(() => monthGrid(monthCursor), [monthCursor]);
  const today = todayISO();

  if (projectQuery.isLoading) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <LoadingBlock label="Memuat kalender proyek…" />
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="rounded-md border border-line bg-surface">
        <ErrorState message="Kalender proyek tidak dapat dimuat." onRetry={() => void projectQuery.refetch()} />
      </div>
    );
  }

  const weekendDays = project.weekendDays;

  const toggleWeekend = (day: number, checked: boolean): void => {
    const next = checked
      ? [...weekendDays, day].sort((a, b) => a - b)
      : weekendDays.filter((value) => value !== day);

    if (next.length === 7) return;
    updateCalendar.mutate({ weekendDays: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h1 font-bold tracking-tight text-ink">Kalender</h1>
        <p className="mt-1 text-sm text-ink-3">
          Atur akhir pekan dan hari libur proyek {project.name}. Durasi tugas hanya menghitung hari kerja,
          dan jadwal dihitung ulang otomatis.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Akhir pekan"
            description="Hari yang tidak dihitung sebagai hari kerja."
            icon={<CalendarOff className="h-4 w-4" aria-hidden="true" />}
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {WEEKDAY_LABELS.map((label, index) => (
              <CheckboxField
                key={label}
                label={label}
                checked={weekendDays.includes(index)}
                disabled={updateCalendar.isPending}
                onChange={(event) => toggleWeekend(index, event.target.checked)}
              />
            ))}
          </div>
          <p className="border-t border-line px-4 py-3 text-caption text-ink-3">
            Minimal satu hari harus tetap menjadi hari kerja. Perubahan langsung menyimpan dan menghitung
            ulang jadwal.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Hari libur proyek"
            description={`${holidays.length} hari libur terdaftar.`}
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          />
          <form
            className="flex flex-wrap items-end gap-2 border-b border-line p-4"
            onSubmit={handleSubmit(async (values) => {
              await addHoliday.mutateAsync(values);
              reset({ date: values.date, name: '' });
            })}
            noValidate
          >
            <TextField
              label="Tanggal"
              type="date"
              required
              containerClassName="w-40"
              error={errors.date?.message}
              {...register('date')}
            />
            <TextField
              label="Nama hari libur"
              required
              placeholder="Contoh: Hari Kemerdekaan"
              containerClassName="min-w-[180px] flex-1"
              error={errors.name?.message}
              {...register('name')}
            />
            <Button
              type="submit"
              loading={isSubmitting || addHoliday.isPending}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Tambah
            </Button>
          </form>

          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {holidays.length === 0 ? (
              <li className="px-4 py-4 text-sm text-ink-3">Belum ada hari libur khusus.</li>
            ) : (
              holidays.map((holiday) => (
                <li key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-label text-ink">{holiday.name}</p>
                    <p className="tabular text-caption text-ink-3">{formatDate(holiday.date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Hapus hari libur ${holiday.name}`}
                    onClick={() => deleteHoliday.mutate(holiday.id)}
                    icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  >
                    <span className="sr-only">Hapus</span>
                  </Button>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={formatMonth(monthCursor)}
          description="Tanggal yang diarsir adalah hari non-kerja menurut pengaturan di atas."
          action={
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Bulan sebelumnya"
                onClick={() => setMonthCursor(addDays(monthCursor, -1))}
                icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
              >
                <span className="sr-only">Sebelumnya</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMonthCursor(`${todayISO().slice(0, 7)}-01`)}
              >
                Bulan ini
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Bulan berikutnya"
                onClick={() => {
                  const date = parseISODate(monthCursor);
                  date.setUTCMonth(date.getUTCMonth() + 1);
                  setMonthCursor(date.toISOString().slice(0, 10));
                }}
                icon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
              >
                <span className="sr-only">Berikutnya</span>
              </Button>
            </div>
          }
        />

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="pb-1 text-caption font-semibold uppercase tracking-wide text-ink-3">
                {label.slice(0, 3)}
              </div>
            ))}

            {grid.map((date, index) => {
              if (!date) return <div key={`kosong-${index}`} className="h-16 rounded-sm bg-surface2/40" />;

              const weekday = parseISODate(date).getUTCDay();
              const isWeekend = weekendDays.includes(weekday);
              const isHoliday = holidayDates.has(date);
              const isToday = date === today;
              const nonWorking = isWeekend || isHoliday;

              return (
                <div
                  key={date}
                  aria-label={`${WEEKDAY_LABELS[weekday]} ${formatDate(date)}${isHoliday ? `, hari libur ${holidayNames.get(date)}` : isWeekend ? ', akhir pekan' : ''}`}
                  className={`flex h-16 flex-col items-start justify-start gap-1 rounded-sm border p-1.5 text-left ${
                    isHoliday
                      ? 'border-warning/40 bg-warning-bg'
                      : isWeekend
                        ? 'border-line bg-surface2'
                        : 'border-line bg-surface'
                  } ${isToday ? 'ring-2 ring-brand-600' : ''}`}
                >
                  <span className={`tabular text-label ${nonWorking ? 'text-ink-3' : 'font-medium text-ink'}`}>
                    {parseISODate(date).getUTCDate()}
                  </span>
                  <span className="text-caption text-ink-3">{dayShort(weekday)}</span>
                  {isHoliday ? (
                    <span className="line-clamp-1 text-caption font-medium text-warning">
                      {holidayNames.get(date)}
                    </span>
                  ) : isWeekend ? (
                    <span className="text-caption text-ink-3">Libur</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-caption text-ink-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-4 rounded-sm bg-surface2 ring-1 ring-line" aria-hidden="true" /> Akhir pekan
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-4 rounded-sm bg-warning-bg ring-1 ring-line" aria-hidden="true" /> Hari libur
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-4 rounded-sm ring-2 ring-brand-600" aria-hidden="true" /> Hari ini
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Badge tone="neutral">Akhir pekan: {weekendDays.map((day) => WEEKDAY_LABELS[day]).join(', ') || 'tidak ada'}</Badge>
          <Badge tone="info">{holidays.length} hari libur</Badge>
        </div>
      </Card>
    </div>
  );
}
