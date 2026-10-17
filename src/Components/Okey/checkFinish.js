import _ from "lodash";
import { toast } from "react-hot-toast";
import { t } from "../../i18n";

function areNeighbors(a, b) {
  if ((a.rank === 13 && b.rank === 1) || (a.rank === 1 && b.rank === 13)) {
    return true;
  }

  return Math.abs(a.rank - b.rank) === 1;
}

export const checkFinished = (hand, indicator) => {
  // replace fake okey's with indicator
  const replacedHand = hand.map((item) =>
    item?.rank === "👌"
      ? { ...indicator, rank: Math.max((indicator.rank + 1) % 14, 1) }
      : item,
  );
  let finished = true;
  let prevTile = null;
  // check doubles
  const filteredHand = replacedHand.filter((h) => h !== null);
  const groupedByProperties = _.groupBy(
    filteredHand,
    (item) => `${item.color}-${item.rank}`,
  );
  if (_.every(groupedByProperties, (g) => g.length === 2)) {
    // valid doubles hand
    return true;
  }

  let streak = 0;
  let sequenceType = null;
  let thirteen = false;
  for (const currentTile of replacedHand) {
    if (prevTile && currentTile) {
      streak++;
      // okey is good anywhere so continue
      if (
        !(
          currentTile?.color === indicator.color &&
          currentTile?.rank === Math.max((indicator.rank + 1) % 14, 1)
        ) &&
        !(
          prevTile?.color === indicator.color &&
          prevTile?.rank === Math.max((indicator.rank + 1) % 14, 1)
        )
      ) {
        if (
          prevTile.color !== currentTile.color &&
          prevTile.rank === currentTile.rank
        ) {
          if (sequenceType === "rank" && streak < 3) {
            finished = false;
            toast(t(`Invalid sequence ${prevTile.name}>${currentTile.name}`));
            break;
          }
          // going for colors
          sequenceType = "color";
          thirteen = false;
        } else if (
          prevTile.color === currentTile.color &&
          areNeighbors(prevTile, currentTile)
        ) {
          if (
            (sequenceType === "color" && streak < 3) ||
            (thirteen && currentTile.rank === 2)
          ) {
            finished = false;
            toast(t(`Invalid sequence ${prevTile.name}>${currentTile.name}`));
            break;
          }
          // going for sequence
          sequenceType = "rank";
          if (prevTile.rank === 13) {
            thirteen = true;
          }
        } else {
          if (streak < 3) {
            finished = false;
            toast(t(`Invalid sequence ${prevTile.name}>${currentTile.name}`));
            break;
          }
          streak = 0;
          sequenceType = null;
          thirteen = false;
        }
      }
    } else {
      // a group just ended: it needs 3+ tiles (streak counts the links)
      if (prevTile && streak < 2) {
        finished = false;
        toast(t(`Unfinished sequence ${prevTile.name}>...`));
        break;
      }
      streak = 0;
      sequenceType = null;
      thirteen = false;
    }
    prevTile = currentTile;
  }
  // the last slot of the rack closes a group too
  if (finished && prevTile && streak < 2) {
    toast(t(`Unfinished sequence ${prevTile.name}>...`));
    finished = false;
  }
  return finished;
};
