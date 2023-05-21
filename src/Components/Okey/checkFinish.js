import _ from "lodash";
import { toast } from "react-hot-toast";

function areNeighbors(a, b) {
  return Math.abs(a.rank - b.rank) === 1;
}
export const checkFinished = (hand, okey) => {
  let finished = true;
  let prevTile = null;
  // check doubles
  const filteredHand = hand.filter((h) => h !== null);
  const groupedByProperties = _.groupBy(
    filteredHand,
    (item) => `${item.color}-${item.rank}`
  );
  if (_.every(groupedByProperties, (g) => g.length === 2)) {
    // valid doubles hand
    return true;
  }

  let streak = 0;
  for (const currentTile of hand) {
    if (prevTile && currentTile) {
      streak++;
      if (currentTile?.id !== okey.id && prevTile?.id !== okey.id) {
        if (
          prevTile.color !== currentTile.color &&
          prevTile.rank !== currentTile.rank
        ) {
          if (streak < 3) {
            finished = false;
            toast(`Invalid sequence ${prevTile.name}>${currentTile.name}`);
            break;
          }
          streak = 0;
        } else if (
          !areNeighbors(prevTile, currentTile) &&
          prevTile.rank !== currentTile.rank
        ) {
          if (streak < 3) {
            finished = false;
            toast(`Invalid sequence ${prevTile.name}>${currentTile.name}`);
            break;
          }
          streak = 0;
        }
      }
    } else {
      if (streak !== 0 && streak < 2) {
        finished = false;
        toast(`Unfinished sequence ${prevTile.name}>...`);
        break;
      }
      streak = 0;
    }
    prevTile = currentTile;
  }
  // if (streak !== 0 && streak < 2) {
  //   toast(`Unfinished sequence ${prevTile.id}>...`);
  //   finished = false;
  // }
  return finished;
};
