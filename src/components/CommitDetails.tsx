import type { GraphLabel } from '../lib/buildGraph';
import type { Commit } from '../lib/types';

interface Props {
  commit: Commit | null;
  labels: GraphLabel[];
  isShown: (sha: string) => boolean;
  onSelect: (sha: string) => void;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' });

export function CommitDetails({ commit, labels, isShown, onSelect }: Props) {
  if (!commit) {
    return (
      <aside className="details" aria-label="Commit details">
        <p className="details-empty">Select a commit to read its message, author, and parents.</p>
      </aside>
    );
  }

  const [title, ...rest] = commit.message.split('\n');
  const body = rest.join('\n').trim();

  return (
    <aside className="details" aria-label="Commit details">
      {labels.length > 0 && (
        <p className="details-refs">
          {labels.map((l) => (
            <span key={`${l.kind}:${l.name}`} className="details-ref">
              {l.kind === 'tag' ? `tag ${l.name}` : l.name}
            </span>
          ))}
        </p>
      )}
      <h2 className="details-title">{title}</h2>
      {body && <p className="details-body">{body}</p>}

      <dl className="details-meta">
        <dt>Author</dt>
        <dd>{commit.author}</dd>
        <dt>Date</dt>
        <dd>{commit.date ? dateTime.format(commit.date) : 'Unknown'}</dd>
        <dt>Commit</dt>
        <dd className="mono">{commit.sha}</dd>
        <dt>{commit.parents.length === 1 ? 'Parent' : 'Parents'}</dt>
        <dd>
          {commit.parents.length === 0 && 'None. This is a root commit.'}
          {commit.parents.map((p) =>
            isShown(p) ? (
              <button key={p} type="button" className="parent-link mono" onClick={() => onSelect(p)}>
                {p.slice(0, 10)}
              </button>
            ) : (
              <span key={p} className="mono parent-off" title="Not loaded or hidden">
                {p.slice(0, 10)}
              </span>
            ),
          )}
        </dd>
      </dl>

      {commit.url && (
        <a className="details-link" href={commit.url} target="_blank" rel="noreferrer">
          Open on GitHub
        </a>
      )}
    </aside>
  );
}
