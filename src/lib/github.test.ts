import { describe, expect, it } from 'vitest';
import { GitHubError, loadRepo } from './github';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

const apiCommit = (sha: string, parents: string[] = []) => ({
  sha,
  html_url: `https://github.com/o/r/commit/${sha}`,
  parents: parents.map((p) => ({ sha: p })),
  commit: { message: sha, author: { name: 'n', date: '2024-01-01T00:00:00Z' } },
});

function router(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    const path = url.replace('https://api.github.com', '');
    calls.push(path);
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) throw new Error(`unexpected ${path}`);
    return routes[key]();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const repo = { owner: 'o', repo: 'r' };

describe('loadRepo', () => {
  it('loads branches, tags and de-duplicated commits', async () => {
    const { fetchImpl } = router({
      '/repos/o/r/branches': () => json([{ name: 'dev', commit: { sha: 'd' } }, { name: 'main', commit: { sha: 'b' } }]),
      '/repos/o/r/tags': () => json([{ name: 'v1', commit: { sha: 'a' } }]),
      '/repos/o/r/commits?sha=b': () => json([apiCommit('b', ['a']), apiCommit('a')]),
      '/repos/o/r/commits?sha=d': () => json([apiCommit('d', ['a']), apiCommit('a')]),
      '/repos/o/r': () => json({ default_branch: 'main' }),
    });
    const data = await loadRepo(repo, { fetchImpl });
    expect(data.branches.map((b) => b.name)).toEqual(['main', 'dev']);
    expect(data.commits.map((x) => x.sha).sort()).toEqual(['a', 'b', 'd']);
    expect(data.tags).toEqual([{ name: 'v1', sha: 'a' }]);
    expect(data.truncated).toBe(false);
  });

  it('paginates up to the cap and reports truncation', async () => {
    let page = 0;
    const full = () => Array.from({ length: 100 }, (_, i) => apiCommit(`c${page * 100 + i}`));
    const { fetchImpl, calls } = router({
      '/repos/o/r/branches': () => json([{ name: 'main', commit: { sha: 'c0' } }]),
      '/repos/o/r/tags': () => json([]),
      '/repos/o/r/commits': () => {
        const body = full();
        page++;
        return json(body);
      },
      '/repos/o/r': () => json({ default_branch: 'main' }),
    });
    const data = await loadRepo(repo, { fetchImpl, commitsPerBranch: 200 });
    expect(calls.filter((c) => c.includes('/commits'))).toHaveLength(2);
    expect(data.truncated).toBe(true);
  });

  it('caps the number of branches', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ name: `b${i}`, commit: { sha: `s${i}` } }));
    const { fetchImpl } = router({
      '/repos/o/r/branches': () => json(many),
      '/repos/o/r/tags': () => json([]),
      '/repos/o/r/commits': () => json([]),
      '/repos/o/r': () => json({ default_branch: 'b0' }),
    });
    const data = await loadRepo(repo, { fetchImpl, maxBranches: 2 });
    expect(data.branches).toHaveLength(2);
    expect(data.branchCount).toBe(5);
    expect(data.branchesTruncated).toBe(true);
  });

  it('returns an empty result for an empty repository', async () => {
    const { fetchImpl } = router({
      '/repos/o/r/branches': () => json([{ name: 'main', commit: { sha: 'x' } }]),
      '/repos/o/r/tags': () => json([]),
      '/repos/o/r/commits': () => json({ message: 'Git Repository is empty.' }, { status: 409 }),
      '/repos/o/r': () => json({ default_branch: 'main' }),
    });
    const data = await loadRepo(repo, { fetchImpl });
    expect(data.commits).toEqual([]);
  });

  it('maps 404 to not-found', async () => {
    const { fetchImpl } = router({ '/repos/o/r': () => json({}, { status: 404 }) });
    await expect(loadRepo(repo, { fetchImpl })).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('maps an exhausted rate limit to rate-limit with a reset time', async () => {
    const { fetchImpl } = router({
      '/repos/o/r': () =>
        json({}, { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' } }),
    });
    const err = await loadRepo(repo, { fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(err.kind).toBe('rate-limit');
    expect(err.resetAt).toEqual(new Date(1700000000 * 1000));
  });

  it('maps a failed request to network', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(loadRepo(repo, { fetchImpl })).rejects.toMatchObject({ kind: 'network' });
  });
});
