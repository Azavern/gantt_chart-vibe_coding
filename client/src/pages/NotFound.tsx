import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-md border border-line bg-surface shadow-sm">
        <EmptyState
          icon={<Compass className="h-6 w-6" aria-hidden="true" />}
          title="Halaman tidak ditemukan"
          description="Alamat yang Anda buka tidak tersedia. Kembali ke daftar proyek untuk melanjutkan."
          action={
            <Link to="/projects">
              <Button variant="primary">Ke daftar proyek</Button>
            </Link>
          }
        />
        <div className="pb-4" />
      </div>
    </div>
  );
}
