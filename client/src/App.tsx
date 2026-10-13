import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import AppShell from './components/layout/AppShell';
import { Spinner } from './components/ui/Button';
import { useAuth } from './lib/auth';
import AnalysisPage from './pages/Analysis';
import CalendarPage from './pages/Calendar';
import GanttPage from './pages/Gantt';
import LoginPage from './pages/Login';
import NotFoundPage from './pages/NotFound';
import ProjectsPage from './pages/Projects';
import RegisterPage from './pages/Register';
import TeamPage from './pages/Team';

function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center gap-3 bg-canvas text-sm text-ink-3">
      <Spinner className="h-5 w-5 text-brand-600" />
      Memeriksa sesi…
    </div>
  );
}

function Protected({ children }: { children: ReactElement }) {
  const { user, isReady } = useAuth();

  if (!isReady) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ProjectRedirect() {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId}/gantt`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectRedirect />} />
        <Route path="/projects/:projectId/gantt" element={<GanttPage />} />
        <Route path="/projects/:projectId/team" element={<TeamPage />} />
        <Route path="/projects/:projectId/calendar" element={<CalendarPage />} />
        <Route path="/projects/:projectId/analysis" element={<AnalysisPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
