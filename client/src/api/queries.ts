import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { AnalysisResult, ProjectSnapshot, ProjectSummaryDto } from '@gantt/shared';

import { apiRequest } from './client';

/** Kunci cache terpusat agar invalidasi selalu konsisten. */
export const queryKeys = {
  projects: ['projects'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  analysis: (projectId: string) => ['analysis', projectId] as const,
};

export function useProjects(): UseQueryResult<ProjectSummaryDto[]> {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => (await apiRequest<{ projects: ProjectSummaryDto[] }>('/projects')).projects,
  });
}

export function useProject(projectId: string | undefined): UseQueryResult<ProjectSnapshot> {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => apiRequest<ProjectSnapshot>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useAnalysis(
  projectId: string | undefined,
  enabled = true,
): UseQueryResult<AnalysisResult> {
  return useQuery({
    queryKey: queryKeys.analysis(projectId ?? ''),
    queryFn: () => apiRequest<AnalysisResult>(`/projects/${projectId}/analysis`),
    enabled: Boolean(projectId) && enabled,
  });
}
