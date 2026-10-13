import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type {
  AssignmentCreateInput,
  AssignmentDto,
  CalendarUpdateInput,
  DependencyCreateInput,
  DependencyDto,
  DependencyUpdateInput,
  HolidayCreateInput,
  HolidayDto,
  ProjectCreateInput,
  ProjectDto,
  ProjectSnapshot,
  ProjectUpdateInput,
  ResourceCreateInput,
  ResourceDto,
  ResourceUpdateInput,
  TaskCreateInput,
  TaskDto,
  TaskMoveInput,
  TaskUpdateInput,
} from '@gantt/shared';

import { useToast } from '../components/ui/Toast';
import { ApiError, apiRequest } from './client';
import { queryKeys } from './queries';

type ProjectId = string;

export interface MutationOptions {
  /** Pesan toast setelah berhasil; `null` untuk tidak menampilkan apa pun. */
  successMessage?: string | null;
}

/** Menyimpan tugas terbaru ke cache snapshot dan menyegarkan analisis. */
function useApplyTasks() {
  const queryClient = useQueryClient();

  return (projectId: ProjectId, tasks: TaskDto[]): void => {
    queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
      current ? { ...current, tasks } : current,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
  };
}

/** Menampilkan pesan error server dalam bahasa Indonesia. */
function useErrorHandler() {
  const toast = useToast();

  return (error: ApiError): void => {
    toast.error(error.message);
  };
}

function projectCacheWriter<K extends keyof ProjectSnapshot>(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: ProjectId,
  key: K,
) {
  return (value: ProjectSnapshot[K]): void => {
    queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
      current ? { ...current, [key]: value } : current,
    );
  };
}

/* --- Proyek -------------------------------------------------------------- */

export function useCreateProject(): UseMutationResult<ProjectDto, ApiError, ProjectCreateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();

  return useMutation<ProjectDto, ApiError, ProjectCreateInput>({
    mutationFn: async (input) =>
      (
        await apiRequest<{ project: ProjectDto }>('/projects', { method: 'POST', body: input })
      ).project,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError,
  });
}

export function useUpdateProject(
  projectId: ProjectId,
  options: MutationOptions = {},
): UseMutationResult<{ project: ProjectDto; tasks: TaskDto[] }, ApiError, ProjectUpdateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation<{ project: ProjectDto; tasks: TaskDto[] }, ApiError, ProjectUpdateInput>({
    mutationFn: (input) =>
      apiRequest<{ project: ProjectDto; tasks: TaskDto[] }>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
        current ? { ...current, project: data.project, tasks: data.tasks } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      if (options.successMessage !== null) toast.success(options.successMessage ?? 'Perubahan disimpan.');
    },
    onError,
  });
}

export function useDeleteProject(): UseMutationResult<void, ApiError, string> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();

  return useMutation<void, ApiError, string>({
    mutationFn: async (projectId) => {
      await apiRequest<void>(`/projects/${projectId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError,
  });
}

/* --- Tugas --------------------------------------------------------------- */

export function useCreateTask(projectId: ProjectId): UseMutationResult<
  { taskId: string; tasks: TaskDto[] },
  ApiError,
  TaskCreateInput
> {
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: TaskCreateInput) =>
      apiRequest<{ taskId: string; tasks: TaskDto[] }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      applyTasks(projectId, data.tasks);
      toast.success('Tugas ditambahkan.');
    },
    onError,
  });
}

export function useUpdateTask(
  projectId: ProjectId,
  options: MutationOptions = {},
): UseMutationResult<TaskDto[], ApiError, { id: string } & TaskUpdateInput> {
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation<TaskDto[], ApiError, { id: string } & TaskUpdateInput>({
    mutationFn: async ({ id, ...body }) =>
      (await apiRequest<{ tasks: TaskDto[] }>(`/tasks/${id}`, { method: 'PATCH', body })).tasks,
    onSuccess: (tasks) => {
      applyTasks(projectId, tasks);
      if (options.successMessage !== null) toast.success(options.successMessage ?? 'Tugas diperbarui.');
    },
    onError,
  });
}

export function useDeleteTask(projectId: ProjectId): UseMutationResult<TaskDto[], ApiError, string> {
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation<TaskDto[], ApiError, string>({
    mutationFn: async (taskId) =>
      (await apiRequest<{ tasks: TaskDto[] }>(`/tasks/${taskId}`, { method: 'DELETE' })).tasks,
    onSuccess: (tasks) => {
      applyTasks(projectId, tasks);
      toast.success('Tugas dihapus.');
    },
    onError,
  });
}

export function useMoveTask(projectId: ProjectId): UseMutationResult<TaskDto[], ApiError, { id: string } & TaskMoveInput> {
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();

  return useMutation<TaskDto[], ApiError, { id: string } & TaskMoveInput>({
    mutationFn: async ({ id, ...body }) =>
      (await apiRequest<{ tasks: TaskDto[] }>(`/tasks/${id}/move`, { method: 'POST', body })).tasks,
    onSuccess: (tasks) => applyTasks(projectId, tasks),
    onError,
  });
}

/* --- Dependensi ---------------------------------------------------------- */

export function useAddDependency(
  projectId: ProjectId,
): UseMutationResult<{ tasks: TaskDto[]; dependencies: DependencyDto[] }, ApiError, { taskId: string } & DependencyCreateInput> {
  const applyTasks = useApplyTasks();
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeDependencies = projectCacheWriter(queryClient, projectId, 'dependencies');

  return useMutation({
    mutationFn: ({ taskId, ...body }) =>
      apiRequest<{ tasks: TaskDto[]; dependencies: DependencyDto[] }>(
        `/tasks/${taskId}/dependencies`,
        { method: 'POST', body },
      ),
    onSuccess: (data) => {
      applyTasks(projectId, data.tasks);
      writeDependencies(data.dependencies);
      toast.success('Predecessor ditambahkan.');
    },
    onError,
  });
}

export function useUpdateDependency(
  projectId: ProjectId,
): UseMutationResult<{ tasks: TaskDto[]; dependencies: DependencyDto[] }, ApiError, { id: string } & DependencyUpdateInput> {
  const applyTasks = useApplyTasks();
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const writeDependencies = projectCacheWriter(queryClient, projectId, 'dependencies');

  return useMutation({
    mutationFn: ({ id, ...body }) =>
      apiRequest<{ tasks: TaskDto[]; dependencies: DependencyDto[] }>(`/dependencies/${id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => {
      applyTasks(projectId, data.tasks);
      writeDependencies(data.dependencies);
    },
    onError,
  });
}

export function useDeleteDependency(
  projectId: ProjectId,
): UseMutationResult<{ tasks: TaskDto[]; dependencies: DependencyDto[] }, ApiError, string> {
  const applyTasks = useApplyTasks();
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeDependencies = projectCacheWriter(queryClient, projectId, 'dependencies');

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ tasks: TaskDto[]; dependencies: DependencyDto[] }>(`/dependencies/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      applyTasks(projectId, data.tasks);
      writeDependencies(data.dependencies);
      toast.success('Dependensi dihapus.');
    },
    onError,
  });
}

/* --- Alokasi ------------------------------------------------------------- */

export function useAddAssignment(
  projectId: ProjectId,
): UseMutationResult<AssignmentDto[], ApiError, { taskId: string } & AssignmentCreateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeAssignments = projectCacheWriter(queryClient, projectId, 'assignments');

  return useMutation({
    mutationFn: async ({ taskId, ...body }) =>
      (
        await apiRequest<{ assignments: AssignmentDto[] }>(`/tasks/${taskId}/assignments`, {
          method: 'POST',
          body,
        })
      ).assignments,
    onSuccess: (assignments) => {
      writeAssignments(assignments);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Anggota dialokasikan.');
    },
    onError,
  });
}

export function useUpdateAssignment(
  projectId: ProjectId,
): UseMutationResult<AssignmentDto[], ApiError, { id: string; allocationPercent: number }> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const writeAssignments = projectCacheWriter(queryClient, projectId, 'assignments');

  return useMutation({
    mutationFn: async ({ id, allocationPercent }) =>
      (
        await apiRequest<{ assignments: AssignmentDto[] }>(`/assignments/${id}`, {
          method: 'PATCH',
          body: { allocationPercent },
        })
      ).assignments,
    onSuccess: (assignments) => {
      writeAssignments(assignments);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
    },
    onError,
  });
}

export function useDeleteAssignment(
  projectId: ProjectId,
): UseMutationResult<AssignmentDto[], ApiError, string> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeAssignments = projectCacheWriter(queryClient, projectId, 'assignments');

  return useMutation({
    mutationFn: async (id: string) =>
      (
        await apiRequest<{ assignments: AssignmentDto[] }>(`/assignments/${id}`, {
          method: 'DELETE',
        })
      ).assignments,
    onSuccess: (assignments) => {
      writeAssignments(assignments);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Alokasi dihapus.');
    },
    onError,
  });
}

/* --- Anggota tim --------------------------------------------------------- */

export function useCreateResource(
  projectId: ProjectId,
): UseMutationResult<ResourceDto, ApiError, ResourceCreateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation({
    mutationFn: async (input: ResourceCreateInput) =>
      (
        await apiRequest<{ resource: ResourceDto }>(`/projects/${projectId}/resources`, {
          method: 'POST',
          body: input,
        })
      ).resource,
    onSuccess: (resource) => {
      queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
        current
          ? { ...current, resources: [...current.resources, resource].sort((a, b) => a.name.localeCompare(b.name)) }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Anggota tim ditambahkan.');
    },
    onError,
  });
}

export function useUpdateResource(
  projectId: ProjectId,
): UseMutationResult<ResourceDto, ApiError, { id: string } & ResourceUpdateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ id, ...body }) =>
      (
        await apiRequest<{ resource: ResourceDto }>(`/resources/${id}`, { method: 'PATCH', body })
      ).resource,
    onSuccess: (resource) => {
      queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
        current
          ? { ...current, resources: current.resources.map((item) => (item.id === resource.id ? resource : item)) }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Data anggota diperbarui.');
    },
    onError,
  });
}

export function useDeleteResource(
  projectId: ProjectId,
): UseMutationResult<{ resources: ResourceDto[]; assignments: AssignmentDto[] }, ApiError, string> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeResources = projectCacheWriter(queryClient, projectId, 'resources');
  const writeAssignments = projectCacheWriter(queryClient, projectId, 'assignments');

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ resources: ResourceDto[]; assignments: AssignmentDto[] }>(`/resources/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      writeResources(data.resources);
      writeAssignments(data.assignments);
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Anggota tim dihapus.');
    },
    onError,
  });
}

/* --- Kalender ------------------------------------------------------------ */

export function useUpdateCalendar(
  projectId: ProjectId,
): UseMutationResult<{ project: ProjectDto; tasks: TaskDto[] }, ApiError, CalendarUpdateInput> {
  const queryClient = useQueryClient();
  const onError = useErrorHandler();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: CalendarUpdateInput) =>
      apiRequest<{ project: ProjectDto; tasks: TaskDto[] }>(`/projects/${projectId}/calendar`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<ProjectSnapshot>(queryKeys.project(projectId), (current) =>
        current ? { ...current, project: data.project, tasks: data.tasks } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.analysis(projectId) });
      toast.success('Jadwal diperbarui.');
    },
    onError,
  });
}

export function useAddHoliday(
  projectId: ProjectId,
): UseMutationResult<{ holidays: HolidayDto[]; tasks: TaskDto[] }, ApiError, HolidayCreateInput> {
  const queryClient = useQueryClient();
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeHolidays = projectCacheWriter(queryClient, projectId, 'holidays');

  return useMutation({
    mutationFn: (input: HolidayCreateInput) =>
      apiRequest<{ holidays: HolidayDto[]; tasks: TaskDto[] }>(`/projects/${projectId}/holidays`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      writeHolidays(data.holidays);
      applyTasks(projectId, data.tasks);
      toast.success('Jadwal diperbarui.');
    },
    onError,
  });
}

export function useDeleteHoliday(
  projectId: ProjectId,
): UseMutationResult<{ holidays: HolidayDto[]; tasks: TaskDto[] }, ApiError, string> {
  const queryClient = useQueryClient();
  const applyTasks = useApplyTasks();
  const onError = useErrorHandler();
  const toast = useToast();
  const writeHolidays = projectCacheWriter(queryClient, projectId, 'holidays');

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ holidays: HolidayDto[]; tasks: TaskDto[] }>(`/holidays/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data) => {
      writeHolidays(data.holidays);
      applyTasks(projectId, data.tasks);
      toast.success('Jadwal diperbarui.');
    },
    onError,
  });
}
