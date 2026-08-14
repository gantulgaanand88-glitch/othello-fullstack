import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArenaSocket, type ConnectionState } from './api/ArenaSocket';
import { LobbySocket } from './api/LobbySocket';
import type { GameSnapshot } from './api/protocol';
import { AppShell } from './components/AppShell';
import { CanvasBoard } from './components/CanvasBoard';
import { createOpeningState, playMove, score, squareToNotation } from './game/engine';
import type { ArenaGameState, Player } from './game/types';

const leaderboard = [
  { rank: 1, name: 'KaitoFlips', country: 'JP', rating: 2418, form: '+18', record: '311–42–18' },
  { rank: 2, name: 'MiraCorner', country: 'FR', rating: 2389, form: '+7', record: '284–51–22' },
  { rank: 3, name: 'EightByEight', country: 'IN', rating: 2356, form: '+24', record: '198–31–9' },
  { rank: 4, name: 'QuietTempo', country: 'US', rating: 2312, form: '−4', record: '403–88–36' },
  { rank: 5, name: 'EdgeTheory', country: 'BR', rating: 2297, form: '+11', record: '176–39–14' },
];

function fromSnapshot(snapshot: GameSnapshot, previous: ArenaGameState): ArenaGameState {
  const history = snapshot.last_move && !previous.history.some((move) => move.ply === snapshot.last_move?.ply)
    ? [...previous.history, {
      ply: snapshot.last_move.ply,
      player: snapshot.last_move.player,
      square: snapshot.last_move.square,
      notation: squareToNotation(snapshot.last_move.square),
      flipped: snapshot.last_move.flipped,
    }]
    : previous.history;
  return {
    board: snapshot.board,
    turn: snapshot.turn,
    legalMoves: snapshot.legal_moves,
    winner: snapshot.winner,
    status: snapshot.winner ? 'finished' : 'playing',
    history,
    lastMove: snapshot.last_move?.square ?? null,
    blackMs: snapshot.clock.black_ms,
    whiteMs: snapshot.clock.white_ms,
  };
}

function App() {
  const [game, setGame] = useState<ArenaGameState>(() => createOpeningState());
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const socketRef = useRef<ArenaSocket | null>(null);
  const liveClockTickRef = useRef(Date.now());
  const location = useLocation();
  const liveGameId = location.pathname === '/game'
    ? new URLSearchParams(location.search).get('id')
    : null;

  useEffect(() => {
    if (!liveGameId) {
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('idle');
      return;
    }
    const socket = new ArenaSocket(liveGameId, {
      onState: setConnectionState,
      onSnapshot: (snapshot) => {
        liveClockTickRef.current = Date.now();
        setGame((current) => fromSnapshot(snapshot, current));
      },
      onError: (message) => console.warn(`[arena realtime] ${message}`),
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [liveGameId]);

  useEffect(() => {
    if (!liveGameId) return;
    liveClockTickRef.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.max(0, now - liveClockTickRef.current);
      liveClockTickRef.current = now;
      setGame((current) => {
        if (current.status !== 'playing') return current;
        return current.turn === 'black'
          ? { ...current, blackMs: Math.max(0, current.blackMs - elapsed) }
          : { ...current, whiteMs: Math.max(0, current.whiteMs - elapsed) };
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [liveGameId]);

  const makeMove = useCallback((square: number) => {
    if (liveGameId) {
      socketRef.current?.move(square);
      return;
    }
    setGame((current) => playMove(current, square));
  }, [liveGameId]);

  const resetGame = useCallback(() => setGame(createOpeningState()), []);

  useEffect(() => {
    window.render_game_to_text = () => {
      const currentScore = score(game.board);
      return JSON.stringify({
        coordinateSystem: 'origin top-left; x/columns increase right; y/rows increase down; square = y * 8 + x',
        mode: game.status,
        turn: game.turn,
        legalMoves: game.legalMoves.map((square) => ({
          square,
          x: square % 8,
          y: Math.floor(square / 8),
        })),
        board: game.board.map((piece, square) => piece ? { square, piece } : null).filter(Boolean),
        score: currentScore,
        clocksMs: { black: game.blackMs, white: game.whiteMs },
        lastMove: game.lastMove,
        winner: game.winner,
      });
    };

    window.advanceTime = (milliseconds: number) => {
      const elapsed = Math.max(0, Math.floor(milliseconds));
      setGame((current) => {
        if (current.status !== 'playing') return current;
        const remaining = Math.max(0, (current.turn === 'black' ? current.blackMs : current.whiteMs) - elapsed);
        if (remaining === 0) {
          return {
            ...current,
            blackMs: current.turn === 'black' ? 0 : current.blackMs,
            whiteMs: current.turn === 'white' ? 0 : current.whiteMs,
            status: 'finished',
            legalMoves: [],
            winner: current.turn === 'black' ? 'white' : 'black',
          };
        }
        return current.turn === 'black'
          ? { ...current, blackMs: remaining }
          : { ...current, whiteMs: remaining };
      });
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, [game]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage game={game} onMove={makeMove} />} />
        <Route path="/play" element={<PlayPage onStart={resetGame} />} />
        <Route path="/game" element={<GamePage game={game} onMove={makeMove} onReset={resetGame} connectionState={connectionState} onDraw={() => socketRef.current?.offerDraw()} onResign={() => socketRef.current?.resign()} />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

function LandingPage({ game, onMove }: { game: ArenaGameState; onMove: (square: number) => void }) {
  return (
    <>
      <section className="hero section-grid">
        <div className="hero-copy">
          <p className="eyebrow"><span /> The global Othello community</p>
          <h1>Every move<br />changes <em>everything.</em></h1>
          <p className="hero-lede">
            Fast games. Fair matchmaking. Deep analysis. The modern home for players who see the board differently.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" id="start-btn" to="/play">Play a game <Arrow /></Link>
            <Link className="text-link" to="/watch">Watch live <span>↗</span></Link>
          </div>
          <div className="hero-proof" aria-label="Platform statistics">
            <div><strong>2,418</strong><span>players online</span></div>
            <div><strong>183</strong><span>games in play</span></div>
            <div><strong>46ms</strong><span>median move relay</span></div>
          </div>
        </div>
        <div className="hero-board-wrap">
          <div className="board-orbit orbit-one" />
          <div className="board-orbit orbit-two" />
          <div className="floating-tag tag-live"><i /> LIVE BOARD</div>
          <div className="floating-tag tag-turn">YOUR MOVE <strong>04:52</strong></div>
          <CanvasBoard game={game} onMove={onMove} compact id="hero-board" />
          <div className="hero-matchup">
            <PlayerAvatar tone="light" initials="KC" />
            <div><strong>KaitoFlips</strong><span>2418 · Grandmaster</span></div>
            <b>18</b><span className="versus">—</span><b>22</b>
            <div className="align-right"><strong>MiraCorner</strong><span>2389 · Grandmaster</span></div>
            <PlayerAvatar tone="dark" initials="MC" />
          </div>
        </div>
      </section>

      <section className="ticker" aria-label="Live platform activity">
        <div><span className="live-dot" /> LIVE</div>
        <p><strong>World Blitz Series</strong> · Round 6 begins in 12:48</p>
        <p><strong>Ranked</strong> · QuietTempo defeated GreenDiagonal +12</p>
        <Link to="/watch">Open broadcast <Arrow /></Link>
      </section>

      <section className="platform-intro section-pad">
        <div className="section-heading">
          <p className="eyebrow">Made for mastery</p>
          <h2>A serious arena.<br /><em>Zero friction.</em></h2>
        </div>
        <p className="section-lede">
          From your first corner to the championship table. Thoughtful tools, instant games, and a community built around better play.
        </p>
        <div className="feature-grid">
          <Feature index="01" title="Instant pairing" body="Find the right opponent in seconds. Rating-aware matching expands smoothly without compromising fairness." />
          <Feature index="02" title="Authoritative play" body="Every move is verified server-side. Reconnect protection, exact clocks, and immutable game records." />
          <Feature index="03" title="Learn the position" body="Replay move by move, inspect turning points, and build the pattern recognition that wins close games." />
        </div>
      </section>

      <section className="rank-preview section-pad">
        <div className="section-heading row-heading">
          <div><p className="eyebrow">The leaderboard</p><h2>Players to beat.</h2></div>
          <Link className="text-link" to="/rankings">Full rankings <Arrow /></Link>
        </div>
        <LeaderboardTable compact />
      </section>

      <section className="cta-band section-pad">
        <div>
          <p className="eyebrow light">The board is ready</p>
          <h2>Find your next<br /><em>great game.</em></h2>
        </div>
        <Link className="button button-acid" to="/play">Enter the arena <Arrow /></Link>
      </section>
    </>
  );
}

function PlayPage({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate();
  const [speed, setSpeed] = useState<'blitz' | 'rapid' | 'classic'>('rapid');
  const [tab, setTab] = useState<'online' | 'computer'>('online');
  const [matchStatus, setMatchStatus] = useState('Rated · Server clock · Reconnect protected');
  const [roomCode, setRoomCode] = useState('');
  const lobbyRef = useRef<LobbySocket | null>(null);
  const realtimeEnabled = import.meta.env.VITE_ENABLE_REALTIME === 'true';

  useEffect(() => () => lobbyRef.current?.close(), []);

  const lobby = () => {
    if (lobbyRef.current) return lobbyRef.current;
    const socket = new LobbySocket({
      onState: (state) => {
        if (state === 'connecting') setMatchStatus('Connecting to the nearest arena…');
        if (state === 'reconnecting') setMatchStatus('Connection interrupted. Rejoining…');
      },
      onMessage: (message) => {
        if (message.type === 'queue_joined') setMatchStatus('Searching the ranked pool…');
        if (message.type === 'room_created') {
          setRoomCode(message.payload.code);
          setMatchStatus(`Room ${message.payload.code} is ready to share.`);
        }
        if (message.type === 'match_found') {
          onStart();
          navigate(`/game?id=${encodeURIComponent(message.payload.game_id)}`);
        }
      },
      onError: setMatchStatus,
    });
    lobbyRef.current = socket;
    socket.connect();
    return socket;
  };

  const start = () => {
    if (realtimeEnabled) {
      const socket = lobby();
      if (tab === 'computer') socket.startBot(6, 'black');
      else socket.joinQueue('ranked');
      return;
    }
    onStart();
    navigate('/game');
  };

  const createRoom = () => {
    if (!realtimeEnabled) return start();
    lobby().createRoom();
  };

  const joinRoom = () => {
    if (!realtimeEnabled) return start();
    if (roomCode.trim()) lobby().joinRoom(roomCode);
  };

  return (
    <section className="page play-page section-pad">
      <header className="page-header">
        <div><p className="eyebrow">Match room</p><h1>Choose your game.</h1></div>
        <p>Play rated, challenge a friend, or sharpen an idea against one of ten computer levels.</p>
      </header>

      <div className="segmented" role="tablist" aria-label="Game opponent">
        <button className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')} role="tab">Online</button>
        <button className={tab === 'computer' ? 'active' : ''} onClick={() => setTab('computer')} role="tab">Computer</button>
      </div>

      <div className="match-grid">
        <article className="match-card match-card-featured">
          <div className="card-topline"><span>RANKED</span><i>Most popular</i></div>
          <h2>{tab === 'online' ? 'Quick match' : 'Practice match'}</h2>
          <p>{tab === 'online' ? 'We’ll find the closest available player to your rating.' : 'Play a private game against the Rust engine.'}</p>
          <div className="speed-options">
            {(['blitz', 'rapid', 'classic'] as const).map((option) => (
              <button key={option} className={speed === option ? 'active' : ''} onClick={() => setSpeed(option)}>
                <strong>{option === 'blitz' ? '3+2' : option === 'rapid' ? '10+0' : '30+0'}</strong>
                <span>{option}</span>
              </button>
            ))}
          </div>
          <button className="button button-acid button-wide" id="quick-match-btn" onClick={start}>
            {tab === 'online' ? 'Find an opponent' : 'Start against level 6'} <Arrow />
          </button>
          <small aria-live="polite">{matchStatus}</small>
        </article>

        <article className="match-card">
          <div className="card-icon"><FriendIcon /></div>
          <span className="card-label">PRIVATE</span>
          <h2>Play a friend</h2>
          <p>Create a clean six-character room code. Private games never affect rating.</p>
          <div className="room-row"><input aria-label="Room code" placeholder="ENTER CODE" maxLength={6} value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /><button aria-label="Join room" onClick={joinRoom}><Arrow /></button></div>
          <button className="button button-outline button-wide" onClick={createRoom}>Create a room</button>
        </article>

        <article className="match-card match-card-stats">
          <div className="card-icon"><BoltIcon /></div>
          <span className="card-label">YOUR FORM</span>
          <h2>Ready to climb.</h2>
          <div className="mini-stats">
            <div><span>Rating</span><strong>1,426</strong><small>+34 this week</small></div>
            <div><span>Win rate</span><strong>58%</strong><small>Last 20 games</small></div>
          </div>
          <div className="form-dots" aria-label="Recent form: win win loss win draw win">
            <i className="win" /><i className="win" /><i className="loss" /><i className="win" /><i className="draw" /><i className="win" />
          </div>
        </article>
      </div>
    </section>
  );
}

function GamePage({ game, onMove, onReset, connectionState, onDraw, onResign }: { game: ArenaGameState; onMove: (square: number) => void; onReset: () => void; connectionState: ConnectionState; onDraw: () => void; onResign: () => void }) {
  const currentScore = useMemo(() => score(game.board), [game.board]);
  const myTurn = game.turn === 'black' && game.status === 'playing';

  return (
    <section className="game-page">
      <div className="game-topbar">
        <div><span className="live-dot" /> RANKED RAPID</div>
        <span>Game 9f31d2 · Europe West</span>
        <span>{connectionState === 'idle' ? 'Local practice board' : `Edge ${connectionState}`}</span>
      </div>
      <div className="game-layout">
        <aside className="player-stack">
          <PlayerCard name="MiraCorner" rating={1511} color="white" time={game.whiteMs} active={game.turn === 'white'} score={currentScore.white} />
          <div className="versus-rule"><span>VS</span></div>
          <PlayerCard name="You" rating={1426} color="black" time={game.blackMs} active={game.turn === 'black'} score={currentScore.black} />
          <div className="game-actions">
            <button type="button" onClick={onDraw} disabled={connectionState === 'idle'}>Offer draw</button>
            <button type="button" onClick={onResign} disabled={connectionState === 'idle'}>Resign</button>
          </div>
        </aside>

        <div className="game-board-column">
          <div className={`turn-banner ${myTurn ? 'your-turn' : ''}`} aria-live="polite">
            <span>{game.status === 'finished' ? 'GAME COMPLETE' : myTurn ? 'YOUR TURN' : 'OPPONENT THINKING'}</span>
            <strong>{game.winner ? `${game.winner.toUpperCase()} WINS` : `${game.legalMoves.length} legal moves`}</strong>
          </div>
          <CanvasBoard game={game} onMove={onMove} />
        </div>

        <aside className="game-sidebar">
          <div className="sidebar-tabs"><button className="active">Moves</button><button>Chat</button><button>Details</button></div>
          <div className="move-list">
            {game.history.length === 0 ? (
              <div className="empty-moves"><strong>The opening awaits.</strong><span>Choose one of the four highlighted squares.</span></div>
            ) : game.history.map((move, index) => (
              <div className="move-row" key={`${move.ply}-${move.square}`}>
                <span>{index + 1}.</span>
                <i className={move.player} />
                <strong>{move.notation}</strong>
                <small>flipped {move.flipped.length}</small>
              </div>
            ))}
          </div>
          <div className="position-note">
            <span>POSITION NOTE</span>
            <p>Mobility matters more than disc count in the opening. Keep access to both edges.</p>
          </div>
          <button className="button button-outline button-wide" type="button" onClick={onReset}>New analysis board</button>
        </aside>
      </div>
    </section>
  );
}

function WatchPage() {
  return (
    <section className="page section-pad">
      <header className="page-header"><div><p className="eyebrow">Live now</p><h1>The arena never sleeps.</h1></div><p>Follow the strongest games on the platform with board updates delivered from the edge.</p></header>
      <div className="broadcast-grid">
        {['World Blitz Series · R6', 'KaitoFlips vs EdgeTheory', 'Women’s Open · Final', 'Road to 2000 · Arena'].map((title, index) => (
          <Link className="broadcast-card" to="/game" key={title}>
            <div className="broadcast-board" aria-hidden="true">{Array.from({ length: 16 }, (_, cell) => <i className={(cell + index) % 5 === 0 ? 'dark' : (cell + index) % 4 === 0 ? 'light' : ''} key={cell} />)}</div>
            <div><span><i className="live-dot" /> LIVE · {38 + index * 17} watching</span><h2>{title}</h2><p>{index % 2 === 0 ? 'Top board · Rapid 10+0' : 'Ranked · Classic 30+0'}</p></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RankingsPage() {
  return (
    <section className="page section-pad rankings-page">
      <header className="page-header"><div><p className="eyebrow">Global ladder</p><h1>The world’s best.</h1></div><p>Ratings are updated atomically after every ranked result. No hidden decay, no opaque adjustments.</p></header>
      <div className="rank-controls"><button className="active">Overall</button><button>Blitz</button><button>Rapid</button><button>Classical</button><span>Season 2026 · 08</span></div>
      <LeaderboardTable />
    </section>
  );
}

function LearnPage() {
  return (
    <section className="page section-pad learn-page">
      <header className="page-header"><div><p className="eyebrow">Othello academy</p><h1>See one move deeper.</h1></div><p>Short, visual lessons that turn positional ideas into instincts you can use under the clock.</p></header>
      <div className="lesson-grid">
        <article className="lesson-card lesson-feature"><span>01 · FUNDAMENTALS</span><h2>Mobility before material</h2><p>Why winning the disc count early is often the fastest route to a losing position.</p><button className="button button-acid">Start lesson <Arrow /></button></article>
        <article className="lesson-card"><span>02 · 8 MIN</span><h2>Corner access</h2><p>Build stable discs without gifting the X-square.</p></article>
        <article className="lesson-card"><span>03 · 11 MIN</span><h2>Parity control</h2><p>Count empty regions and choose where the final sequence begins.</p></article>
        <article className="lesson-card"><span>04 · PRACTICE</span><h2>Edge discipline</h2><p>Recognize when an edge is stable—and when it is a trap.</p></article>
      </div>
    </section>
  );
}

function NotFoundPage() {
  return <section className="not-found"><span>404</span><h1>No legal move here.</h1><Link className="button button-primary" to="/">Return home</Link></section>;
}

function LeaderboardTable({ compact = false }: { compact?: boolean }) {
  const [players, setPlayers] = useState(leaderboard);

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_REALTIME !== 'true') return;
    const controller = new AbortController();
    fetch('/api/rankings?pool=rapid', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('rankings unavailable')))
      .then((rows: Array<{ handle: string; country_code: string | null; rating: number; games_played: number; title: string | null }>) => {
        if (!rows.length) return;
        setPlayers(rows.map((row, index) => ({
          rank: index + 1,
          name: row.handle,
          country: row.country_code ?? 'INT',
          rating: Math.round(row.rating),
          form: '—',
          record: `${row.games_played} games`,
        })));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <div className={`leaderboard${compact ? ' leaderboard-compact' : ''}`}>
      <div className="leaderboard-head"><span>Rank</span><span>Player</span><span>Rating</span><span>Form</span><span>Record</span></div>
      {players.map((player) => (
        <div className="leaderboard-row" key={player.name}>
          <strong className="rank-number">{String(player.rank).padStart(2, '0')}</strong>
          <div className="rank-player"><PlayerAvatar tone={player.rank % 2 ? 'dark' : 'light'} initials={player.name.slice(0, 2).toUpperCase()} /><div><strong>{player.name}</strong><span>{player.country} · Grandmaster</span></div></div>
          <strong>{player.rating}</strong>
          <span className={player.form.startsWith('+') ? 'positive' : 'negative'}>{player.form}</span>
          <span>{player.record}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerCard({ name, rating, color, time, active, score: discScore }: { name: string; rating: number; color: Player; time: number; active: boolean; score: number }) {
  return (
    <article className={`player-card${active ? ' active' : ''}`}>
      <div className={`disc-icon ${color}`} />
      <div className="player-card-name"><strong>{name}</strong><span>{rating} · Intermediate</span></div>
      <div className="disc-score">{discScore}</div>
      <time>{formatClock(time)}</time>
    </article>
  );
}

function PlayerAvatar({ tone, initials }: { tone: 'dark' | 'light'; initials: string }) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}

function Feature({ index, title, body }: { index: string; title: string; body: string }) {
  return <article className="feature-card"><span>{index}</span><div className="feature-glyph" aria-hidden="true"><i /><i /><i /><i /></div><h3>{title}</h3><p>{body}</p><a href="/learn" aria-label={`Learn more about ${title}`}><Arrow /></a></article>;
}

function Arrow() { return <span className="arrow" aria-hidden="true">↗</span>; }
function FriendIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.4-3.6 2.2-5.4 5.5-5.4s5.1 1.8 5.5 5.4M11 19c.3-3.1 2-4.7 5-4.7 3.1 0 4.8 1.6 5.2 4.7"/></svg>; }
function BoltIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.5 2-8 12h6L10.5 22l8-12h-6z"/></svg>; }

function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default App;
