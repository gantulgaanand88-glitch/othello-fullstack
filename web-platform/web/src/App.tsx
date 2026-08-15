import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArenaSocket, type ConnectionState } from './api/ArenaSocket';
import { createGuestSession, currentUser, type ArenaUser } from './api/auth';
import { LobbySocket } from './api/LobbySocket';
import type { GameSnapshot, LiveGame } from './api/protocol';
import { AppShell } from './components/AppShell';
import { Arrow } from './components/Arrow';
import { CanvasBoard } from './components/CanvasBoard';
import { Leaderboard } from './components/Leaderboard';
import { createOpeningState, playMove, score, squareToNotation } from './game/engine';
import type { ArenaGameState, Player } from './game/types';

const realtimeEnabled = import.meta.env.VITE_ENABLE_REALTIME === 'true';

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

export default function App() {
  const [game, setGame] = useState<ArenaGameState>(() => createOpeningState());
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [playerRole, setPlayerRole] = useState<Player | null>(null);
  const [user, setUser] = useState<ArenaUser | null>(null);
  const [authBusy, setAuthBusy] = useState(realtimeEnabled);
  const [edgeHealthy, setEdgeHealthy] = useState<boolean | null>(realtimeEnabled ? null : false);
  const socketRef = useRef<ArenaSocket | null>(null);
  const liveClockTickRef = useRef(Date.now());
  const location = useLocation();
  const liveGameId = location.pathname === '/game' ? new URLSearchParams(location.search).get('id') : null;

  useEffect(() => {
    if (!realtimeEnabled) return;
    const controller = new AbortController();
    Promise.all([
      currentUser().then(setUser).catch(() => setUser(null)).finally(() => setAuthBusy(false)),
      fetch('/api/health', { signal: controller.signal }).then((response) => setEdgeHealthy(response.ok)).catch(() => setEdgeHealthy(false)),
    ]).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const beginGuestSession = useCallback(() => {
    if (!realtimeEnabled || user || authBusy) return;
    setAuthBusy(true);
    createGuestSession().then(setUser).catch(() => setEdgeHealthy(false)).finally(() => setAuthBusy(false));
  }, [authBusy, user]);

  useEffect(() => {
    if (!liveGameId) {
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('idle');
      setPlayerRole(null);
      return;
    }
    const socket = new ArenaSocket(liveGameId, {
      onState: setConnectionState,
      onRole: setPlayerRole,
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
      setGame((current) => current.status !== 'playing' ? current : current.turn === 'black'
        ? { ...current, blackMs: Math.max(0, current.blackMs - elapsed) }
        : { ...current, whiteMs: Math.max(0, current.whiteMs - elapsed) });
    }, 250);
    return () => window.clearInterval(timer);
  }, [liveGameId]);

  const makeMove = useCallback((square: number) => {
    if (liveGameId) {
      if (playerRole === game.turn) socketRef.current?.move(square);
      return;
    }
    setGame((current) => playMove(current, square));
  }, [game.turn, liveGameId, playerRole]);

  const resetGame = useCallback(() => setGame(createOpeningState()), []);

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'origin top-left; x right; y down; square = y * 8 + x',
      mode: game.status,
      turn: game.turn,
      legalMoves: game.legalMoves.map((square) => ({ square, x: square % 8, y: Math.floor(square / 8) })),
      board: game.board.map((piece, square) => piece ? { square, piece } : null).filter(Boolean),
      score: score(game.board),
      clocksMs: { black: game.blackMs, white: game.whiteMs },
      lastMove: game.lastMove,
      winner: game.winner,
      playerRole,
    });
    window.advanceTime = (milliseconds: number) => {
      const elapsed = Math.max(0, Math.floor(milliseconds));
      setGame((current) => {
        if (current.status !== 'playing') return current;
        const remaining = Math.max(0, (current.turn === 'black' ? current.blackMs : current.whiteMs) - elapsed);
        if (remaining === 0) return {
          ...current,
          blackMs: current.turn === 'black' ? 0 : current.blackMs,
          whiteMs: current.turn === 'white' ? 0 : current.whiteMs,
          status: 'finished', legalMoves: [], winner: current.turn === 'black' ? 'white' : 'black',
        };
        return current.turn === 'black' ? { ...current, blackMs: remaining } : { ...current, whiteMs: remaining };
      });
    };
    return () => { delete window.render_game_to_text; delete window.advanceTime; };
  }, [game, playerRole]);

  return (
    <AppShell user={user} authBusy={authBusy} edgeHealthy={edgeHealthy} onGuestSession={beginGuestSession}>
      <Routes>
        <Route path="/" element={<LandingPage game={game} onMove={makeMove} onReset={resetGame} />} />
        <Route path="/play" element={<PlayPage onStart={resetGame} />} />
        <Route path="/game" element={<GamePage game={game} gameId={liveGameId} playerRole={playerRole} onMove={makeMove} onReset={resetGame} connectionState={connectionState} onDraw={() => socketRef.current?.offerDraw()} onResign={() => socketRef.current?.resign()} />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/fair-play" element={<LegalPage kind="fair" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

function LandingPage({ game, onMove, onReset }: { game: ArenaGameState; onMove: (square: number) => void; onReset: () => void }) {
  return <>
    <section className="hero section-pad">
      <div className="hero-copy">
        <p className="eyebrow"><span /> Competitive Reversi, built in the open</p>
        <h1>One board.<br /><em>Sixty-four consequences.</em></h1>
        <p className="hero-lede">A fast, exact arena where every move is checked by the server and every disc tells the truth.</p>
        <div className="hero-actions"><Link className="button button-primary" id="start-btn" to="/play">Play now <Arrow /></Link><Link className="text-link" to="/learn">Learn the board <Arrow /></Link></div>
        <div className="hero-proof"><div><strong>10</strong><span>bot levels</span></div><div><strong>5+0</strong><span>server clock</span></div><div><strong>64</strong><span>squares, no luck</span></div></div>
      </div>
      <div className="hero-board-wrap">
        <div className="board-caption"><span>OPENING LAB</span><strong>{game.turn === 'black' ? 'Black' : 'White'} to move · {game.legalMoves.length} choices</strong></div>
        <CanvasBoard game={game} onMove={onMove} compact id="hero-board" />
        <button className="board-reset" type="button" onClick={onReset}>Reset position</button>
      </div>
    </section>
    <section className="trust-strip section-pad"><span>Rust rules engine</span><span>Authoritative clocks</span><span>Native WebSockets</span><span>Privacy-first beta</span></section>
    <section className="platform-intro section-pad">
      <header className="split-heading"><div><p className="eyebrow">Made for the game</p><h2>Calm interface.<br /><em>Serious foundations.</em></h2></div><p>Move quickly when the position is clear. Slow down when it is not. The interface stays out of the way while the engine protects the result.</p></header>
      <div className="feature-grid"><Feature index="01" title="Immediate play" body="Enter the five-minute pool, open a private room, or choose one of ten deterministic bot levels." /><Feature index="02" title="Verified moves" body="Legal moves, flips, turns, clocks, reconnects, and results are decided by the authoritative Rust engine." /><Feature index="03" title="No invented activity" body="Empty ladders and broadcasts stay empty until real players create real games. Product truth is part of the design." /></div>
    </section>
    <section className="rank-preview section-pad"><header className="row-heading"><div><p className="eyebrow">Verified results</p><h2>The ladder.</h2></div><Link className="text-link" to="/rankings">View rankings <Arrow /></Link></header><Leaderboard compact /></section>
    <section className="cta-band section-pad"><div><p className="eyebrow light">Your move</p><h2>Start with a clean board.</h2></div><Link className="button button-acid" to="/play">Enter the arena <Arrow /></Link></section>
  </>;
}

function PlayPage({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'online' | 'computer'>('online');
  const [botLevel, setBotLevel] = useState(6);
  const [status, setStatus] = useState('Ready · casual beta · server clock');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [searching, setSearching] = useState(false);
  const lobbyRef = useRef<LobbySocket | null>(null);

  useEffect(() => () => lobbyRef.current?.close(), []);
  const lobby = () => {
    if (lobbyRef.current) return lobbyRef.current;
    const socket = new LobbySocket({
      onState: (state) => {
        if (state === 'connecting') setStatus('Connecting to the arena…');
        if (state === 'reconnecting') setStatus('Connection interrupted. Rejoining…');
      },
      onMessage: (message) => {
        if (message.type === 'queue_joined') { setSearching(true); setStatus('Searching the casual five-minute pool…'); }
        if (message.type === 'queue_left') { setSearching(false); setStatus('Search cancelled.'); }
        if (message.type === 'room_created') { setCreatedCode(message.payload.code); setStatus('Private room created. Share the code below.'); }
        if (message.type === 'match_found') { setSearching(false); onStart(); navigate(`/game?id=${encodeURIComponent(message.payload.game_id)}#ticket=${encodeURIComponent(message.payload.ticket)}`); }
      },
      onError: (message) => { setSearching(false); setStatus(message); },
    });
    lobbyRef.current = socket;
    socket.connect();
    return socket;
  };
  const start = () => {
    if (!realtimeEnabled) { onStart(); navigate('/game'); return; }
    if (tab === 'computer') lobby().startBot(botLevel, 'random'); else lobby().joinQueue('casual');
  };
  return <section className="page section-pad">
    <header className="page-header"><div><p className="eyebrow">Play</p><h1>Choose the opponent.<br />Keep the rules fixed.</h1></div><p>The public beta uses one honest format: five minutes per player, no increment, and server-validated moves.</p></header>
    <div className="segmented" role="tablist" aria-label="Opponent"><button className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}>Online</button><button className={tab === 'computer' ? 'active' : ''} onClick={() => setTab('computer')}>Computer</button></div>
    <div className="match-grid">
      <article className="match-card featured"><p className="card-label">5+0 · UNRATED BETA</p><h2>{tab === 'online' ? 'Live match' : `Arena bot · level ${botLevel}`}</h2><p>{tab === 'online' ? 'Pair with the next available player. Ratings stay disabled until the rating worker and abuse controls are production-ready.' : 'Practice privately against the same Rust engine that validates live games.'}</p>
        {tab === 'computer' && <label className="level-control">Bot strength <strong>{botLevel}/10</strong><input type="range" min="1" max="10" value={botLevel} onChange={(event) => setBotLevel(Number(event.target.value))} /></label>}
        <button id="quick-match-btn" className="button button-acid button-wide" type="button" onClick={searching ? () => lobby().leaveQueue() : start}>{searching ? 'Cancel search' : tab === 'online' ? 'Find an opponent' : `Play level ${botLevel}`} <Arrow /></button><small aria-live="polite">{status}</small>
      </article>
      <article className="match-card"><p className="card-label">PRIVATE ROOM</p><h2>Play a friend</h2><p>Create a six-character room, then share only the code with the person you want to play.</p>
        <div className="room-row"><input aria-label="Room code" placeholder="ENTER CODE" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><button aria-label="Join room" onClick={() => joinCode && (realtimeEnabled ? lobby().joinRoom(joinCode) : start())}><Arrow /></button></div>
        <button className="button button-outline button-wide" onClick={() => realtimeEnabled ? lobby().createRoom() : start()}>Create private room</button>
        {createdCode && <button className="room-code" onClick={() => navigator.clipboard?.writeText(createdCode)}><span>Room code</span><strong>{createdCode}</strong><small>Tap to copy</small></button>}
      </article>
      <aside className="service-card"><p className="card-label">WHAT IS LIVE</p><dl><div><dt>Rules</dt><dd>Authoritative</dd></div><div><dt>Clock</dt><dd>5 minutes</dd></div><div><dt>Bot levels</dt><dd>1–10</dd></div><div><dt>Rated games</dt><dd>Not yet</dd></div></dl><p>Beta means the core game is working while accounts, moderation, ratings, and tournament systems are still being built.</p></aside>
    </div>
  </section>;
}

function GamePage({ game, gameId, playerRole, onMove, onReset, connectionState, onDraw, onResign }: { game: ArenaGameState; gameId: string | null; playerRole: Player | null; onMove: (square: number) => void; onReset: () => void; connectionState: ConnectionState; onDraw: () => void; onResign: () => void }) {
  const currentScore = useMemo(() => score(game.board), [game.board]);
  const live = Boolean(gameId);
  const canMove = !live || (connectionState === 'open' && playerRole === game.turn && game.status === 'playing');
  const turnText = game.status === 'finished' ? 'GAME COMPLETE' : !live ? `${game.turn.toUpperCase()} TO MOVE` : playerRole === game.turn ? 'YOUR TURN' : playerRole ? 'OPPONENT TO MOVE' : 'WATCHING LIVE';
  const blackName = playerRole === 'black' ? 'You' : gameId?.startsWith('bot-') ? 'Arena bot' : 'Black';
  const whiteName = playerRole === 'white' ? 'You' : gameId?.startsWith('bot-') ? 'Arena bot' : 'White';
  return <section className="game-page">
    <div className="game-topbar"><strong>{live ? 'LIVE · 5+0' : 'OPENING LAB'}</strong><span>{gameId ? `Game ${gameId.slice(0, 12)}` : 'Local practice · no server record'}</span><span>{live ? `Connection: ${connectionState}` : 'Works offline'}</span></div>
    <div className="game-layout">
      <aside className="player-stack"><PlayerCard name={whiteName} color="white" time={game.whiteMs} active={game.turn === 'white'} count={currentScore.white} /><PlayerCard name={blackName} color="black" time={game.blackMs} active={game.turn === 'black'} count={currentScore.black} />
        {live && playerRole && <div className="game-actions"><button onClick={onDraw}>Offer draw</button><button className="danger" onClick={onResign}>Resign</button></div>}
      </aside>
      <div className="game-board-column"><div className={`turn-banner${canMove ? ' your-turn' : ''}`} aria-live="polite"><span>{turnText}</span><strong>{game.winner ? `${game.winner.toUpperCase()} WINS` : `${game.legalMoves.length} legal moves`}</strong></div><CanvasBoard game={game} onMove={onMove} interactive={canMove} showLegalMoves={canMove} /></div>
      <aside className="game-sidebar"><header><span>MOVES</span><strong>{game.history.length} played</strong></header><div className="move-list">{game.history.length === 0 ? <div className="empty-moves"><strong>The opening awaits.</strong><span>{canMove ? 'Choose a highlighted square.' : 'Waiting for the first move.'}</span></div> : game.history.map((move) => <div className="move-row" key={`${move.ply}-${move.square}`}><span>{move.ply}.</span><i className={move.player} /><strong>{move.notation}</strong><small>+{move.flipped.length}</small></div>)}</div>
        <div className="game-facts"><span>Game facts</span><dl><div><dt>Rules</dt><dd>Standard 8×8</dd></div><div><dt>Clock</dt><dd>{live ? 'Server' : 'Local'}</dd></div><div><dt>Your seat</dt><dd>{playerRole ?? (live ? 'Spectator' : 'Both')}</dd></div></dl></div>
        {live ? <Link className="button button-outline button-wide" to="/play">Leave game</Link> : <button className="button button-outline button-wide" onClick={onReset}>Reset board</button>}
      </aside>
    </div>
  </section>;
}

function WatchPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(realtimeEnabled ? 'loading' : 'ready');
  useEffect(() => {
    if (!realtimeEnabled) return;
    const socket = new LobbySocket({ onState: (next) => { if (next === 'open') socket.listLiveGames(); }, onMessage: (message) => { if (message.type === 'live_games') { setGames(message.payload.games); setState('ready'); } }, onError: () => setState('error') });
    socket.connect();
    return () => socket.close();
  }, []);
  return <section className="page section-pad"><header className="page-header"><div><p className="eyebrow">Watch</p><h1>Real games only.</h1></div><p>Live boards appear here when the server publishes them. No placeholder viewers, tournaments, or players.</p></header>{state === 'loading' ? <DataEmpty title="Checking the live board…" body="Requesting the current game index." /> : state === 'error' ? <DataEmpty title="Live games are unavailable." body="Try again after the edge reconnects." /> : games.length === 0 ? <DataEmpty title="No games are being broadcast." body="This honest empty state will disappear when the live index has a real game." action="Start a game" /> : <div className="broadcast-grid">{games.map((item) => <Link className="broadcast-card" to={`/game?id=${encodeURIComponent(item.game_id)}`} key={item.game_id}><span className="live-pill">LIVE · {item.spectators} watching</span><h2>{item.black.username} vs {item.white.username}</h2><p>{item.black_score}–{item.white_score} · Open board</p></Link>)}</div>}</section>;
}

function RankingsPage() {
  const [pool, setPool] = useState('rapid');
  return <section className="page section-pad"><header className="page-header"><div><p className="eyebrow">Rankings</p><h1>Earned, never invented.</h1></div><p>The table reads the production database directly. Until rated result processing launches, a blank ladder is the correct ladder.</p></header><div className="rank-controls">{['blitz', 'rapid', 'classical'].map((item) => <button key={item} className={pool === item ? 'active' : ''} onClick={() => setPool(item)}>{item}</button>)}</div><Leaderboard pool={pool} /></section>;
}

const lessons = [
  { id: 'mobility', number: '01', title: 'Mobility before material', intro: 'A large disc lead can be a trap.', points: ['Count your opponent’s replies, not only your flips.', 'Prefer moves that keep several safe choices available.', 'Frontier discs—next to empty squares—often become liabilities.'] },
  { id: 'corners', number: '02', title: 'Corners and danger squares', intro: 'Corners cannot be flipped.', points: ['Avoid the X-square diagonal to an empty corner.', 'C-squares beside a corner can also concede it.', 'Once a corner is yours, grow a stable edge from it.'] },
  { id: 'tempo', number: '03', title: 'Control the quiet moves', intro: 'The strongest move may flip only one disc.', points: ['Small moves can preserve access and force a reply.', 'Edges are useful, but unsafe edge wedges can backfire.', 'Look one forced sequence beyond the immediate score.'] },
  { id: 'parity', number: '04', title: 'Read the endgame', intro: 'Empty regions decide who moves last.', points: ['Count empty squares in connected regions.', 'Try to take the last move in an odd region.', 'Recalculate parity after every forced pass.'] },
] as const;

function LearnPage() {
  const [selected, setSelected] = useState<(typeof lessons)[number]>(lessons[0]);
  return <section className="page section-pad learn-page"><header className="page-header"><div><p className="eyebrow">Learn</p><h1>See past the disc count.</h1></div><p>Four durable principles for standard Reversi. No fake progress bars or locked course cards—just ideas you can use on the next move.</p></header><div className="lesson-layout"><nav aria-label="Lessons">{lessons.map((lesson) => <button className={selected.id === lesson.id ? 'active' : ''} onClick={() => setSelected(lesson)} key={lesson.id}><span>{lesson.number}</span><strong>{lesson.title}</strong><small>{lesson.intro}</small></button>)}</nav><article><p className="eyebrow">Lesson {selected.number}</p><h2>{selected.title}</h2><p className="lesson-intro">{selected.intro}</p><ol>{selected.points.map((point) => <li key={point}>{point}</li>)}</ol><Link className="button button-primary" to="/game">Try it on the board <Arrow /></Link></article></div></section>;
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'fair' }) {
  const content = kind === 'privacy' ? {
    eyebrow: 'Privacy', title: 'Collect less. Explain it clearly.', lede: 'Effective 15 August 2026 · Public beta', sections: [
      ['What we process', 'When you create a guest session, the service stores a generated identifier and handle, a one-way digest of the session token, game actions, results, and moderation-relevant chat. Cloudflare may process technical request and security logs to deliver and protect the service.'],
      ['Cookies and analytics', 'The beta uses one strictly necessary, secure session cookie. It does not currently use advertising cookies, behavioral profiling, or third-party analytics. If that changes, this notice and any required consent controls must change first.'],
      ['Retention and control', 'Guest sessions expire after seven days. Game and abuse records may be kept longer for integrity, security, and dispute handling. Contact the project through its public GitHub repository to request access or deletion; legal and anti-abuse retention duties may limit deletion.'],
      ['Children and launch limits', 'The service is for people aged 13 or older and is not directed to children. A commercial launch needs a jurisdiction-specific privacy review, named data controller, contact address, retention schedule, and rights workflow.'],
    ],
  } : kind === 'terms' ? {
    eyebrow: 'Terms', title: 'Rules for a fair public beta.', lede: 'Effective 15 August 2026 · Read before play', sections: [
      ['The beta', 'Reversi Arena is provided as an experimental service without a promise of uninterrupted availability, permanent accounts, ratings, prizes, or data retention. Do not use it for wagering or any high-stakes purpose.'],
      ['Your responsibilities', 'You must be at least 13, follow applicable law, avoid harassment and illegal content, and never attack, scrape excessively, reverse engineer security controls, or disrupt the service or other players.'],
      ['Enforcement and liability', 'Sessions, content, and access may be limited or removed to protect users and the service. To the extent permitted by law, the beta is provided as-is. Local consumer rights that cannot legally be waived still apply.'],
      ['Names and ownership', 'Reversi Arena is an independent project. “Othello” is a trademark of its respective owner; this service is not affiliated with or endorsed by that owner. Before monetization, obtain qualified counsel for branding, company identity, jurisdiction, taxes, consumer terms, and platform rules.'],
    ],
  } : {
    eyebrow: 'Fair play', title: 'Win on the board.', lede: 'Human games require human decisions', sections: [
      ['No outside assistance', 'Do not use engines, move databases, another person, automation, or live position analysis during a game against a human unless the game is explicitly marked as assisted.'],
      ['No manipulation', 'Do not arrange results, sandbag, farm ratings, abuse reconnects, create sessions to evade sanctions, impersonate others, or exploit a bug for advantage. Report exploitable bugs privately before publishing details.'],
      ['Conduct', 'Keep chat focused and lawful. Threats, hate, sexual content involving minors, doxxing, spam, and targeted harassment are prohibited. Blocking, chat limits, and reporting are required before a broad public launch.'],
      ['Enforcement', 'The operator may review game, connection, and chat records, restrict features, invalidate results, or suspend access. Appeals and security reports should go through the project’s GitHub repository until a dedicated support channel exists.'],
    ],
  };
  return <section className="legal-page section-pad"><header><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.lede}</p></header><div className="legal-sections">{content.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div><aside><strong>Important:</strong> These pages are a transparent beta baseline, not a substitute for advice from a qualified lawyer in the countries where you operate.</aside></section>;
}

function Feature({ index, title, body }: { index: string; title: string; body: string }) { return <article className="feature-card"><span>{index}</span><h3>{title}</h3><p>{body}</p></article>; }
function PlayerCard({ name, color, time, active, count }: { name: string; color: Player; time: number; active: boolean; count: number }) { return <article className={`player-card${active ? ' active' : ''}`}><div><i className={`disc ${color}`} /><span><strong>{name}</strong><small>{color}</small></span></div><time>{formatClock(time)}</time><b>{count} discs</b></article>; }
function DataEmpty({ title, body, action }: { title: string; body: string; action?: string }) { return <div className="data-empty"><div className="empty-disc" /><strong>{title}</strong><span>{body}</span>{action && <Link className="button button-primary" to="/play">{action} <Arrow /></Link>}</div>; }
function NotFoundPage() { return <section className="not-found"><span>404</span><h1>This square is empty.</h1><Link className="button button-primary" to="/">Return home</Link></section>; }
function formatClock(milliseconds: number) { const total = Math.max(0, Math.ceil(milliseconds / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; }
