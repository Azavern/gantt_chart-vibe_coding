/**
 * Tipe data bersama (blueprint bagian 5). Tanggal selalu string ISO `YYYY-MM-DD`
 * dan diproses sebagai tanggal UTC murni.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type DependencyType = 'FS' | 'SS';

export const PRIORITIES: readonly Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const DEPENDENCY_TYPES: readonly DependencyType[] = ['FS', 'SS'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Finish to Start (FS)',
  SS: 'Start to Start (SS)',
};

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  startDate: string;
  /** Daftar angka hari, 0 = Minggu sampai 6 = Sabtu. Disimpan di DB sebagai "0,6". */
  weekendDays: number[];
  createdAt: string;
}

/** Ringkasan proyek untuk halaman daftar proyek. */
export interface ProjectSummaryDto extends ProjectDto {
  taskCount: number;
  resourceCount: number;
}

export interface HolidayDto {
  id: string;
  projectId: string;
  date: string;
  name: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  parentId: string | null;
  position: number;
  name: string;
  description: string | null;
  durationDays: number;
  /** Batas mulai paling awal yang diisi pengguna. */
  startDate: string;
  /** Hasil hitung mesin penjadwalan. */
  scheduledStart: string;
  scheduledEnd: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface DependencyDto {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ResourceDto {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: string;
  /** Gaji per bulan dalam rupiah. */
  salary: number;
}

export interface AssignmentDto {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface ProjectSnapshot {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}
