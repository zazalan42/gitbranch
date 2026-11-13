import type { Commit, Ref } from './types';

export interface GraphLabel {
  name: string;
  kind: 'branch' | 'tag';
}

export interface GraphRow {
  commit: Commit;
  row: number;
  lane: number;
  color: number;
  labels: GraphLabel[];
}

export interface GraphEdge {
  fromRow: number;
  fromLane: number;
  /** Lane the line runs down between the two commits. */
  travelLane: number;
  /** null when the parent isn't loaded (history was cut off). */
  toRow: number | null;
  toLane: number;
  color: number;
}

export interface Graph {
  rows: GraphRow[];
  edges: GraphEdge[];
  laneCount: number;
}

interface Slot {
  sha: string;
  color: number;
  edges: GraphEdge[];
}

/** Children before parents; among ready commits, newest first. */
function topoOrder(commits: Commit[]): Commit[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const pending = new Map<string, number>(commits.map((c) => [c.sha, 0]));
  for (const c of commits) {
    for (const p of new Set(c.parents)) {
      if (pending.has(p)) pending.set(p, pending.get(p)! + 1);
    }
  }

  const ready = commits.filter((c) => pending.get(c.sha) === 0);
  const out: Commit[] = [];
  while (ready.length) {
    let best = 0;
    for (let i = 1; i < ready.length; i++) {
      if (ready[i].date > ready[best].date) best = i;
    }
    const [commit] = ready.splice(best, 1);
    out.push(commit);
    for (const p of new Set(commit.parents)) {
      const left = pending.get(p);
      if (left === undefined) continue;
      pending.set(p, left - 1);
      if (left - 1 === 0) ready.push(bySha.get(p)!);
    }
  }
  return out;
}

/** Commits reachable from the given head SHAs, in the original order. */
export function reachableFrom(commits: Commit[], heads: string[]): Commit[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const seen = new Set<string>();
  const stack = heads.filter((h) => bySha.has(h));
  while (stack.length) {
    const sha = stack.pop()!;
    if (seen.has(sha)) continue;
    seen.add(sha);
    for (const p of bySha.get(sha)!.parents) {
      if (bySha.has(p) && !seen.has(p)) stack.push(p);
    }
  }
  return commits.filter((c) => seen.has(c.sha));
}

export function buildGraph(
  input: Commit[],
  refs: { branches: Ref[]; tags: Ref[] },
): Graph {
  const commits = topoOrder([...new Map(input.map((c) => [c.sha, c])).values()]);
  const inSet = new Set(commits.map((c) => c.sha));

  const labels = new Map<string, GraphLabel[]>();
  const addLabel = (ref: Ref, kind: GraphLabel['kind']) => {
    if (!inSet.has(ref.sha)) return;
    const list = labels.get(ref.sha) ?? [];
    list.push({ name: ref.name, kind });
    labels.set(ref.sha, list);
  };
  refs.branches.forEach((b) => addLabel(b, 'branch'));
  refs.tags.forEach((t) => addLabel(t, 'tag'));

  // slots[i] is the commit the line in lane i is waiting to reach.
  const slots: (Slot | null)[] = [];
  let nextColor = 0;
  const edges: GraphEdge[] = [];
  const rows: GraphRow[] = [];

  const freeLane = () => {
    const i = slots.indexOf(null);
    if (i >= 0) return i;
    slots.push(null);
    return slots.length - 1;
  };

  commits.forEach((commit, row) => {
    const waiting: number[] = [];
    slots.forEach((s, i) => {
      if (s?.sha === commit.sha) waiting.push(i);
    });

    let lane: number;
    let color: number;
    if (waiting.length) {
      lane = waiting[0];
      color = slots[lane]!.color;
    } else {
      lane = freeLane();
      color = nextColor++;
    }

    // Every line waiting for this commit ends here.
    for (const i of waiting) {
      for (const e of slots[i]!.edges) {
        e.toRow = row;
        e.toLane = lane;
      }
      slots[i] = null;
    }

    [...new Set(commit.parents)].forEach((parent, idx) => {
      if (!inSet.has(parent)) {
        edges.push({ fromRow: row, fromLane: lane, travelLane: lane, toRow: null, toLane: lane, color });
        return;
      }

      let travel: number;
      let edgeColor: number;
      if (idx === 0) {
        travel = lane;
        edgeColor = color;
      } else {
        const existing = slots.findIndex((s) => s?.sha === parent);
        if (existing >= 0) {
          travel = existing;
          edgeColor = slots[existing]!.color;
        } else {
          travel = freeLane();
          edgeColor = nextColor++;
        }
      }

      const edge: GraphEdge = {
        fromRow: row,
        fromLane: lane,
        travelLane: travel,
        toRow: null,
        toLane: travel,
        color: edgeColor,
      };
      edges.push(edge);
      const slot = slots[travel];
      if (slot) slot.edges.push(edge);
      else slots[travel] = { sha: parent, color: edgeColor, edges: [edge] };
    });

    rows.push({ commit, row, lane, color, labels: labels.get(commit.sha) ?? [] });
  });

  let maxLane = 0;
  for (const r of rows) maxLane = Math.max(maxLane, r.lane);
  for (const e of edges) maxLane = Math.max(maxLane, e.travelLane, e.toLane);
  return { rows, edges, laneCount: rows.length ? maxLane + 1 : 0 };
}
