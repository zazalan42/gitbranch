import { describe, expect, it } from 'vitest';
import { buildGraph, reachableFrom } from './buildGraph';
import type { Commit } from './types';

let clock = 0;
const c = (sha: string, parents: string[] = [], date = ++clock): Commit => ({
  sha,
  parents,
  date,
  message: sha,
  author: 'a',
});
const none = { branches: [], tags: [] };
const lanes = (commits: Commit[]) =>
  Object.fromEntries(buildGraph(commits, none).rows.map((r) => [r.commit.sha, r.lane]));
const order = (commits: Commit[]) => buildGraph(commits, none).rows.map((r) => r.commit.sha);

describe('buildGraph', () => {
  it('returns an empty graph for no commits', () => {
    expect(buildGraph([], none)).toEqual({ rows: [], edges: [], laneCount: 0 });
  });

  it('keeps linear history in one lane, newest first', () => {
    const g = buildGraph([c('a'), c('b', ['a']), c('c', ['b'])], none);
    expect(g.rows.map((r) => r.commit.sha)).toEqual(['c', 'b', 'a']);
    expect(g.rows.every((r) => r.lane === 0)).toBe(true);
    expect(g.laneCount).toBe(1);
    expect(g.edges).toHaveLength(2);
    expect(g.edges.every((e) => e.toRow === e.fromRow + 1)).toBe(true);
  });

  it('puts a merged branch in its own lane and rejoins it', () => {
    clock = 0;
    const commits = [
      c('root'),
      c('f1', ['root']),
      c('m1', ['root']),
      c('merge', ['m1', 'f1']),
    ];
    const g = buildGraph(commits, none);
    expect(order(commits)).toEqual(['merge', 'm1', 'f1', 'root']);
    expect(lanes(commits)).toEqual({ merge: 0, m1: 0, f1: 1, root: 0 });
    expect(g.laneCount).toBe(2);

    const toRoot = g.edges.filter((e) => e.toRow === 3);
    expect(toRoot).toHaveLength(2);
    expect(toRoot.every((e) => e.toLane === 0)).toBe(true);
  });

  it('handles an octopus merge', () => {
    clock = 0;
    const commits = [c('r'), c('a', ['r']), c('b', ['r']), c('d', ['r']), c('m', ['r', 'a', 'b', 'd'])];
    const g = buildGraph(commits, none);
    expect(g.laneCount).toBe(4);
    expect(g.edges.filter((e) => e.fromRow === 0)).toHaveLength(4);
  });

  it('supports multiple roots', () => {
    clock = 0;
    const commits = [c('x'), c('y')];
    const g = buildGraph(commits, none);
    expect(g.rows).toHaveLength(2);
    expect(g.edges).toHaveLength(0);
  });

  it('draws a stub for parents that were not loaded', () => {
    const g = buildGraph([c('tip', ['missing'])], none);
    expect(g.edges).toEqual([
      { fromRow: 0, fromLane: 0, travelLane: 0, toRow: null, toLane: 0, color: 0 },
    ]);
  });

  it('orders children before parents even when dates disagree', () => {
    const commits = [c('old', [], 100), c('new', ['old'], 1)];
    expect(order(commits)).toEqual(['new', 'old']);
  });

  it('ignores duplicate commits and duplicate parents', () => {
    clock = 0;
    const a = c('a');
    const g = buildGraph([a, a, c('b', ['a', 'a'])], none);
    expect(g.rows).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
  });

  it('attaches branch and tag labels to loaded commits only', () => {
    clock = 0;
    const g = buildGraph([c('a'), c('b', ['a'])], {
      branches: [
        { name: 'main', sha: 'b' },
        { name: 'gone', sha: 'zzz' },
      ],
      tags: [{ name: 'v1', sha: 'a' }],
    });
    expect(g.rows[0].labels).toEqual([{ name: 'main', kind: 'branch' }]);
    expect(g.rows[1].labels).toEqual([{ name: 'v1', kind: 'tag' }]);
  });
});

describe('reachableFrom', () => {
  it('keeps only commits reachable from the given heads', () => {
    clock = 0;
    const commits = [c('r'), c('a', ['r']), c('b', ['r'])];
    expect(reachableFrom(commits, ['a']).map((x) => x.sha)).toEqual(['r', 'a']);
    expect(reachableFrom(commits, ['nope'])).toEqual([]);
  });
});
