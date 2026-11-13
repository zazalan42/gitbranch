import { useEffect, useRef, useState } from 'react';
import type { Graph, GraphEdge } from '../lib/buildGraph';
import { laneColor } from '../lib/palette';

export const ROW = 34;
export const LANE = 20;
export const PAD = 16;
const OVERSCAN = 8;

const laneX = (lane: number) => PAD + lane * LANE + LANE / 2;
const rowY = (row: number) => row * ROW + ROW / 2;
export const graphWidth = (laneCount: number) => PAD * 2 + Math.max(laneCount, 1) * LANE;

const curve = (x1: number, y1: number, x2: number, y2: number) =>
  x1 === x2 ? `L${x2} ${y2}` : `C${x1} ${y1 + ROW / 2} ${x2} ${y2 - ROW / 2} ${x2} ${y2}`;

function edgePath(e: GraphEdge): string {
  const x1 = laneX(e.fromLane);
  const y1 = rowY(e.fromRow);
  if (e.toRow === null) return `M${x1} ${y1} L${x1} ${y1 + ROW * 0.9}`;

  const x2 = laneX(e.toLane);
  const y2 = rowY(e.toRow);
  if (e.toRow === e.fromRow + 1) return `M${x1} ${y1} ${curve(x1, y1, x2, y2)}`;

  const xt = laneX(e.travelLane);
  const ya = rowY(e.fromRow + 1);
  const yb = rowY(e.toRow - 1);
  return `M${x1} ${y1} ${curve(x1, y1, xt, ya)} L${xt} ${yb} ${curve(xt, yb, x2, y2)}`;
}

interface GraphSvgProps {
  graph: Graph;
  start: number;
  end: number;
  /** Surface color, used to cut a gap around dots. */
  surface: string;
  colors?: string[];
  selectedSha?: string | null;
  animate?: boolean;
}

export function GraphSvg({ graph, start, end, surface, colors, selectedSha, animate }: GraphSvgProps) {
  const width = graphWidth(graph.laneCount);
  const pick = (i: number) => (colors ? colors[i % colors.length] : laneColor(i));
  const top = start * ROW;
  const height = Math.max(end - start, 1) * ROW;

  return (
    <svg
      className={animate ? 'graph-svg draw' : 'graph-svg'}
      width={width}
      height={height}
      viewBox={`0 ${top} ${width} ${height}`}
      aria-hidden="true"
    >
      {graph.edges.map((e, i) => {
        const last = e.toRow ?? e.fromRow + 1;
        if (last < start - 1 || e.fromRow > end + 1) return null;
        return (
          <path
            key={i}
            d={edgePath(e)}
            className={e.toRow === null ? 'edge stub' : 'edge'}
            stroke={pick(e.color)}
            pathLength={animate ? 1 : undefined}
            style={animate ? { animationDelay: `${e.fromRow * 70}ms` } : undefined}
          />
        );
      })}
      {graph.rows.slice(start, end).map((r) => {
        const merge = r.commit.parents.length > 1;
        const selected = r.commit.sha === selectedSha;
        return (
          <g
            key={r.commit.sha}
            className="dot"
            style={animate ? { animationDelay: `${r.row * 70 + 200}ms` } : undefined}
          >
            {selected && <circle cx={laneX(r.lane)} cy={rowY(r.row)} r={9} fill="none" stroke={pick(r.color)} strokeWidth={2} />}
            <circle
              cx={laneX(r.lane)}
              cy={rowY(r.row)}
              r={merge ? 5 : 5.5}
              fill={merge ? surface : pick(r.color)}
              stroke={merge ? pick(r.color) : surface}
              strokeWidth={merge ? 2.5 : 2}
            />
          </g>
        );
      })}
    </svg>
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

interface GraphViewProps {
  graph: Graph;
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

export function GraphView({ graph, selectedSha, onSelect }: GraphViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [graph]);

  const total = graph.rows.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const end = Math.min(total, Math.ceil((scrollTop + viewport) / ROW) + OVERSCAN);
  const left = graphWidth(graph.laneCount);

  return (
    <div className="graph-scroll" ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div className="graph-canvas" style={{ height: total * ROW }}>
        <div className="graph-svg-slot" style={{ top: start * ROW }}>
          <GraphSvg graph={graph} start={start} end={end} surface="var(--surface)" selectedSha={selectedSha} />
        </div>
        {graph.rows.slice(start, end).map((r) => (
          <button
            key={r.commit.sha}
            type="button"
            className="commit-row"
            aria-pressed={r.commit.sha === selectedSha}
            style={{ top: r.row * ROW, height: ROW, paddingLeft: left }}
            onClick={() => onSelect(r.commit.sha)}
          >
            <span className="commit-main">
              {r.labels.map((l) => (
                <span key={`${l.kind}:${l.name}`} className={`ref ref-${l.kind}`} style={{ background: laneColor(r.color) }}>
                  {l.name}
                </span>
              ))}
              <span className="commit-msg">{r.commit.message.split('\n')[0]}</span>
            </span>
            <span className="commit-author">{r.commit.author}</span>
            <span className="commit-date">{r.commit.date ? dateFormat.format(r.commit.date) : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
