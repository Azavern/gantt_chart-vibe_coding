import { useMemo } from 'react';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  GanttChartSquare,
  LogOut,
  Users,
} from 'lucide-react';

import { useProject } from '../../api/queries';
import { useAuth } from '../../lib/auth';
import { Button } from '../ui/Button';

interface NavItem {
  to: string;
  label: string;
  icon: typeof BarChart3;
}

function navClass(isActive: boolean): string {
  return [
    'flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-label font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-2 hover:bg-surface2 hover:text-ink',
  ].join(' ');
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const match = useMatch('/projects/:projectId/*');
  const projectId = match?.params.projectId;
  const projectQuery = useProject(projectId);

  const items = useMemo<NavItem[]>(() => {
    const base = `/projects/${projectId}`;
    return [
      { to: `${base}/gantt`, label: 'Gantt', icon: GanttChartSquare },
      { to: `${base}/team`, label: 'Tim', icon: Users },
      { to: `${base}/calendar`, label: 'Kalender', icon: CalendarDays },
      { to: `${base}/analysis`, label: 'Analisis', icon: BarChart3 },
    ];
  }, [projectId]);

  const projectName = projectQuery.data?.project.name;

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-brand-700 to-brand-500 text-white">
              <GanttChartSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-label font-semibold leading-tight text-ink">
                {projectName ?? 'Manajemen Proyek Gantt'}
              </p>
              <p className="truncate text-caption text-ink-3">
                {projectName ? 'Gantt Chart · Tim · Kalender · Analisis' : 'Kelola proyek dan jadwalnya'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-label font-medium leading-tight text-ink">{user?.name}</p>
              <p className="text-caption text-ink-3">{user?.email}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
              onClick={logout}
            >
              <span className="hidden sm:inline">Keluar</span>
              <span className="sm:hidden">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-6 px-3 py-4 sm:px-6 sm:py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav aria-label="Navigasi utama" className="sticky top-20 flex flex-col gap-1">
            <NavLink to="/projects" className={({ isActive }) => navClass(isActive)} end>
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
              Daftar Proyek
            </NavLink>

            {projectId ? (
              <>
                <p className="px-3 pb-1 pt-4 text-caption font-semibold uppercase tracking-wide text-ink-3">
                  Proyek ini
                </p>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </>
            ) : null}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {projectId ? (
        <nav
          aria-label="Navigasi proyek"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            <NavLink
              to="/projects"
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-1 py-2 text-caption font-medium ${
                  isActive ? 'text-brand-700' : 'text-ink-3'
                }`
              }
            >
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
              Proyek
            </NavLink>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-1 py-2 text-caption font-medium ${
                    isActive ? 'text-brand-700' : 'text-ink-3'
                  }`
                }
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
