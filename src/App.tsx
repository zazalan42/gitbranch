import { useEffect, useMemo, useRef, useState } from 'react';
import { CommitDetails } from './components/CommitDetails';
import { GraphView } from './components/GraphView';
import { Hero } from './components/Hero';
import { RepoForm } from './components/RepoForm';
import { buildGraph, reachableFrom, type GraphRow } from './lib/buildGraph';
import { GitHubError, loadRepo } from './lib/github';
import { parseRepoUrl, type RepoRef } from './lib/parseRepoUrl';
import type { RepoData } from './lib/types';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; repo: string; label: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: RepoData };

const EXAMPLES = ['octocat/Hello-World', 'sindresorhus/execa'];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describeError(err: unknown, repo: RepoRef): string {
  if (err instanceof GitHubError) {
    switch (err.kind) {
      case 'not-found':
        return `We couldn't find ${repo.owner}/${repo.repo}. Check the spelling. Private repos aren't supported.`;
      case 'rate-limit': {
        const when = err.resetAt?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `You've used GitHub's hourly limit for anonymous requests. ${when ? `Try again at ${when}.` : 'Try again in a while.'}`;
      }
      default:
        return err.message;
    }
  }
  return 'Something went wrong while loading the repo. Try again.';
}

export default function App() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const run = useRef(0);

  async function show(raw: string) {
    const repo = parseRepoUrl(raw);
    if (!repo) {
      setStatus({ kind: 'error', message: "That doesn't look like a GitHub repo link. Try github.com/owner/repo." });
      return;
    }

    const id = ++run.current;
    setSelected(null);
    setHidden(new Set());
    setStatus({ kind: 'loading', repo: `${repo.owner}/${repo.repo}`, label: 'Reading branches' });
    try {
      const data = await loadRepo(repo, {
        onProgress: (n) =>
          id === run.current &&
          setStatus((s) => (s.kind === 'loading' ? { ...s, label: `Loaded ${n} commits` } : s)),
      });
      if (id !== run.current) return;
      setStatus({ kind: 'ready', data });
      const url = new URL(window.location.href);
      url.searchParams.set('repo', `${data.owner}/${data.repo}`);
      window.history.replaceState(null, '', url);
    } catch (err) {
      if (id !== run.current) return;
      setStatus({ kind: 'error', message: describeError(err, repo) });
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('repo');
    if (fromUrl) {
      setInput(fromUrl);
      void show(fromUrl);
    }
  }, []);

  const data = status.kind === 'ready' ? status.data : null;

  const view = useMemo(() => {
    if (!data) return null;
    const branches = data.branches.filter((b) => !hidden.has(b.name));
    const commits = reachableFrom(data.commits, branches.map((b) => b.sha));
    const graph = buildGraph(commits, { branches, tags: data.tags });
    return { graph, byGsha: new Map<string, GraphRow>(graph.rows.map((r) => [r.commit.sha, r])) };
  }, [data, hidden]);

  const selectedRow = selected && view ? view.byGsha.get(selected) ?? null : null;
  const busy = status.kind === 'loading';
  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const pick = (repo: string) => {
    setInput(repo);
    void show(repo);
  };

  return (
    <div className={data ? 'app app-ready' : 'app'}>
      <header className="topbar">
        <a className="wordmark" href={window.location.pathname}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M7 3v18M7 12c0-4 10-1 10-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="7" cy="3.5" r="2.2" fill="currentColor" />
            <circle cx="7" cy="20.5" r="2.2" fill="currentColor" />
            <circle cx="17" cy="5" r="2.2" fill="currentColor" />
          </svg>
          gitbranch
        </a>
        {(data || busy) && (
          <RepoForm value={input} onChange={setInput} onSubmit={() => void show(input)} busy={busy} size="compact" />
        )}
      </header>

      {status.kind === 'loading' && (
        <div className="state" role="status">
          <p className="state-title">{status.repo}</p>
          <p>{status.label}</p>
        </div>
      )}

      {(status.kind === 'idle' || status.kind === 'error') && (
        <main className="landing">
          <Hero examples={EXAMPLES} onPick={pick}>
            <RepoForm
              value={input}
              onChange={setInput}
              onSubmit={() => void show(input)}
              busy={busy}
              size="large"
              error={status.kind === 'error' ? status.message : undefined}
            />
          </Hero>
        </main>
      )}

      {data && view && (
        <main className="workspace">
          <section className="graph-panel" aria-label={`Commit graph for ${data.owner}/${data.repo}`}>
            <div className="repo-head">
              <h1 className="repo-name">
                {data.owner}/{data.repo}
              </h1>
              <p className="repo-stats">
                <span>{plural(view.graph.rows.length, 'commit')}</span>
                <span>
                  {data.branches.length - hidden.size} of {plural(data.branches.length, 'branch', 'branches')}
                </span>
                <span>{plural(data.tags.length, 'tag')}</span>
              </p>
            </div>

            <ul className="branch-chips" aria-label="Branches to show">
              {data.branches.map((b) => (
                <li key={b.name}>
                  <button type="button" className="chip" aria-pressed={!hidden.has(b.name)} onClick={() => toggle(b.name)}>
                    {b.name}
                  </button>
                </li>
              ))}
              {hidden.size > 0 && (
                <li>
                  <button type="button" className="chip chip-plain" onClick={() => setHidden(new Set())}>
                    Show all
                  </button>
                </li>
              )}
            </ul>

            {(data.truncated || data.branchesTruncated) && (
              <p className="notice">
                {data.truncated && `Showing the latest ${data.commitsPerBranch} commits per branch. `}
                {data.branchesTruncated && `Showing ${data.branches.length} of ${data.branchCount} branches.`}
              </p>
            )}

            {view.graph.rows.length === 0 ? (
              <p className="empty">
                {data.commits.length === 0 ? 'This repo has no commits yet.' : 'No branches are selected. Pick at least one above.'}
              </p>
            ) : (
              <GraphView graph={view.graph} selectedSha={selectedRow ? selected : null} onSelect={setSelected} />
            )}
          </section>

          <CommitDetails
            commit={selectedRow?.commit ?? null}
            labels={selectedRow?.labels ?? []}
            isShown={(sha) => view.byGsha.has(sha)}
            onSelect={setSelected}
          />
        </main>
      )}
    </div>
  );
}
