import { Link } from 'react-router-dom';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Reversi Arena home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="brand-wordmark">
        <strong>REVERSI</strong>
        <small>ARENA</small>
      </span>
    </Link>
  );
}
