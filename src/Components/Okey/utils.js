import { colorMap } from "./constants";

export const maxHandSize = 26;

export const createTile = (color, rank, i) => ({
  color: colorMap[color],
  rank,
  id: `${color + rank}-${i}`,
  name: `${color + rank}`,
  // hidden: true,
  source: "draw-pile",
});
