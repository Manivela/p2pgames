import { Undo, tell, useChangedAt } from "../Table";
import { t } from "../../i18n";
import { useKey } from "../../hooks/useKey";
import { count, pass, play, sizeOf, undo, whyNot } from "./rules";

// The board on the table, each player's bowl of stones at their side of it
// (go.css lays them out). The board is in --u, the lines' spacing: the
// grid and a margin of MARGIN round it, --b wide.
const MARGIN = 0.9;
// the star points, by row and column, on each size of board
const STARS = {
  9: [2, 6],
  13: [3, 9],
  19: [3, 9, 15],
};
const stars = (size) => {
  const at = STARS[size] ?? [];
  const middle = (size - 1) / 2;
  const all = at.flatMap((row) => at.map((col) => [row, col]));
  // the middle one, where the others don't make it
  return at.includes(middle) ? all : [...all, [middle, middle]];
};
// how long a stone takes to come down, and a taken one to go
const DROP_MS = 600;
// the points by the board's letters and numbers: A9 top left on a 9×9
const LETTERS = "ABCDEFGHJKLMNOPQRST";
const COLOR = ["black", "white"];

// A side of the table: a word for its player, Undo when they can take
// their last move back, and their bowl, a tap on it a pass (`onPass`), or
// P, when it's theirs to move
function Side({ seat, far, over, said, onUndo, onPass }) {
  const Bowl = onPass ? "button" : "div";
  useKey("p", onPass);
  return (
    <div className={`go-side${far ? " far" : ""}${over ? " over" : ""}`}>
      {said && <p className="go-said">{said}</p>}
      {onUndo && <Undo className="go-undo" onClick={onUndo} />}
      <Bowl
        className={`go-bowl ${COLOR[seat]}`}
        title={onPass && t("Pass")}
        aria-label={onPass && t("Pass")}
        onClick={onPass}
      >
        <i />
        <i />
        <i />
        {onPass && <span>{t("Pass")}</span>}
        {onPass && <kbd>P</kbd>}
      </Bowl>
    </div>
  );
}

// The game on its board (`table`, Table's useTable): the seat to move puts
// a stone on a free point, or passes at their bowl; the last move is its
// maker's to take back; after a pass, and once it's over, each empty
// point shows whose it would count for; then a tap on the board starts the
// next game.
export default function Board({ state, table }) {
  const { live, mine, near, far, across, names, note, act, deal } = table;
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const playing = me !== undefined && state.turn === me;
  const away = (seat) => across && seat !== near;
  const seenAt = useChangedAt(state.last.n, live);
  const fresh = Date.now() - seenAt < DROP_MS;
  const { last, winner } = state;
  const size = sizeOf(state.stones);
  const spot = (i) => ({
    "--x": MARGIN + (i % size),
    "--y": MARGIN + Math.floor(i / size),
  });
  const named = (i) => `${LETTERS[i % size]}${size - Math.floor(i / size)}`;
  const wide = size - 1 + MARGIN * 2;

  const tap = (i) => {
    if (!playing) return;
    const why = whyNot(state, i);
    if (why) tell(why, away(me));
    else act(play(state, me, i));
  };

  // whose each empty point would be, counted now
  const counted = winner || state.passes ? count(state.stones).owner : [];
  const over = state.turn === null && !note;
  const said =
    note ??
    (winner ? (
      <>
        {t(`${names[winner.seat]} wins by ${winner.by}`)}
        <small>
          {names[0]} {state.area[0]} · {names[1]} {state.area[1]}
        </small>
      </>
    ) : state.passes ? (
      t(`${names[1 - state.turn]} passed`)
    ) : me !== undefined && !playing ? (
      t(`Waiting for ${names[state.turn]}`)
    ) : null);
  const next = over && deal;
  useKey("n", next);
  // a side's: words to both face to face, Undo and Pass to whoever's it is
  const side = (seat, isFar) => (
    <Side
      seat={seat}
      far={isFar}
      over={across && isFar}
      said={(!isFar || across) && said}
      onUndo={
        state.back?.seat === seat && mine.includes(seat)
          ? () => act(undo(state, seat))
          : null
      }
      onPass={playing && me === seat ? () => act(pass(state, seat)) : null}
    />
  );
  // stones taken by the last move, going
  const off = fresh && last.kind === "stone" ? last.off : [];

  return (
    <div className="go-scene" style={{ "--b": wide }}>
      {side(far, true)}
      <div
        className={`go-board${next ? " ready" : ""} ${COLOR[state.turn] ?? ""}`}
      >
        <svg viewBox={`0 0 ${wide} ${wide}`}>
          {Array.from({ length: size }, (_, k) => (
            <path
              key={k}
              d={`M${MARGIN} ${MARGIN + k}h${size - 1}M${MARGIN + k} ${MARGIN}v${size - 1}`}
            />
          ))}
          {stars(size).map(([row, col]) => (
            <circle
              key={`${row}-${col}`}
              cx={MARGIN + col}
              cy={MARGIN + row}
              r="0.09"
            />
          ))}
        </svg>
        {counted.map(
          (seat, i) =>
            seat !== null && (
              <i key={i} className={`go-own ${COLOR[seat]}`} style={spot(i)} />
            ),
        )}
        {state.stones.map(
          (seat, i) =>
            seat !== null && (
              <i
                key={i}
                className={`go-stone ${COLOR[seat]}${last.at === i && last.kind === "stone" ? " last" : ""}${fresh && last.kind === "stone" && last.at === i ? " fresh" : ""}`}
                style={spot(i)}
              />
            ),
        )}
        {off.map((i) => (
          <i
            key={`off-${i}`}
            className={`go-stone ${COLOR[1 - state.stones[last.at]]} going`}
            style={spot(i)}
          />
        ))}
        {state.stones.map((seat, i) => (
          <button
            key={i}
            className={`go-point${playing && seat === null ? " open" : ""}`}
            style={spot(i)}
            data-at={i}
            aria-label={named(i)}
            onClick={() => tap(i)}
          />
        ))}
        {next && (
          <button
            className="go-next"
            aria-label={t("Next game")}
            title={t("Next game")}
            onClick={deal}
          >
            <kbd>N</kbd>
          </button>
        )}
      </div>
      {side(near, false)}
    </div>
  );
}
