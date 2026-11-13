import { useMemo, type ReactNode } from 'react';
import { buildGraph } from '../lib/buildGraph';
import type { Commit } from '../lib/types';
import { GraphSvg } from './GraphView';

// newest first: two feature branches fork from main and merge back
const demoCommits: Commit[] = [
  ['c7', ['m2']],
  ['m2', ['c6', 'g2']],
  ['c6', ['c5']],
  ['g2', ['g1']],
  ['c5', ['m1']],
  ['m1', ['c4', 'f1b']],
  ['g1', ['c3']],
  ['f1b', ['f1a']],
  ['c4', ['c3']],
  ['f1a', ['c2']],
  ['c3', ['c2']],
  ['c2', ['c1']],
  ['c1', []],
].map(([sha, parents], i, all) => ({
  sha: sha as string,
  parents: parents as string[],
  date: all.length - i,
  message: '',
  author: '',
}));

// Only the two brand colors, in tints, on the forest slab.
const SLAB_COLORS = ['#DDD6B9', '#A9BFA0', '#C7BD8A', '#8FAE98'];

interface Props {
  examples: string[];
  onPick: (repo: string) => void;
  children: ReactNode;
}

export function Hero({ examples, onPick, children }: Props) {
  const graph = useMemo(() => buildGraph(demoCommits, { branches: [], tags: [] }), []);

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>See how a repo branches.</h1>
        <p className="hero-lede">
          Paste a public GitHub link to get every branch, merge, and tag as a graph you can read and click through.
          Nothing in the repo is ever changed.
        </p>
        {children}
        <div className="hero-examples">
          <span>Try</span>
          {examples.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => onPick(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <figure className="hero-slab">
        <GraphSvg graph={graph} start={0} end={graph.rows.length} surface="#3E5F44" colors={SLAB_COLORS} animate />
        <figcaption>Two feature branches fork from main and merge back.</figcaption>
      </figure>
    </section>
  );
}
