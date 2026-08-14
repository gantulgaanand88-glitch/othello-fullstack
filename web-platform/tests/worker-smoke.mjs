import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import WebSocket from 'ws';

const workerDirectory = path.resolve('workers', 'arena');
const miniflare = new Miniflare(convertV4MiniflareOptions({
  name: 'arena',
  modulesRoot: path.join(workerDirectory, 'build', 'worker'),
  modules: [
    { type: 'ESModule', path: path.join(workerDirectory, 'build', 'worker', 'shim.mjs') },
    { type: 'CompiledWasm', path: path.join(workerDirectory, 'build', 'worker', 'index.wasm') },
  ],
  compatibilityDate: '2026-08-14',
  durableObjects: {
    GAME_ROOM: { className: 'GameRoom', useSQLite: true },
    LOBBY: { className: 'Lobby', useSQLite: true },
  },
  d1Databases: { DB: '00000000-0000-0000-0000-000000000000' },
}));

try {
  const database = await miniflare.getD1Database('DB', 'arena');
  const migration = await fs.readFile(path.join(workerDirectory, 'migrations', '0001_core.sql'), 'utf8');
  for (const statement of migration.split(';').map((sql) => sql.trim()).filter(Boolean)) {
    await database.prepare(statement).run();
  }

  const health = await miniflare.dispatchFetch('http://arena.test/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: 'ok',
    service: 'othello-arena-edge',
    protocol: 1,
  });

  const opening = await miniflare.dispatchFetch('http://arena.test/api/engine/opening');
  assert.equal(opening.status, 200);
  const snapshot = await opening.json();
  assert.equal(snapshot.board.length, 64);
  assert.deepEqual(snapshot.legal_moves, [19, 26, 37, 44]);
  assert.equal(snapshot.black_score, 2);
  assert.equal(snapshot.white_score, 2);

  const guest = await miniflare.dispatchFetch('http://arena.test/api/auth/guest', { method: 'POST' });
  assert.equal(guest.status, 200);
  const guestBody = await guest.json();
  assert.match(guestBody.user.handle, /^Guest[0-9a-f]{8}$/);
  const setCookie = guest.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.split(';', 1)[0];
  const me = await miniflare.dispatchFetch('http://arena.test/api/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, guestBody.user.id);
  const logout = await miniflare.dispatchFetch('http://arena.test/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 200);
  const revoked = await miniflare.dispatchFetch('http://arena.test/api/me', { headers: { Cookie: cookie } });
  assert.equal(revoked.status, 401);

  const rankings = await miniflare.dispatchFetch('http://arena.test/api/rankings?pool=rapid');
  assert.equal(rankings.status, 200);
  assert.deepEqual(await rankings.json(), []);

  const missing = await miniflare.dispatchFetch('http://arena.test/api/does-not-exist');
  assert.equal(missing.status, 404);

  const local = await miniflare.ready;
  const gameUrl = new URL('/ws/game/smoke-game', local);
  gameUrl.protocol = 'ws:';
  const socket = new WebSocket(gameUrl);
  const inbox = [];
  const waiters = [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    inbox.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  const waitFor = (predicate, timeoutMs = 5_000) => {
    const existing = inbox.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve };
      waiters.push(waiter);
      setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for Worker WebSocket message'));
      }, timeoutMs).unref();
    });
  };
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const connected = await waitFor((message) => message.type === 'connected');
  assert.equal(connected.payload.protocol, 1);
  const initialGame = await waitFor((message) => message.type === 'snapshot' && message.payload.revision === 0);
  assert.equal(initialGame.payload.game_id, 'smoke-game');

  socket.send(JSON.stringify({
    type: 'move',
    payload: { square: 19, command_id: 'smoke-move-1' },
  }));
  const moved = await waitFor((message) => message.type === 'snapshot' && message.payload.revision === 1);
  assert.equal(moved.payload.turn, 'white');
  assert.equal(moved.payload.black_score, 4);
  assert.equal(moved.payload.white_score, 1);
  assert.equal(moved.payload.last_move.square, 19);
  assert.equal(moved.payload.clock.running, 'white');
  assert.ok(moved.payload.clock.black_ms <= 300_000);
  assert.ok(moved.payload.clock.server_now > 0);

  socket.send(JSON.stringify({
    type: 'move',
    payload: { square: 18, command_id: 'smoke-move-out-of-turn' },
  }));
  const rejected = await waitFor((message) => message.type === 'error' && message.payload.command_id === 'smoke-move-out-of-turn');
  assert.equal(rejected.payload.code, 'not_your_turn');
  socket.close();

  const openLobby = async () => {
    const lobbyUrl = new URL('/ws/lobby', local);
    lobbyUrl.protocol = 'ws:';
    const lobby = new WebSocket(lobbyUrl);
    const messages = [];
    const listeners = [];
    lobby.on('message', (data) => {
      const message = JSON.parse(data.toString());
      messages.push(message);
      for (const listener of [...listeners]) {
        if (listener.predicate(message)) {
          listeners.splice(listeners.indexOf(listener), 1);
          listener.resolve(message);
        }
      }
    });
    await new Promise((resolve, reject) => {
      lobby.once('open', resolve);
      lobby.once('error', reject);
    });
    const next = (predicate) => {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const listener = { predicate, resolve };
        listeners.push(listener);
        setTimeout(() => reject(new Error('Timed out waiting for lobby message')), 5_000).unref();
      });
    };
    await next((message) => message.type === 'connected');
    return { lobby, next };
  };

  const firstLobby = await openLobby();
  const secondLobby = await openLobby();
  firstLobby.lobby.send(JSON.stringify({ type: 'queue_join', payload: { mode: 'ranked' } }));
  await firstLobby.next((message) => message.type === 'queue_joined');
  secondLobby.lobby.send(JSON.stringify({ type: 'queue_join', payload: { mode: 'ranked' } }));
  const [firstMatch, secondMatch] = await Promise.all([
    firstLobby.next((message) => message.type === 'match_found'),
    secondLobby.next((message) => message.type === 'match_found'),
  ]);
  assert.equal(firstMatch.payload.game_id, secondMatch.payload.game_id);
  assert.equal(firstMatch.payload.color, 'white');
  assert.equal(secondMatch.payload.color, 'black');
  const gameRecord = await miniflare.dispatchFetch(`http://arena.test/api/games/${firstMatch.payload.game_id}`);
  assert.equal(gameRecord.status, 200);
  const gameRecordBody = await gameRecord.json();
  assert.equal(gameRecordBody.status, 'playing');
  assert.equal(gameRecordBody.rated, true);

  const pairedGameUrl = new URL(`/ws/game/${firstMatch.payload.game_id}`, local);
  pairedGameUrl.protocol = 'ws:';
  const pairedGameSocket = new WebSocket(pairedGameUrl);
  const pairedGameMessages = [];
  pairedGameSocket.on('message', (data) => pairedGameMessages.push(JSON.parse(data.toString())));
  await new Promise((resolve, reject) => {
    pairedGameSocket.once('open', resolve);
    pairedGameSocket.once('error', reject);
  });
  const waitForPairedGame = async (predicate) => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const message = pairedGameMessages.find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for paired game message');
  };
  const pairedSnapshot = await waitForPairedGame((message) => message.type === 'snapshot');
  assert.equal(pairedSnapshot.payload.game_id, firstMatch.payload.game_id);
  pairedGameSocket.send(JSON.stringify({
    type: 'resign',
    payload: { command_id: 'paired-game-resign' },
  }));
  const resigned = await waitForPairedGame((message) => message.type === 'game_finished');
  assert.equal(resigned.payload.reason, 'resignation');
  assert.equal(resigned.payload.snapshot.winner, 'white');
  const finishedRecord = await miniflare.dispatchFetch(`http://arena.test/api/games/${firstMatch.payload.game_id}`);
  const finishedRecordBody = await finishedRecord.json();
  assert.equal(finishedRecordBody.status, 'finished');
  assert.equal(finishedRecordBody.result, 'white');
  pairedGameSocket.close();
  firstLobby.lobby.close();
  secondLobby.lobby.close();

  const botUrl = new URL('/ws/game/bot-6-smoke', local);
  botUrl.protocol = 'ws:';
  const botSocket = new WebSocket(botUrl);
  const botMessages = [];
  botSocket.on('message', (data) => botMessages.push(JSON.parse(data.toString())));
  await new Promise((resolve, reject) => {
    botSocket.once('open', resolve);
    botSocket.once('error', reject);
  });
  const waitForBot = async (predicate) => {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const message = botMessages.find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for bot game message');
  };
  await waitForBot((message) => message.type === 'snapshot' && message.payload.revision === 0);
  botSocket.send(JSON.stringify({
    type: 'move',
    payload: { square: 19, command_id: 'bot-smoke-human-move' },
  }));
  const botReply = await waitForBot((message) => message.type === 'snapshot' && message.payload.revision === 2);
  assert.equal(botReply.payload.turn, 'black');
  assert.equal(botReply.payload.last_move.player, 'white');
  assert.equal(botReply.payload.board.filter(Boolean).length, 6);
  assert.equal(botReply.payload.clock.running, 'black');
  botSocket.close();

  console.log('Worker smoke tests passed: HTTP/D1 auth, rankings, authoritative clocks and moves, persistence, turn ownership, ranked pairing, and Rust bot reply.');
} finally {
  await miniflare.dispose();
}
