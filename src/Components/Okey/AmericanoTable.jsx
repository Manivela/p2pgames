import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { findKey, sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
// playOnMeld here is the rule, tried out for the ghost
import {
  addedThisTurn,
  claimants,
  isElden,
  penaltiesSoFar,
  playOnMeld as onMeld,
  upForClaim,
} from "./americano";
import { allSeats, partner } from "./game";
import { colorOf, isOkey, okeyStandsFor, rankOf } from "./melds";
import { colorMap, seatColors, symbols } from "./constants";
import Tile, { TileFace, lastTurn, markOf } from "./Tile";
import { t } from "../../i18n";

// What a tile held over a meld would do there, by the rules: where it would
// go (`at`: "before", "after", or the index of the okey it would replace)
// and the face it would show; an okey in a seri shows the tile it would
// stand for, in a küt a blank back. Null if the rules would refuse it.
function ghostOf(state, player, tile, index, atEnd) {
  const next = onMeld(state, player, tile.id, index, atEnd);
  if (!next || typeof next === "string") return null;
  const before = state.melds[index].tiles;
  const after = next.melds[index].tiles;
  const i = after.findIndex((x) => x.id === tile.id);
  if (i === -1) return null;
  const at = after.length === before.length ? i : i === 0 ? "before" : "after";
  const ind = state.okeyTile;
  if (!isOkey(tile, ind)) return { at, face: tile.id };
  if (next.melds[index].type !== "seri") return { at, face: null };
  const { rank, colors } = okeyStandsFor(next.melds[index], i, ind);
  return { at, face: `${findKey(colorMap, (c) => c === colors[0])}${rank}` };
}

const Ghost = ({ face, at }) => (
  <span className={`ghost ${typeof at === "string" ? at : ""}`}>
    {face ? <TileFace id={face} /> : <span className="tile" />}
  </span>
);

// one tile of a bigger pick brings the pick: on a meld, added to it if
// it all fits there; otherwise opening or laying down, wherever it lands
const inPick = (selected, tile) =>
  selected.length > 1 && selected.includes(tile.id);

function Meld({ meld, index }) {
  const { playOnMeld, okeyState, me, selected, addPick } =
    useContext(OkeyContext);
  const box = useRef(null);
  // the end a tile goes on: the half of the meld it's over
  const endOf = (monitor) => {
    const r = box.current.getBoundingClientRect();
    return monitor.getClientOffset()?.x > r.left + r.width / 2;
  };
  const [atEnd, setAtEnd] = useState(false);
  const [{ held }, drop] = useDrop(
    () => ({
      accept: "TILE",
      hover: (e, monitor) => setAtEnd(endOf(monitor)),
      drop: (e, monitor) => {
        // a tile taken back off the table goes to the rack (Rack.jsx)
        if (e.tile.source === "table") return;
        if (inPick(selected, e.tile)) addPick(index, endOf(monitor));
        else playOnMeld(e.tile, index, endOf(monitor));
      },
      collect: (monitor) => ({
        held: monitor.isOver() ? monitor.getItem().tile : null,
      }),
    }),
    [playOnMeld, index, selected, addPick],
  );
  const ghost = useMemo(
    () =>
      held && !inPick(selected, held)
        ? ghostOf(okeyState, me, held, index, atEnd)
        : null,
    [held, okeyState, me, index, atEnd, selected],
  );
  // a tile I added this turn can be dragged back to my rack
  const back = (x) => addedThisTurn(okeyState, me, x.id);
  // a full küt (all four colours, no okey left to swap out) is one tile,
  // once none of it can be taken back
  const ind = okeyState.okeyTile;
  const full =
    meld.type === "kut" &&
    meld.tiles.length === 4 &&
    !meld.tiles.some((x) => isOkey(x, ind) || back(x));
  const moves = lastTurn(okeyState);
  const marks = meld.tiles.map((x) => markOf(moves, x.id)).filter(Boolean);
  const mark = marks.length ? Math.min(...marks) : null;
  // a ghost past an end opens a slot there: the meld shrinks to make room,
  // so nothing else on the table moves (nor the half it's over)
  const end = typeof ghost?.at === "string" && <Ghost {...ghost} />;
  const n = meld.tiles.length;
  return (
    <div
      ref={(el) => {
        box.current = el;
        drop(el);
      }}
      className={`meld ${held ? "over" : ""}`}
      data-meld={index}
      style={end ? { "--squeeze": n / (n + 1) } : undefined}
    >
      {ghost?.at === "before" && end}
      {full ? (
        <div
          className={`tile full ${mark ? "marked" : ""}`}
          data-mark={mark ?? undefined}
        >
          <div className="rank">{rankOf(meld.tiles[0], ind)}</div>
          <div className="syms">
            {meld.tiles.map((x) => {
              // a fake okey takes the okey's colour
              const color = findKey(colorMap, (c) => c === colorOf(x, ind));
              return (
                <span key={x.id} className={`c-${color}`}>
                  {symbols[color]}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        meld.tiles.map((x, i) =>
          ghost?.at === i ? (
            <Ghost key={x.id} {...ghost} />
          ) : (
            <Tile
              key={x.id}
              tile={x}
              disabled={!back(x)}
              // tiles side by side from one move show its number once, on
              // the last of them
              numbered={
                markOf(moves, x.id) !== markOf(moves, meld.tiles[i + 1]?.id)
              }
            />
          ),
        )
      )}
      {ghost?.at === "after" && end}
    </div>
  );
}

// a made-up opening under the round's rule, to show what it asks for: sets
// of 7s and 10s, runs from 3 and 8, pairs of 2s, 5s, 8s and 11s
const COLORS = ["red", "blue", "black", "yellow"];
function Example({ melds }) {
  return (
    <span className="example">
      {melds.map(([type, size], i) => (
        <span key={i}>
          {Array.from({ length: size }, (_, j) => {
            const [color, rank] =
              type === "kut"
                ? [COLORS[j], 7 + 3 * i]
                : type === "seri"
                  ? [COLORS[i], 3 + 5 * i + j]
                  : [COLORS[i], 2 + 3 * i];
            return <TileFace key={j} id={`${color}${rank}`} />;
          })}
        </span>
      ))}
    </span>
  );
}

// where the round stands, on the table's right: which round and what opens
// it (or how it ended), and who wants the last discard
export function RoundInfo() {
  const { okeyState, me } = useContext(OkeyContext);
  const { round, players, rules, gameState, opened } = okeyState;
  const message =
    okeyState.message ||
    (gameState === "play" && !okeyState.drawPile.length && "No tiles left");
  if (gameState === "start") {
    return message && <h3 className="round">{t(message)}</h3>;
  }
  const { rounds } = rules;
  const { melds } = rounds[round - 1];
  const offer = upForClaim(okeyState);
  // everyone sees who wants the discard, so others can claim it too
  const wanting = claimants(okeyState);
  const from = offer && players.find((p) => p.id === offer.from);
  const offered = from?.discardPile.at(-1);
  return (
    <h3 className="round">
      {/* a game of one hand is just that hand */}
      {rounds.length > 1 && (
        <>
          {t(`Round ${round}/${rounds.length}`)}
          <small>{t(rounds[round - 1].name)}</small>
        </>
      )}
      {/* what opens the round, until everyone has */}
      {melds &&
        gameState === "play" &&
        !players.every((p) => opened?.[p.id]) && <Example melds={melds} />}
      {/* Americano: your out-of-turn takes this round, of the most allowed */}
      {gameState === "play" && okeyState.takes?.[me] > 0 && (
        <small className="takes">
          {t(`taken ${okeyState.takes[me]}/${rules.maxTakes}`)}
        </small>
      )}
      {message && <small>{t(message)}</small>}
      {wanting.length > 0 && offered && (
        <small className="claims">
          {t(
            `${wanting.map((p) => p.user.name).join(", ")} ${
              wanting.length > 1 ? "want" : "wants"
            } ${from.user?.name}'s ${
              offered.rank === "👌"
                ? "fake okey"
                : offered.name.replace(/^([a-z]+)/, "$1 ")
            }`,
          )}
        </small>
      )}
    </h3>
  );
}

const SAID = {
  took: "took the discard",
  opened: "opened",
  laid: "laid down",
  added: "added to a meld",
  swapped: "took an okey",
  finished: "finished",
};

// once the round is over, how it finished, under where it stands: each move
// of the finisher's last turn, numbered as its tiles are marked on the
// table, with its first tile
export function LastTurn() {
  const { okeyState } = useContext(OkeyContext);
  const moves = lastTurn(okeyState);
  if (!moves.length) return null;
  const name = (id) =>
    okeyState.players.find((p) => p.id === id)?.user?.name ?? t(`Player ${id}`);
  return (
    <ol className="moves">
      {moves.map((m, i) => (
        <li key={i}>
          <b>{i + 1}</b>
          <span className="said">{t(`${name(m.by)} ${SAID[m.move]}`)}</span>
          <TileFace id={m.tiles[0]} />
        </li>
      ))}
    </ol>
  );
}

// the melds on the table, and under them while the draw pile is in the
// middle (Board.jsx)
export function Melds({ underPile }) {
  const { okeyState, me, selected, openHand, layMelds } =
    useContext(OkeyContext);
  const { melds, opened } = okeyState;

  // Picked tiles open (or, once opened, lay down) when one of them is
  // dragged onto the table; a drop on a meld adds to that meld instead.
  const canLay =
    okeyState.gameState === "play" &&
    okeyState.currentPlayer === me &&
    okeyState.drawn &&
    !isElden(okeyState) &&
    selected.length > 0;
  const [{ over }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e, monitor) => {
        if (monitor.didDrop() || !canLay || !selected.includes(e.tile.id)) {
          return;
        }
        (opened[me] ? layMelds : openHand)();
      },
      collect: (monitor) => ({ over: monitor.isOver({ shallow: true }) }),
    }),
    [canLay, selected, opened, me, openHand, layMelds],
  );

  // every meld stays in view: they all shrink until they fit the band
  const band = useRef(null);
  const layout = melds.map((m) => m.tiles.length).join();
  useLayoutEffect(() => {
    const el = band.current;
    const shrink = () => {
      let scale = 1;
      el.style.setProperty("--fit", scale);
      while (el.scrollHeight > el.clientHeight && scale > 0.3) {
        scale -= 0.05;
        el.style.setProperty("--fit", scale);
      }
      return scale;
    };
    // "Drag here" shows only where it costs the melds nothing: on a phone
    // its line would shrink the whole table each time you pick a tile
    const fit = () => {
      const hint = el.querySelector(".hint");
      if (hint) hint.hidden = false;
      const scale = shrink();
      if (hint && scale < 1) {
        hint.hidden = true;
        if (shrink() === scale) hint.hidden = false;
      }
      // still too many: a finger scrolls the band (rack.css)
      el.style.touchAction =
        el.scrollHeight > el.clientHeight ? "pan-y pinch-zoom" : "";
    };
    fit();
    // the table's size, not the band's: under the pile the band is as tall
    // as its melds, and refitting would resize what it watches
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement);
    return () => observer.disconnect();
  }, [layout, underPile, canLay, okeyState.gameState]);

  return (
    <div
      ref={(el) => {
        band.current = el;
        drop(el);
      }}
      className={`melds ${canLay ? "droppable" : ""} ${over ? "over" : ""}`}
    >
      {canLay && (
        <span className="hint">
          {t(opened[me] ? "Drag here to lay down" : "Drag here to open")}
        </span>
      )}
      {melds.map((meld, i) => (
        <Meld key={meld.tiles[0].id} meld={meld} index={i} />
      ))}
    </div>
  );
}

// the score sheet, from its button at the table's top right: a column a
// player, or a pair's when four play in pairs; the hand being played shows
// what's owed so far (a caught tile, an okey thrown…), scored at its end
export function Scores() {
  const { okeyState } = useContext(OkeyContext);
  const { scores, rules, round, gameState } = okeyState;
  // a freed seat keeps its column: whoever sits there next carries it on
  const players = allSeats(okeyState.players).filter(
    (p) => p.user || scores?.[p.id],
  );
  const columns = rules.partners
    ? players
        .filter((p) => p.id < partner(okeyState.players, p.id).id)
        .map((p) => [p, partner(okeyState.players, p.id)])
    : players.map((p) => [p]);
  const live = gameState === "play" ? round - 1 : -1;
  // a player's line, with what they owe so far on the hand being played
  const line = (p, i) => {
    const owed = i === live ? penaltiesSoFar(okeyState, p.id) : 0;
    const scored = scores[p.id]?.[i];
    return scored == null && !owed ? null : (scored ?? 0) + owed;
  };
  const cell = (team, i) => {
    const values = team.map((p) => line(p, i));
    if (values.every((v) => v === null)) return "";
    const value = sum(values);
    // a finish that doesn't double is a line
    return !rules.finishDoubled &&
      team.length === 1 &&
      value === rules.finishScore
      ? "—"
      : value;
  };
  const name = (p) => p.user?.name ?? t(`Player ${p.id}`);
  // blank for someone new: their total comes with the deal
  const total = (team) =>
    team.some((p) => scores?.[p.id])
      ? sum(team.map((p) => sum(scores?.[p.id] ?? [])))
      : null;
  // the lowest total leads (americano.js's winner), unless all are level
  const totals = columns.map(total).filter((v) => v !== null);
  const lead = totals.some((v) => v !== totals[0]) && Math.min(...totals);
  return (
    // a tap away: a round's end shows its scores with the hands, the end
    // of the game who won, and an open sheet would cover the next step
    <details className="scores">
      {/* an icon: under your pile, where it sits, there's room for little */}
      <summary aria-label={t("Scores")} title={t("Scores")}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 8h4.4v6H1zM5.8 3h4.4v11H5.8zM10.6 10H15v4h-4.4z" />
        </svg>
      </summary>
      <div className="sheet">
        <table>
          <thead>
            <tr>
              <th />
              {columns.map((team) => (
                <th key={team[0].id}>
                  {team.map((p, j) => (
                    <span key={p.id} style={{ "--c": seatColors[p.id] }}>
                      {j > 0 && " & "}
                      <i aria-hidden="true" />
                      {name(p)}
                    </span>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.rounds.map((r, i) => (
              <tr
                key={r.name}
                // rounds still to come, dimmed
                className={
                  i === live
                    ? "running"
                    : i >= round && gameState !== "finish"
                      ? "later"
                      : ""
                }
              >
                <th>{t(r.name)}</th>
                {columns.map((team) => (
                  <td key={team[0].id}>{cell(team, i)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{t("Total")}</th>
              {columns.map((team) => {
                const value = total(team);
                return (
                  <td key={team[0].id} className={value === lead ? "lead" : ""}>
                    {value}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
