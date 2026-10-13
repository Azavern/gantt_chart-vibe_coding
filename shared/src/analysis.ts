import type { OverAllocation, ResourceCostSummary } from './cost';
import type { PertResult } from './pert';

/**
 * Bentuk respons `GET /api/projects/:id/analysis` (blueprint 7 dan 8.4).
 * Diletakkan di paket `shared` agar server dan client memakai tipe yang sama.
 */

export interface AnalysisSummary {
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
  totalCost: number;
  criticalTaskCount: number;
  leafTaskCount: number;
}

export interface AnalysisCpmRow {
  taskId: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface AnalysisResourceRow {
  resourceId: string;
  name: string;
  role: string;
  salary: number;
  totalCost: number;
  taskCount: number;
  overAllocated: boolean;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  cpm: AnalysisCpmRow[];
  criticalPath: string[];
  pert: PertResult;
  cost: {
    total: number;
    byResource: ResourceCostSummary[];
  };
  resources: AnalysisResourceRow[];
  overAllocations: OverAllocation[];
}
