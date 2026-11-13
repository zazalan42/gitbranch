import { describe, expect, it } from 'vitest';
import { parseRepoUrl } from './parseRepoUrl';

describe('parseRepoUrl', () => {
  it.each([
    ['https://github.com/octocat/Hello-World', 'octocat', 'Hello-World'],
    ['http://www.github.com/octocat/Hello-World/', 'octocat', 'Hello-World'],
    ['github.com/octocat/Hello-World.git', 'octocat', 'Hello-World'],
    ['octocat/Hello-World', 'octocat', 'Hello-World'],
    ['  https://github.com/vitejs/vite/tree/main/packages?tab=x  ', 'vitejs', 'vite'],
    ['https://github.com/user/my.repo_name', 'user', 'my.repo_name'],
  ])('parses %s', (input, owner, repo) => {
    expect(parseRepoUrl(input)).toEqual({ owner, repo });
  });

  it.each([
    '',
    'octocat',
    'https://gitlab.com/octocat/Hello-World',
    'https://github.com/octocat',
    'octo cat/repo',
    '-bad/repo',
    'owner/..',
  ])('rejects %j', (input) => {
    expect(parseRepoUrl(input)).toBeNull();
  });
});
