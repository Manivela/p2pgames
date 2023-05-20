function areNeighbors(a, b) {
  return Math.abs(a.rank - b.rank) === 1;
}
export const checkFinished = (hand) => {
  let finished = true;
  let prevTile = null;
  //   const doubles = false;
  let streak = 0;
  for (const currentTile of hand) {
    console.log("prevTile: ", prevTile);
    if (prevTile && currentTile) {
      streak++;
      if (prevTile.color !== currentTile.color) {
        if (streak < 2) {
          finished = false;
          break;
        }
        streak = 0;
      } else if (!areNeighbors(prevTile, currentTile)) {
        if (streak < 2) {
          finished = false;
          break;
        }
        streak = 0;
      }
      console.log("streak: ", streak);
    } else {
      if (streak !== 0 && streak < 2) {
        finished = false;
        break;
      }
      streak = 0;
    }
    prevTile = currentTile;
  }
  if (streak < 2) {
    finished = false;
  }
  return finished;
};
