function areNeighbors(a, b) {
  return Math.abs(a.rank - b.rank) === 1;
}
export const checkFinished = (hand) => {
  let finished = true;
  let prevTile = null;
  let doubles = false;
  let streak = 0;
  for (const currentTile of hand) {
    if (prevTile && currentTile) {
      streak++;
      if (
        prevTile.color === currentTile.color &&
        prevTile.rank === currentTile.rank
      ) {
        doubles = true;
      }
      if (doubles && streak > 2) {
        finished = false;
        break;
      }
      if (
        prevTile.color !== currentTile.color &&
        prevTile.rank !== currentTile.rank
      ) {
        if (streak < (doubles ? 1 : 3)) {
          finished = false;
          break;
        }
        streak = 0;
      } else if (
        !areNeighbors(prevTile, currentTile) &&
        prevTile.rank !== currentTile.rank
      ) {
        if (streak < (doubles ? 1 : 3)) {
          finished = false;
          break;
        }
        streak = 0;
      }
    } else {
      if (streak !== 0 && streak < (doubles ? 1 : 2)) {
        finished = false;
        break;
      }
      streak = 0;
    }
    prevTile = currentTile;
  }
  if (streak !== 0 && streak < (doubles ? 1 : 2)) {
    finished = false;
  }
  return finished;
};
