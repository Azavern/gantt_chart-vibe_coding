import { createCalendar, parseWeekendDays, recomputeSchedule, type ProjectCalendar, type TaskDto } from '@gantt/shared';

import { prisma } from '../db';
import { getProjectTasks } from './snapshot';

/** Kalender proyek dari pengaturan akhir pekan dan daftar hari libur. */
export function buildCalendar(weekendDays: string, holidays: Array<{ date: string }>): ProjectCalendar {
  return createCalendar(
    parseWeekendDays(weekendDays),
    holidays.map((holiday) => holiday.date),
  );
}

/**
 * Menjalankan ulang mesin penjadwalan untuk satu proyek dan menyimpan hasilnya
 * (blueprint 6.6). Logika penjadwalan selalu berasal dari paket `shared`.
 */
export async function recomputeProject(projectId: string): Promise<TaskDto[]> {
  const [project, tasks, dependencies, holidays] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.task.findMany({ where: { projectId } }),
    prisma.dependency.findMany({ where: { projectId } }),
    prisma.holiday.findMany({ where: { projectId } }),
  ]);

  const calendar = buildCalendar(project.weekendDays, holidays);

  const scheduled = recomputeSchedule(
    tasks.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      position: task.position,
      durationDays: task.durationDays,
      startDate: task.startDate,
      progress: task.progress,
    })),
    dependencies.map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type === 'SS' ? 'SS' : 'FS',
      lagDays: dependency.lagDays,
    })),
    calendar,
  );

  await prisma.$transaction(
    scheduled.map((task) =>
      prisma.task.update({
        where: { id: task.id },
        data: {
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd,
          durationDays: task.durationDays,
          progress: task.progress,
        },
      }),
    ),
  );

  return getProjectTasks(projectId);
}
