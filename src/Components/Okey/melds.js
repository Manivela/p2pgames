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
// not lead into 2 from there. Returns the tiles in run order, okeys filling
// the gaps, or null.
function seriOrder(tiles, indicator) {
  const wild = tiles.filter((t) => isOkey(t, indicator));
  const rest = tiles.filter((t) => !isOkey(t, indicator));
  const n = tiles.length;
  if (n < 3 || new Set(rest.map((t) => colorOf(t, indicator))).size > 1) {
    return null;
  }
  for (let start = 1; start + n - 1 <= 14; start++) {
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

// tiles arranged as a meld of `type` ("kut" | "seri"), or null if they aren't one
export const meldOrder = (tiles, type, indicator) =>
  type === "kut" ? kutOrder(tiles, indicator) : seriOrder(tiles, indicator);

const combos = (arr, k) =>
  k === 0
    ? [[]]
    : arr.flatMap((t, i) =>
        combos(arr.slice(i + 1), k - 1).map((c) => [t, ...c]),
      );

// Splits the picked tiles into melds, using every tile. `shapes` is a list of
// [type, size] to make exactly (an opening); without it any küts and seris of
// 3+ will do (laying down later). A group that could be both is a seri.
// Returns [{ type, tiles }] with each meld's tiles in order, or null.
export function splitMelds(tiles, indicator, shapes) {
  if (!tiles.length) return shapes?.length ? null : [];
  if (shapes && !shapes.length) return null;
  const [first, ...rest] = tiles;
  const options = shapes
    ? shapes.map((shape, i) => [...shape, i])
    : ["seri", "kut"].flatMap((type) =>
        Array.from({ length: tiles.length - 2 }, (_, k) => [type, k + 3]),
      );
  for (const [type, size, i] of options) {
    for (const others of combos(rest, size - 1)) {
      const ordered = meldOrder([first, ...others], type, indicator);
      if (!ordered) continue;
      const left = rest.filter((t) => !others.includes(t));
      const more = splitMelds(
        left,
        indicator,
        shapes?.filter((_, j) => j !== i),
      );
      if (more) return [{ type, tiles: ordered }, ...more];
    }
  }
  return null;
}
