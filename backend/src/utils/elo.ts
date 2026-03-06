export type MatchResult = 'win' | 'loss' | 'draw';

export interface EloCalculationResult {
  newRatingA: number;
  newRatingB: number;
  changeA: number;
  changeB: number;
  expectedA: number;
  expectedB: number;
}

function getKFactor(rating: number, gamesPlayed: number): number {
  if (gamesPlayed < 30) {
    return 40;
  }

  if (rating < 2400) {
    return 20;
  }

  return 10;
}

export function calculateElo(
  ratingA: number,
  ratingB: number,
  gamesPlayedA: number,
  gamesPlayedB: number,
  result: MatchResult,
): EloCalculationResult {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + 10 ** ((ratingA - ratingB) / 400));

  const scoreA = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const scoreB = result === 'loss' ? 1 : result === 'draw' ? 0.5 : 0;

  const kA = getKFactor(ratingA, gamesPlayedA);
  const kB = getKFactor(ratingB, gamesPlayedB);

  const newRatingA = Math.round(ratingA + kA * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB + kB * (scoreB - expectedB));

  return {
    newRatingA,
    newRatingB,
    changeA: newRatingA - ratingA,
    changeB: newRatingB - ratingB,
    expectedA,
    expectedB,
  };
}

export function getPlayerRank(rating: number): string {
  if (rating < 1000) {
    return 'Beginner';
  }

  if (rating < 1400) {
    return 'Intermediate';
  }

  if (rating < 1800) {
    return 'Advanced';
  }

  if (rating < 2200) {
    return 'Expert';
  }

  return 'Master';
}
