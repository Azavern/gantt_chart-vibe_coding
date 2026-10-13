import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { GanttChartSquare, UserPlus } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@gantt/shared';

import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../lib/auth';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(values.name, values.email, values.password);
      navigate('/projects', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Pendaftaran gagal. Coba lagi.');
    }
  });

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-gradient-to-br from-brand-700 to-brand-500 text-white">
            <GanttChartSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-h3 font-semibold text-ink">Manajemen Proyek Gantt</p>
        </div>

        <div className="rounded-md border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-h2 font-semibold text-ink">Buat akun</h1>
          <p className="mt-1 text-sm text-ink-3">
            Akun dipakai untuk menyimpan proyek, tim, dan jadwal Anda di database.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <TextField
              label="Nama lengkap"
              autoComplete="name"
              placeholder="Nama Anda"
              required
              error={errors.name?.message}
              {...register('name')}
            />
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
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              required
              hint="Minimal 8 karakter."
              error={errors.password?.message}
              {...register('password')}
            />

            {formError ? (
              <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
            >
              Daftar
            </Button>
          </form>

          <p className="mt-5 text-sm text-ink-2">
            Sudah punya akun?{' '}
            <Link to="/login" className="font-medium text-brand-700 underline-offset-2 hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
