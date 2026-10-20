import { colorMap } from "./constants";

// Meld checks. `indicator` is the face-up tile (okeyTile in state): the okey
// is the same colour, next rank (13 → 1) and is wild; fake okeys stand in
// for the okey's own face value.

export const okeyRank = (indicator) => (indicator.rank % 13) + 1;

export const isOkey = (tile, indicator) =>
  tile.color === indicator.color && tile.rank === okeyRank(indicator);

const isFake = (tile) => tile.rank === "👌";
export const rankOf = (tile, indicator) =>
  isFake(tile) ? okeyRank(indicator) : tile.rank;
export const colorOf = (tile, indicator) =>
  isFake(tile) ? indicator.color : tile.color;

// küt: 3–4 tiles, one rank, all different colours
function kutOrder(tiles, indicator) {
  const rest = tiles.filter((t) => !isOkey(t, indicator));
  const ok =
    tiles.length >= 3 &&
    tiles.length <= 4 &&
    new Set(rest.map((t) => rankOf(t, indicator))).size <= 1 &&
    new Set(rest.map((t) => colorOf(t, indicator))).size === rest.length;
  return ok ? tiles : null;
}

// seri: 3+ consecutive ranks of one colour; 1 may follow 13 (12-13-1) but
// not lead into 2 from there, unless `wrap` is off (101). Returns the tiles
// in run order, okeys filling the gaps, or null.
function seriOrder(tiles, indicator, wrap) {
  const top = wrap ? 14 : 13;
  const wild = tiles.filter((t) => isOkey(t, indicator));
  const rest = tiles.filter((t) => !isOkey(t, indicator));
  const n = tiles.length;
  if (n < 3 || new Set(rest.map((t) => colorOf(t, indicator))).size > 1) {
    return null;
  }
  // in the order given (as laid out on the rack) if that's already a run, so
  // an okey stands where the player put it: 4-5-okey makes it a 6
  const a = tiles.findIndex((t) => !isOkey(t, indicator));
  const r = rankOf(tiles[a], indicator);
  const inPlace = (start) =>
    start >= 1 &&
    start + n - 1 <= top &&
    n <= 13 &&
    tiles.every(
      (t, j) =>
        isOkey(t, indicator) ||
        rankOf(t, indicator) === ((start + j - 1) % 13) + 1,
    );
  if ((r === 1 ? [1 - a, 14 - a] : [r - a]).some(inPlace)) return tiles;
  // otherwise the lowest run they make
  for (let start = 1; start + n - 1 <= top; start++) {
    const end = start + n - 1;
    const slots = Array(n).fill(null);
    const fits = rest.every((t) => {
      const r = rankOf(t, indicator);
      const pos = r >= start && r <= end ? r : r === 1 && end === 14 ? 14 : 0;
      if (!pos || slots[pos - start]) return false;
      slots[pos - start] = t;
      return true;
    });
    if (fits) {
      const okeys = [...wild];
      return slots.map((t) => t ?? okeys.shift());
    }
  }
  return null;
}

// pair (101): two of the same tile, or an okey and any tile
function pairOrder(tiles, indicator) {
  const [a, b] = tiles;
  const ok =
    tiles.length === 2 &&
    (isOkey(a, indicator) ||
      isOkey(b, indicator) ||
      (rankOf(a, indicator) === rankOf(b, indicator) &&
        colorOf(a, indicator) === colorOf(b, indicator)));
  return ok ? tiles : null;
}

// tiles arranged as a meld of `type` ("kut" | "seri" | "pair"), or null if
// they aren't one; `wrap`: whether 12-13-1 is a seri
export const meldOrder = (tiles, type, indicator, wrap = true) =>
  type === "kut"
    ? kutOrder(tiles, indicator)
    : type === "pair"
      ? pairOrder(tiles, indicator)
      : seriOrder(tiles, indicator, wrap);

// What a table okey stands for, fixed by where it sits: in a seri its place
// gives the rank; in a küt it's the rank and whichever colours are missing.
export function okeyStandsFor(meld, i, indicator) {
  const a = meld.tiles.findIndex((t) => !isOkey(t, indicator));
  const real = meld.tiles.filter((t) => !isOkey(t, indicator));
  const color = colorOf(meld.tiles[a], indicator);
  let rank = rankOf(meld.tiles[a], indicator);
  if (meld.type === "kut") {
    const have = real.map((t) => colorOf(t, indicator));
    const all = Object.values(colorMap); // tiles carry the hex colour
    return { rank, colors: all.filter((c) => !have.includes(c)) };
  }
  if (meld.type === "pair") return { rank, colors: [color] };
  if (rank === 1 && a > 0) rank = 14; // the 1 after 13
  return { rank: ((rank + i - a - 1) % 13) + 1, colors: [color] };
}

const combos = (arr, k) =>
  k === 0
    ? [[]]
    : arr.flatMap((t, i) =>
        combos(arr.slice(i + 1), k - 1).map((c) => [t, ...c]),
      );

// Splits the picked tiles into melds, using every tile, or with `spare` as
// many as the shapes need. `shapes` is a list of [type, size] to make
// exactly (an opening); without it any küts (3–4) and seris of 3+ will do
// (laying down later). A group that could be both is a seri. Returns
// [{ type, tiles }] with each meld's tiles in order, or null.
export function splitMelds(tiles, indicator, shapes, wrap = true, spare) {
  if (shapes && !shapes.length) return tiles.length && !spare ? null : [];
  if (!tiles.length) return shapes?.length ? null : [];
  // too few tiles left for the shapes
  if (shapes && tiles.length < shapes.reduce((n, [, size]) => n + size, 0)) {
    return null;
  }
  const [first, ...rest] = tiles;
  const options = shapes
    ? shapes
        .map((shape, i) => [...shape, i])
        // the same shape twice is the same try
        .filter(
          ([type, size], i) =>
            shapes.findIndex(([t, s]) => t === type && s === size) === i,
        )
    : [
        ...Array.from({ length: tiles.length - 2 }, (_, k) => ["seri", k + 3]),
        ["kut", 3],
        ["kut", 4],
      ];
  for (const [type, size, i] of options) {
    for (const others of combos(rest, size - 1)) {
      const ordered = meldOrder([first, ...others], type, indicator, wrap);
      if (!ordered) continue;
      const left = rest.filter((t) => !others.includes(t));
      const more = splitMelds(
        left,
        indicator,
        shapes?.filter((_, j) => j !== i),
        wrap,
        spare,
      );
      if (more) return [{ type, tiles: ordered }, ...more];
    }
  }
  // the first tile left out
  return spare ? splitMelds(rest, indicator, shapes, wrap, spare) : null;
}
