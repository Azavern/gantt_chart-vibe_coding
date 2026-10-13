import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck2, GanttChartSquare, LogIn, Network, Users } from 'lucide-react';
import { loginSchema, type LoginInput } from '@gantt/shared';

import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../lib/auth';

const HIGHLIGHTS = [
  { icon: GanttChartSquare, text: 'Jadwal Gantt dengan durasi hari kerja' },
  { icon: Network, text: 'Predecessor FS/SS, lag, dan jalur kritis' },
  { icon: Users, text: 'Alokasi tim, biaya, dan peringatan beban kerja' },
  { icon: CalendarCheck2, text: 'Kalender akhir pekan dan hari libur' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      const target = (location.state as { from?: string } | null)?.from ?? '/projects';
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Tidak dapat masuk. Coba lagi.');
    }
  });

  return (
    <div className="grid min-h-full bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand-400/20 blur-2xl"
        />
        <div className="relative">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white/15">
            <GanttChartSquare className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-6 max-w-md text-3xl font-bold tracking-tight">
            Kelola jadwal proyek sampai jalur kritisnya.
          </h1>
          <p className="mt-3 max-w-md text-body text-brand-50">
            Aplikasi manajemen proyek berbasis Gantt Chart: tugas, dependensi, tim, kalender, dan
            analisis CPM/PERT dalam satu tempat.
          </p>
        </div>

        <ul className="relative mt-10 space-y-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-label text-brand-50">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-white/15">
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-gradient-to-br from-brand-700 to-brand-500 text-white">
              <GanttChartSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-h3 font-semibold text-ink">Manajemen Proyek Gantt</p>
          </div>

          <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
            <h2 className="text-h2 font-semibold text-ink">Masuk</h2>
            <p className="mt-1 text-sm text-ink-3">
              Gunakan email dan password akun Anda untuk membuka proyek.
            </p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="nama@perusahaan.com"
                required
                error={errors.email?.message}
                {...register('email')}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Minimal 8 karakter"
                required
                error={errors.password?.message}
                {...register('password')}
              />

              {formError ? (
                <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
                  {formError}
                </p>
              ) : null}

              <Button type="submit" size="lg" loading={isSubmitting} icon={<LogIn className="h-4 w-4" aria-hidden="true" />}>
                Masuk
              </Button>
            </form>

            <p className="mt-5 text-sm text-ink-2">
              Belum punya akun?{' '}
              <Link to="/register" className="font-medium text-brand-700 underline-offset-2 hover:underline">
                Daftar di sini
              </Link>
            </p>
          </div>

          <div className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-4">
            <p className="text-label font-medium text-brand-900">Akun demo</p>
            <p className="mt-1 text-sm text-brand-900/80">
              email <span className="font-medium">demo@example.com</span> · password{' '}
              <span className="font-medium">Demo12345</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setValue('email', 'demo@example.com');
                setValue('password', 'Demo12345');
              }}
            >
              Isi otomatis
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
