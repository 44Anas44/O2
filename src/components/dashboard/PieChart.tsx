import { useId, useMemo, useState } from 'react';
import type { DistributionSlice } from '../../utils/stats';
import { money, percent } from '../../utils/format';
import { Panel, PanelHeader } from '../ui/Primitives';
import { BRAND } from '../../brand';

const PALETTE = [
BRAND.brand[700],
BRAND.brand[500],
BRAND.brand[300],
BRAND.ink[900],
BRAND.ink[500],
BRAND.ink[300],
'#f59e0b',
'#fb923c'];


function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export type PieChartProps = {
  title: string;
  subtitle?: string;
  slices: DistributionSlice[];
  /** How to format the raw value: as currency or as a plain unit count. */
  valueFormat?: 'money' | 'unit';
  emptyLabel?: string;
};

export function PieChart({
  title,
  subtitle,
  slices,
  valueFormat = 'money',
  emptyLabel = 'Aucune donnée sur la période.'
}: PieChartProps) {
  const gradientId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const arcs = useMemo(() => {
    let cursor = 0;
    return slices.map((slice, index) => {
      const fraction = total > 0 ? slice.value / total : 0;
      const startAngle = cursor * 360;
      const endAngle = (cursor + fraction) * 360;
      cursor += fraction;
      return {
        ...slice,
        color: PALETTE[index % PALETTE.length],
        startAngle,
        endAngle,
        fraction
      };
    });
  }, [slices, total]);

  const formatValue = (value: number) =>
  valueFormat === 'money' ? money(value) : `${value} u`;

  return (
    <Panel>
      <PanelHeader title={title} subtitle={subtitle} />
      <div className="px-5 py-5">
        {total <= 0 ?
        <p className="text-sm text-ink-500">{emptyLabel}</p> :

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <svg
            viewBox="0 0 200 200"
            className="h-44 w-44 shrink-0"
            role="img"
            aria-label={title}>
            
              <defs>
                <filter id={`${gradientId}-shadow`}>
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
                </filter>
              </defs>
              <g filter={`url(#${gradientId}-shadow)`}>
                {arcs.length === 1 ?
              <circle cx="100" cy="100" r="90" fill={arcs[0].color} /> :

              arcs.map((arc, index) =>
              <path
                key={arc.label}
                d={arcPath(100, 100, 90, arc.startAngle, arc.endAngle)}
                fill={arc.color}
                stroke="white"
                strokeWidth={hovered === index ? 2 : 1}
                opacity={hovered === null || hovered === index ? 1 : 0.45}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                style={{ transition: 'opacity 150ms ease, stroke-width 150ms ease' }} />

              )}
              </g>
              <circle cx="100" cy="100" r="52" fill="white" />
              <text
              x="100"
              y="96"
              textAnchor="middle"
              className="fill-ink-900"
              style={{ fontSize: '13px', fontWeight: 600 }}>
              
                {valueFormat === 'money' ? money(total) : `${total} u`}
              </text>
              <text
              x="100"
              y="114"
              textAnchor="middle"
              className="fill-ink-500"
              style={{ fontSize: '10px' }}>
              
                Total
              </text>
            </svg>
            <ul className="flex w-full flex-col gap-2.5">
              {arcs.map((arc, index) =>
            <li
              key={arc.label}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150"
              style={{
                backgroundColor: hovered === index ? BRAND.ink[50] : 'transparent'
              }}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}>
              
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: arc.color }} />
                
                    <span className="truncate font-medium text-ink-800">
                      {arc.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-500">
                    {formatValue(arc.value)} · {percent(arc.fraction * 100)}
                  </span>
                </li>
            )}
            </ul>
          </div>
        }
      </div>
    </Panel>);

}
