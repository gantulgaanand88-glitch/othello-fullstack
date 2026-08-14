import { Link } from 'react-router-dom';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Othello Arena home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="brand-wordmark">
        <strong>OTHELLO</strong>
        <small>ARENA</small>
      </span>
    </Link>
  );
}
