import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { findKey, sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
// playOnMeld here is the rule, tried out for the ghost
import { claimants, playOnMeld as onMeld, upForClaim } from "./americano";
import { allSeats } from "./game";
import { colorOf, isOkey, okeyStandsFor, rankOf } from "./melds";
import { colorMap, symbols } from "./constants";
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

// one tile of a bigger pick brings the pick: that's opening or laying
// down, wherever on the table it lands
const inPick = (selected, tile) =>
  selected.length > 1 && selected.includes(tile.id);

function Meld({ meld, index }) {
  const { playOnMeld, okeyState, me, selected, openHand, layMelds } =
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
        if (inPick(selected, e.tile)) {
          (okeyState.opened[me] ? layMelds : openHand)();
        } else {
          playOnMeld(e.tile, index, endOf(monitor));
        }
      },
      collect: (monitor) => ({
        held: monitor.isOver() ? monitor.getItem().tile : null,
      }),
    }),
    [playOnMeld, index, selected, okeyState.opened, me, openHand, layMelds],
  );
  const ghost = useMemo(
    () =>
      held && !inPick(selected, held)
        ? ghostOf(okeyState, me, held, index, atEnd)
        : null,
    [held, okeyState, me, index, atEnd, selected],
  );
  // a full küt (all four colours, no okey left to swap out) is one tile
  const ind = okeyState.okeyTile;
  const full =
    meld.type === "kut" &&
    meld.tiles.length === 4 &&
    !meld.tiles.some((x) => isOkey(x, ind));
  const moves = lastTurn(okeyState);
  const marks = meld.tiles.map((x) => markOf(moves, x.id)).filter(Boolean);
  const mark = marks.length ? Math.min(...marks) : null;
  return (
    <div
      ref={(el) => {
        box.current = el;
        drop(el);
      }}
      className={`meld ${held ? "over" : ""}`}
      data-meld={index}
    >
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
              disabled
              // tiles side by side from one move show its number once, on
              // the last of them
              numbered={
                markOf(moves, x.id) !== markOf(moves, meld.tiles[i + 1]?.id)
              }
            />
          ),
        )
      )}
      {typeof ghost?.at === "string" && <Ghost {...ghost} />}
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
  const { okeyState } = useContext(OkeyContext);
  const { round, message, players, rules, gameState, opened } = okeyState;
  if (!rules) {
    const said =
      message ||
      (gameState === "play" && !okeyState.drawPile.length && "No tiles left");
    return said && <h3 className="round">{t(said)}</h3>;
  }
  const { rounds } = rules;
  const offer = upForClaim(okeyState);
  // everyone sees who wants the discard, so others can claim it too
  const wanting = claimants(okeyState);
  const from = offer && players.find((p) => p.id === offer.from);
  const offered = from?.discardPile.at(-1);
  return (
    <h3 className="round">
      {t(`Round ${round}/${rounds.length}`)}
      {/* 101 has the same opening every hand */}
      <small>{rules.opening ? rules.name : t(rounds[round - 1].name)}</small>
      {/* what opens the round, until everyone has (Elden has no opening) */}
      {!rules.opening &&
        rounds[round - 1].melds &&
        gameState === "play" &&
        !players.every((p) => opened?.[p.id]) && (
          <Example melds={rounds[round - 1].melds} />
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
  const { round, melds, opened, rules } = okeyState;
  const { rounds } = rules;

  // Picked tiles open (or, once opened, lay down) when one of them is
  // dragged onto the table; a drop on a meld adds to that meld instead.
  const canLay =
    okeyState.gameState === "play" &&
    okeyState.currentPlayer === me &&
    okeyState.drawn &&
    rounds[round - 1].melds !== null && // not in Elden
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

// the score sheet, from its button at the table's top right
export function Scores() {
  const { okeyState } = useContext(OkeyContext);
  const { scores, rules } = okeyState;
  // a freed seat keeps its column: whoever sits there next carries it on
  const players = allSeats(okeyState.players).filter(
    (p) => p.user || scores?.[p.id],
  );
  return (
    // a tap away: a round's end shows its scores with the hands, the end
    // of the game who won, and an open sheet would cover the next step
    <details className="scores">
      <summary>{t("Scores")}</summary>
      <div className="sheet">
        <table>
          <thead>
            <tr>
              <th />
              {players.map((p) => (
                <th key={p.id}>{p.user?.name ?? t(`Player ${p.id}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.rounds.map((r, i) => (
              <tr key={r.name}>
                <th>{t(r.name)}</th>
                {players.map((p) => (
                  <td key={p.id}>
                    {/* Americano's finish is a line; 101's varies */}
                    {!rules.opening && scores[p.id]?.[i] === rules.finishScore
                      ? "—"
                      : scores[p.id]?.[i]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th>{t("Total")}</th>
              {players.map((p) => (
                // blank for someone new: their total comes with the deal
                <td key={p.id}>{scores?.[p.id] && sum(scores[p.id])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}
