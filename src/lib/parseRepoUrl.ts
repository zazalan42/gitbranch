export interface RepoRef {
  owner: string;
  repo: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]*)$/;
const REPO = /^[A-Za-z0-9._-]+$/;

/** Accepts https://github.com/o/r, github.com/o/r(.git), or o/r. Returns null for anything else. */
export function parseRepoUrl(input: string): RepoRef | null {
  let s = input.trim().split(/[?#]/)[0];
  if (!s) return null;

  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const parts = s.split('/').filter(Boolean);
  // GitHub owners can't contain dots, so a dotted first segment is a host.
  if (parts[0]?.includes('.')) {
    if (parts[0].toLowerCase() !== 'github.com') return null;
    parts.shift();
  }

  const owner = parts[0];
  const repo = parts[1]?.replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') return null;
  return { owner, repo };
}
