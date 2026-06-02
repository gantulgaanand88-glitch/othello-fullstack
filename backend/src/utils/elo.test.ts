import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateElo, getEloUpdateOps, getPlayerRank } from './elo';

test('calculateElo updates equal-rated new players correctly on win/loss', () => {
  const result = calculateElo(1200, 1200, 0, 0, 'win');

  assert.equal(result.newRatingA, 1220);
  assert.equal(result.newRatingB, 1180);
  assert.equal(result.changeA, 20);
  assert.equal(result.changeB, -20);
  assert.equal(Number(result.expectedA.toFixed(3)), 0.5);
  assert.equal(Number(result.expectedB.toFixed(3)), 0.5);
});

test('calculateElo handles draw with established players', () => {
  const result = calculateElo(1600, 1400, 40, 80, 'draw');

  assert.equal(result.newRatingA, 1595);
  assert.equal(result.newRatingB, 1405);
  assert.equal(result.changeA, -5);
  assert.equal(result.changeB, 5);
});

test('calculateElo applies stronger-player K-factor and underdog gain', () => {
  const result = calculateElo(2500, 2000, 100, 100, 'loss');

  assert.equal(result.newRatingA, 2491);
  assert.equal(result.newRatingB, 2019);
  assert.equal(result.changeA, -9);
  assert.equal(result.changeB, 19);
});

test('calculateElo enforces minimum rating floor', () => {
  const result = calculateElo(100, 3000, 0, 100, 'loss');

  assert.equal(result.newRatingA, 100);
  assert.equal(result.newRatingB, 3000);
});

test('getPlayerRank maps thresholds to expected rank names', () => {
  assert.equal(getPlayerRank(999), 'Beginner');
  assert.equal(getPlayerRank(1000), 'Intermediate');
  assert.equal(getPlayerRank(1399), 'Intermediate');
  assert.equal(getPlayerRank(1400), 'Advanced');
  assert.equal(getPlayerRank(1799), 'Advanced');
  assert.equal(getPlayerRank(1800), 'Expert');
  assert.equal(getPlayerRank(2199), 'Expert');
  assert.equal(getPlayerRank(2200), 'Master');
});

test('getEloUpdateOps returns proper update operators for win/loss/draw', () => {
  const win = getEloUpdateOps(1200, 1200, 0, 0, 'win');
  assert.deepEqual(win.opsA, { rating: 20, gamesPlayed: 1, wins: 1 });
  assert.deepEqual(win.opsB, { rating: -20, gamesPlayed: 1, losses: 1 });

  const loss = getEloUpdateOps(1200, 1200, 0, 0, 'loss');
  assert.deepEqual(loss.opsA, { rating: -20, gamesPlayed: 1, losses: 1 });
  assert.deepEqual(loss.opsB, { rating: 20, gamesPlayed: 1, wins: 1 });

  const draw = getEloUpdateOps(1200, 1200, 0, 0, 'draw');
  assert.deepEqual(draw.opsA, { rating: 0, gamesPlayed: 1, draws: 1 });
  assert.deepEqual(draw.opsB, { rating: 0, gamesPlayed: 1, draws: 1 });
  assert.equal(draw.eloResult.newRatingA, 1200);
  assert.equal(draw.eloResult.newRatingB, 1200);
});
