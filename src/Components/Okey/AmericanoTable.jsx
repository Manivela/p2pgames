import { useContext, useLayoutEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import { findKey, sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
import { claimants, upForClaim } from "./americano";
import { allSeats } from "./game";
import { colorOf, isOkey, rankOf } from "./melds";
import { colorMap, symbols } from "./constants";
import Tile from "./Tile";
import { t } from "../../i18n";

function Meld({ meld, index }) {
  const { playOnMeld, okeyState, me, selected, openHand, layMelds } =
    useContext(OkeyContext);
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => {
        // one tile of a bigger pick brings the pick: that's opening or
        // laying down, wherever on the table it lands
        if (selected.length > 1 && selected.includes(e.tile.id)) {
          (okeyState.opened[me] ? layMelds : openHand)();
        } else {
          playOnMeld(e.tile, index);
        }
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [playOnMeld, index, selected, okeyState.opened, me, openHand, layMelds],
  );
  // a full küt (all four colours, no okey left to swap out) is one tile
  const ind = okeyState.okeyTile;
  const full =
    meld.type === "kut" &&
    meld.tiles.length === 4 &&
    !meld.tiles.some((x) => isOkey(x, ind));
  return (
    <div
      ref={drop}
      className={`meld ${isOver ? "over" : ""}`}
      data-meld={index}
    >
      {full ? (
        <div className="tile full">
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
        meld.tiles.map((x) => <Tile key={x.id} tile={x} disabled />)
      )}
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
            return (
              <span key={j} className={`tile c-${color}`}>
                <span className="rank">{rank}</span>
                <span className="sym">{symbols[color]}</span>
              </span>
            );
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
    return message && <h3 className="round">{t(message)}</h3>;
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
  }, [layout, underPile, canLay]);

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
