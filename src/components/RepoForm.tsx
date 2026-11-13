import type { FormEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  size: 'large' | 'compact';
  error?: string;
}

export function RepoForm({ value, onChange, onSubmit, busy, size, error }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit();
  };

  return (
    <form className={`repo-form repo-form-${size}`} onSubmit={submit}>
      <label className="sr-only" htmlFor="repo-url">
        GitHub repository link
      </label>
      <input
        id="repo-url"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="github.com/owner/repo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'repo-error' : undefined}
      />
      <button type="submit" disabled={busy}>
        {busy ? 'Loading' : 'Show graph'}
      </button>
      {error && (
        <p id="repo-error" className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
