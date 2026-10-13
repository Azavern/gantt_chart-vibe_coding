import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { PertEdge, PertNode } from '@gantt/shared';

import { Button } from '../ui/Button';

/**
 * Diagram PERT (blueprint 6.9): activity-on-node dengan kolom menurut kedalaman
 * jalur terpanjang. Node dan panah jalur kritis digambar merah.
 */

const NODE_W = 176;
const NODE_H = 92;
const GAP_X = 60;
const GAP_Y = 20;
const PADDING = 8;

function truncate(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function PertChart({ nodes, edges }: { nodes: PertNode[]; edges: PertEdge[] }) {
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(() => {
    const columns = new Map<number, PertNode[]>();
    for (const node of nodes) {
      const list = columns.get(node.column);
      if (list) list.push(node);
      else columns.set(node.column, [node]);
    }

    const positions = new Map<string, { x: number; y: number }>();
    let maxRows = 1;

    for (const [column, items] of columns) {
      items.sort((a, b) => a.es - b.es || a.name.localeCompare(b.name));
      maxRows = Math.max(maxRows, items.length);

      items.forEach((node, index) => {
        positions.set(node.taskId, {
          x: PADDING + column * (NODE_W + GAP_X),
          y: PADDING + index * (NODE_H + GAP_Y),
        });
      });
    }

    const columnCount = columns.size === 0 ? 1 : Math.max(...columns.keys()) + 1;

    return {
      positions,
      width: PADDING * 2 + columnCount * NODE_W + (columnCount - 1) * GAP_X,
      height: PADDING * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y,
    };
  }, [nodes]);

  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.taskId)), [nodes]);

  if (nodes.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-3">
        Belum ada tugas daun untuk digambar pada diagram PERT.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <span className="text-caption text-ink-3">Zoom {Math.round(zoom * 100)}%</span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Perkecil diagram"
          onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(2))))}
          icon={<Minus className="h-4 w-4" aria-hidden="true" />}
        >
          <span className="sr-only">Perkecil</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Perbesar diagram"
          onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(2))))}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          <span className="sr-only">Perbesar</span>
        </Button>
      </div>

      <div className="scroll-slim overflow-auto rounded-sm border border-line bg-surface2/60 p-1">
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="Diagram PERT jalur kritis"
        >
          <defs>
            <marker id="pert-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#94A3B8" />
            </marker>
            <marker id="pert-arrow-critical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#B91C1C" />
            </marker>
          </defs>

          {edges.map((edge) => {
            const from = layout.positions.get(edge.predecessorId);
            const to = layout.positions.get(edge.successorId);
            if (!from || !to || !nodeIds.has(edge.predecessorId) || !nodeIds.has(edge.successorId)) return null;

            const startX = from.x + NODE_W;
            const startY = from.y + NODE_H / 2;
            const endX = to.x;
            const endY = to.y + NODE_H / 2;
            const midX = startX + GAP_X / 2;
            const stroke = edge.critical ? '#B91C1C' : '#94A3B8';

            return (
              <g key={`${edge.predecessorId}-${edge.successorId}`}>
                <path
                  d={`M ${startX} ${startY} H ${midX} V ${endY} H ${endX - 8}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={edge.critical ? 2 : 1.25}
                  markerEnd={edge.critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
                />
                <title>{`Dependensi ${edge.type}${edge.lagDays ? ` lag ${edge.lagDays}` : ''}${edge.critical ? ' (kritis)' : ''}`}</title>
              </g>
            );
          })}

          {nodes.map((node) => {
            const position = layout.positions.get(node.taskId);
            if (!position) return null;

            const border = node.critical ? '#B91C1C' : '#CBD5E1';
            const headerBg = node.critical ? '#FEE2E2' : '#F1F5F9';
            const textColor = node.critical ? '#B91C1C' : '#0F172A';

            return (
              <g key={node.taskId}>
                <rect
                  x={position.x}
                  y={position.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill="#FFFFFF"
                  stroke={border}
                  strokeWidth={node.critical ? 2 : 1}
                />
                <path
                  d={`M ${position.x} ${position.y + 24} H ${position.x + NODE_W}`}
                  stroke={border}
                  strokeWidth={1}
                />
                <rect
                  x={position.x}
                  y={position.y}
                  width={NODE_W}
                  height={24}
                  rx={10}
                  fill={headerBg}
                />
                <rect
                  x={position.x}
                  y={position.y + 14}
                  width={NODE_W}
                  height={10}
                  fill={headerBg}
                />
                <path
                  d={`M ${position.x} ${position.y + 24} H ${position.x + NODE_W}`}
                  stroke={border}
                  strokeWidth={1}
                />

                <text x={position.x + 8} y={position.y + 16} fontSize={11} fontWeight={700} fill={textColor}>
                  {truncate(node.name)}
                </text>

                <text x={position.x + 8} y={position.y + 42} fontSize={11} fill="#475569">
                  {`Durasi ${node.durationDays} hari`}
                </text>
                <text x={position.x + 8} y={position.y + 58} fontSize={11} fill="#475569">
                  {`ES ${node.es} · EF ${node.ef}`}
                </text>
                <text x={position.x + 8} y={position.y + 74} fontSize={11} fill="#475569">
                  {`LS ${node.ls} · LF ${node.lf}`}
                </text>
                <text
                  x={position.x + NODE_W - 8}
                  y={position.y + 74}
                  fontSize={11}
                  fontWeight={600}
                  textAnchor="end"
                  fill={node.slack === 0 ? '#B91C1C' : '#0F766E'}
                >
                  {`slack ${node.slack}`}
                </text>
                {node.te !== null ? (
                  <text x={position.x + NODE_W - 8} y={position.y + 42} fontSize={11} textAnchor="end" fill="#1D4ED8">
                    {`te ${node.te.toFixed(1)}`}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
