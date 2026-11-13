export interface Commit {
  sha: string;
  parents: string[];
  /** Author date, ms since epoch. */
  date: number;
  message: string;
  author: string;
  url?: string;
}

export interface Ref {
  name: string;
  sha: string;
}

export interface RepoData {
  owner: string;
  repo: string;
  defaultBranch: string;
  commits: Commit[];
  branches: Ref[];
  tags: Ref[];
  /** At least one branch has more history than the per-branch cap. */
  truncated: boolean;
  commitsPerBranch: number;
  /** Total branches GitHub returned vs. how many were loaded. */
  branchCount: number;
  branchesTruncated: boolean;
}
