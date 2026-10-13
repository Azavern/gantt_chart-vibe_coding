import { serializeWeekendDays, type DependencyType, type Priority } from '@gantt/shared';
import bcrypt from 'bcryptjs';

import { prisma } from '../src/db';
import { recomputeProject } from '../src/services/recompute';

/**
 * Data contoh (blueprint bagian 9). Aman dijalankan berulang kali: proyek demo
 * lama dihapus lebih dulu lalu dibuat ulang dari definisi di bawah.
 */

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo12345';
const PROJECT_NAME = 'Pengembangan Aplikasi Mobile Toko Online';
const PROJECT_START = '2026-10-19';

interface ChildSeed {
  key: string;
  name: string;
  durationDays: number;
  priority: Priority;
  progress: number;
  optimisticDays?: number;
  pessimisticDays?: number;
}

interface GroupSeed {
  name: string;
  color: string;
  priority: Priority;
  children: ChildSeed[];
}

const GROUPS: GroupSeed[] = [
  {
    name: 'Perencanaan',
    color: '#0F766E',
    priority: 'HIGH',
    children: [
      { key: '1.1', name: 'Kickoff dan kebutuhan', durationDays: 3, priority: 'HIGH', progress: 100 },
      { key: '1.2', name: 'Penyusunan spesifikasi', durationDays: 4, priority: 'HIGH', progress: 60 },
    ],
  },
  {
    name: 'Desain',
    color: '#7C3AED',
    priority: 'MEDIUM',
    children: [
      { key: '2.1', name: 'Riset dan wireframe', durationDays: 5, priority: 'MEDIUM', progress: 0 },
      { key: '2.2', name: 'Desain UI high-fidelity', durationDays: 6, priority: 'MEDIUM', progress: 0 },
    ],
  },
  {
    name: 'Pengembangan',
    color: '#1D4ED8',
    priority: 'HIGH',
    children: [
      { key: '3.1', name: 'Rancang database dan API', durationDays: 5, priority: 'HIGH', progress: 0 },
      {
        key: '3.2',
        name: 'Implementasi backend',
        durationDays: 10,
        priority: 'HIGH',
        progress: 0,
        optimisticDays: 8,
        pessimisticDays: 15,
      },
      { key: '3.3', name: 'Implementasi frontend mobile', durationDays: 12, priority: 'HIGH', progress: 0 },
    ],
  },
  {
    name: 'Pengujian',
    color: '#B45309',
    priority: 'MEDIUM',
    children: [
      { key: '4.1', name: 'Skenario uji', durationDays: 3, priority: 'MEDIUM', progress: 0 },
      { key: '4.2', name: 'Integrasi dan uji sistem', durationDays: 6, priority: 'HIGH', progress: 0 },
      { key: '4.3', name: 'Perbaikan bug', durationDays: 4, priority: 'MEDIUM', progress: 0 },
    ],
  },
  {
    name: 'Peluncuran',
    color: '#15803D',
    priority: 'MEDIUM',
    children: [
      { key: '5.1', name: 'Persiapan rilis', durationDays: 2, priority: 'MEDIUM', progress: 0 },
      { key: '5.2', name: 'Rilis dan serah terima', durationDays: 1, priority: 'HIGH', progress: 0 },
    ],
  },
];

const DEPENDENCIES: Array<{ predecessor: string; successor: string; type: DependencyType; lagDays: number }> = [
  { predecessor: '1.1', successor: '1.2', type: 'FS', lagDays: 0 },
  { predecessor: '1.2', successor: '2.1', type: 'SS', lagDays: 2 },
  { predecessor: '2.1', successor: '2.2', type: 'FS', lagDays: 0 },
  { predecessor: '1.2', successor: '3.1', type: 'FS', lagDays: 0 },
  { predecessor: '3.1', successor: '3.2', type: 'FS', lagDays: 0 },
  { predecessor: '2.2', successor: '3.3', type: 'FS', lagDays: 0 },
  { predecessor: '3.2', successor: '3.3', type: 'SS', lagDays: 3 },
  { predecessor: '3.2', successor: '4.1', type: 'SS', lagDays: 4 },
  { predecessor: '3.2', successor: '4.2', type: 'FS', lagDays: 0 },
  { predecessor: '3.3', successor: '4.2', type: 'FS', lagDays: 0 },
  { predecessor: '4.2', successor: '4.3', type: 'FS', lagDays: 0 },
  { predecessor: '4.3', successor: '5.1', type: 'FS', lagDays: 1 },
  { predecessor: '5.1', successor: '5.2', type: 'FS', lagDays: 0 },
];

const ASSIGNMENTS: Array<{ task: string; resource: string; allocationPercent: number }> = [
  { task: '1.1', resource: 'andi', allocationPercent: 100 },
  { task: '1.2', resource: 'andi', allocationPercent: 100 },
  { task: '2.1', resource: 'citra', allocationPercent: 100 },
  { task: '2.2', resource: 'citra', allocationPercent: 100 },
  { task: '3.1', resource: 'budi', allocationPercent: 100 },
  { task: '3.2', resource: 'budi', allocationPercent: 100 },
  { task: '3.3', resource: 'budi', allocationPercent: 50 },
  { task: '3.3', resource: 'citra', allocationPercent: 50 },
  { task: '4.1', resource: 'dewi', allocationPercent: 100 },
  { task: '4.2', resource: 'dewi', allocationPercent: 100 },
  { task: '4.3', resource: 'budi', allocationPercent: 100 },
  { task: '5.1', resource: 'andi', allocationPercent: 100 },
  { task: '5.2', resource: 'andi', allocationPercent: 100 },
];

const RESOURCES = [
  { key: 'andi', name: 'Andi Pratama', email: 'andi.pratama@example.com', role: 'Project Manager', salary: 15_000_000 },
  { key: 'budi', name: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'Backend Developer', salary: 12_000_000 },
  { key: 'citra', name: 'Citra Lestari', email: 'citra.lestari@example.com', role: 'UI/UX Designer', salary: 10_000_000 },
  { key: 'dewi', name: 'Dewi Anggraini', email: 'dewi.anggraeni@example.com', role: 'QA Engineer', salary: 9_000_000 },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Pengguna Demo', passwordHash },
    create: { name: 'Pengguna Demo', email: DEMO_EMAIL, passwordHash },
  });

  // Idempoten: proyek demo lama dihapus beserta seluruh turunannya (cascade).
  await prisma.project.deleteMany({ where: { ownerId: user.id, name: PROJECT_NAME } });

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: PROJECT_NAME,
      description:
        'Proyek contoh aplikasi mobile toko online: perencanaan, desain, pengembangan, pengujian, sampai peluncuran.',
      startDate: PROJECT_START,
      weekendDays: serializeWeekendDays([0, 6]),
    },
  });

  await prisma.holiday.createMany({
    data: [
      { projectId: project.id, date: '2026-11-11', name: 'Libur internal (contoh)' },
      { projectId: project.id, date: '2026-12-25', name: 'Hari Raya Natal' },
    ],
  });

  const resourceIds = new Map<string, string>();
  for (const resource of RESOURCES) {
    const created = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: resource.name,
        email: resource.email,
        role: resource.role,
        salary: resource.salary,
      },
    });
    resourceIds.set(resource.key, created.id);
  }

  const taskIds = new Map<string, string>();

  for (const [groupIndex, group] of GROUPS.entries()) {
    const parent = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId: null,
        position: groupIndex + 1,
        name: group.name,
        description: null,
        durationDays: 1,
        startDate: PROJECT_START,
        scheduledStart: PROJECT_START,
        scheduledEnd: PROJECT_START,
        priority: group.priority,
        color: group.color,
        progress: 0,
      },
    });

    for (const [childIndex, child] of group.children.entries()) {
      const created = await prisma.task.create({
        data: {
          projectId: project.id,
          parentId: parent.id,
          position: childIndex + 1,
          name: child.name,
          description: null,
          durationDays: child.durationDays,
          startDate: PROJECT_START,
          scheduledStart: PROJECT_START,
          scheduledEnd: PROJECT_START,
          priority: child.priority,
          color: group.color,
          progress: child.progress,
          optimisticDays: child.optimisticDays ?? null,
          pessimisticDays: child.pessimisticDays ?? null,
        },
      });
      taskIds.set(child.key, created.id);
    }
  }

  for (const dependency of DEPENDENCIES) {
    const predecessorId = taskIds.get(dependency.predecessor);
    const successorId = taskIds.get(dependency.successor);
    if (!predecessorId || !successorId) {
      throw new Error(`Dependensi ${dependency.predecessor} -> ${dependency.successor} tidak lengkap.`);
    }

    await prisma.dependency.create({
      data: {
        projectId: project.id,
        predecessorId,
        successorId,
        type: dependency.type,
        lagDays: dependency.lagDays,
      },
    });
  }

  for (const assignment of ASSIGNMENTS) {
    const taskId = taskIds.get(assignment.task);
    const resourceId = resourceIds.get(assignment.resource);
    if (!taskId || !resourceId) {
      throw new Error(`Alokasi ${assignment.resource} pada ${assignment.task} tidak lengkap.`);
    }

    await prisma.assignment.create({
      data: { taskId, resourceId, allocationPercent: assignment.allocationPercent },
    });
  }

  const tasks = await recomputeProject(project.id);

  console.log('Seed selesai.');
  console.log(`- Akun demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`- Proyek: ${PROJECT_NAME} (${tasks.length} tugas, ${RESOURCES.length} anggota tim)`);
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
