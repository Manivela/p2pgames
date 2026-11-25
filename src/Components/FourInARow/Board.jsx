import { Undo, tell, useChangedAt } from "../Table";
import { t } from "../../i18n";
import { useKey } from "../../hooks/useKey";
import { WIDE, drop, undo, whyNot } from "./rules";

// The rack on the table, standing: a tap on a column drops a disc down it
// (fourinarow.css lays it out, in --u, a place's width). Under it, a word
// for the players, and Undo for whoever dropped last; face to face on one
// device, the same over it, turned to the one across.
const COLOR = ["black", "white"];
// how long a disc takes to fall
const FALL_MS = 500;

// The game in its rack (`table`, Table's useTable): the seat to move taps
// a column; the last disc is its maker's to take back; once it's over the
// line that won is lit, and a tap on the rack starts the next game.
export default function Board({ state, table }) {
  const { live, mine, near, across, names, note, act, deal } = table;
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const playing = me !== undefined && state.turn === me;
  // across the table from the viewer, on this device: turned to them
  const away = (seat) => across && seat !== near;
  const seenAt = useChangedAt(state.last.n, live);
  const fresh = Date.now() - seenAt < FALL_MS;
  const { last, winner, back } = state;

  const tap = (col) => {
    if (!playing) return;
    const why = whyNot(state, col);
    if (why) tell(why, away(me));
    else act(drop(state, me, col));
  };

  const over = state.turn === null && !note;
  const said =
    note ??
    (winner
      ? t(`${names[winner.seat]} wins!`)
      : table.game && state.turn === null
        ? t("Draw")
        : me !== undefined && !playing
          ? t(`Waiting for ${names[state.turn]}`)
          : null);
  const next = over && deal;
  useKey("n", next);

  const canUndo = back && mine.includes(back.seat);
  const side = (far) => (
    <div className={`fr-side${far ? " over" : ""}`} data-felt="">
      {said && (!far || across) && <p className="fr-said">{said}</p>}
      {canUndo && away(back.seat) === far && (
        <Undo className="fr-undo" onClick={() => act(undo(state, back.seat))} />
      )}
    </div>
  );

  return (
    <div className="fr-scene">
      {side(true)}
      <div className={`fr-rack${next ? " ready" : ""}`}>
        {state.stones.map((seat, i) => (
          <i
            key={i}
            className={`fr-place ${COLOR[seat] ?? ""}${winner?.line.includes(i) ? " won" : ""}${fresh && last.at === i ? " fresh" : ""}`}
            style={{ "--x": i % WIDE, "--y": Math.floor(i / WIDE) }}
          />
        ))}
        {Array.from({ length: WIDE }, (_, col) => (
          <button
            key={col}
            className={`fr-col${playing && state.stones[col] === null ? ` open ${COLOR[me]}` : ""}`}
            style={{ "--x": col }}
            data-col={col}
            aria-label={t(`Column ${col + 1}`)}
            onClick={() => tap(col)}
          />
        ))}
        {next && (
          <button
            className="fr-next"
            aria-label={t("Next game")}
            aria-pressed={table.waits ? table.pressed : undefined}
            title={t("Next game")}
            onClick={deal}
          >
            <kbd>N</kbd>
          </button>
        )}
      </div>
      {side(false)}
    </div>
  );
}
