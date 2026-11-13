import type { RepoRef } from './parseRepoUrl';
import type { Commit, Ref, RepoData } from './types';

export type GitHubErrorKind = 'not-found' | 'rate-limit' | 'network' | 'empty' | 'other';

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    public resetAt?: Date,
  ) {
    super(message);
  }
}

export interface LoadOptions {
  commitsPerBranch?: number;
  maxBranches?: number;
  onProgress?: (commitCount: number) => void;
  fetchImpl?: typeof fetch;
}

interface ApiRef {
  name: string;
  commit: { sha: string };
}

interface ApiCommit {
  sha: string;
  html_url?: string;
  parents: { sha: string }[];
  commit: { message: string; author: { name: string; date: string } | null };
}

const API = 'https://api.github.com';
const PER_PAGE = 100;
const CONCURRENCY = 4;

async function getJson<T>(f: typeof fetch, path: string): Promise<T> {
  let res: Response;
  try {
    res = await f(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    throw new GitHubError('network', 'Could not reach GitHub. Check your connection and try again.');
  }
  if (res.ok) return (await res.json()) as T;

  if (res.status === 404) throw new GitHubError('not-found', 'Repository not found.');
  if (res.status === 409) throw new GitHubError('empty', 'Repository is empty.');
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    throw new GitHubError(
      'rate-limit',
      'GitHub rate limit reached.',
      Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : undefined,
    );
  }
  throw new GitHubError('other', `GitHub returned an error (${res.status}).`);
}

const toCommit = (c: ApiCommit): Commit => ({
  sha: c.sha,
  parents: c.parents.map((p) => p.sha),
  date: Date.parse(c.commit.author?.date ?? '') || 0,
  message: c.commit.message,
  author: c.commit.author?.name ?? 'Unknown',
  url: c.html_url,
});

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(lanes);
}

export async function loadRepo(repo: RepoRef, opts: LoadOptions = {}): Promise<RepoData> {
  const f = opts.fetchImpl ?? fetch;
  const commitsPerBranch = opts.commitsPerBranch ?? 300;
  const maxBranches = opts.maxBranches ?? 30;
  const base = `/repos/${repo.owner}/${repo.repo}`;

  const info = await getJson<{ default_branch: string }>(f, base);
  const [branchesRaw, tagsRaw] = await Promise.all([
    getJson<ApiRef[]>(f, `${base}/branches?per_page=${PER_PAGE}`),
    getJson<ApiRef[]>(f, `${base}/tags?per_page=${PER_PAGE}`),
  ]);

  const all: Ref[] = branchesRaw.map((b) => ({ name: b.name, sha: b.commit.sha }));
  all.sort((a, b) => Number(b.name === info.default_branch) - Number(a.name === info.default_branch));
  const branches = all.slice(0, maxBranches);
  const tags: Ref[] = tagsRaw.map((t) => ({ name: t.name, sha: t.commit.sha }));

  const seen = new Map<string, Commit>();
  let truncated = false;

  // Stops when the cap is reached, history ends, or a whole page was already seen
  // (the default branch loads first, so other branches usually stop after one page).
  async function loadBranch(branch: Ref) {
    let collected = 0;
    for (let page = 1; collected < commitsPerBranch; page++) {
      let items: ApiCommit[];
      try {
        items = await getJson<ApiCommit[]>(f, `${base}/commits?sha=${encodeURIComponent(branch.sha)}&per_page=${PER_PAGE}&page=${page}`);
      } catch (err) {
        if (err instanceof GitHubError && err.kind === 'empty') return;
        throw err;
      }
      let fresh = 0;
      for (const item of items) {
        if (!seen.has(item.sha)) {
          seen.set(item.sha, toCommit(item));
          fresh++;
        }
      }
      collected += items.length;
      opts.onProgress?.(seen.size);
      if (items.length < PER_PAGE) return;
      if (fresh === 0) return;
    }
    truncated = true;
  }

  if (branches.length) {
    await loadBranch(branches[0]);
    await runPool(branches.slice(1), CONCURRENCY, loadBranch);
  }

  return {
    owner: repo.owner,
    repo: repo.repo,
    defaultBranch: info.default_branch,
    commits: [...seen.values()],
    branches,
    tags,
    truncated,
    commitsPerBranch,
    branchCount: all.length,
    branchesTruncated: all.length > branches.length,
  };
}
