import { useContext, useLayoutEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import { sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
import { FINISH_SCORE, claimants, rounds, upForClaim } from "./americano";
import { allSeats } from "./game";
import { colorOf, isOkey, rankOf } from "./melds";
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
    <div ref={drop} className={`meld ${isOver ? "over" : ""}`}>
      {full ? (
        <div className="tile full">
          <div className="rank">{rankOf(meld.tiles[0], ind)}</div>
          <div className="dots">
            {meld.tiles.map((x) => (
              <span key={x.id} style={{ backgroundColor: colorOf(x, ind) }} />
            ))}
          </div>
        </div>
      ) : (
        meld.tiles.map((x) => <Tile key={x.id} tile={x} disabled />)
      )}
    </div>
  );
}

// Desktop pins table buttons around the draw pile; the phone layout stacks
// them in its own column
export const place = (phone, style) =>
  phone ? {} : { className: "drawPile", style };

// round, the claims on the last discard and the melds on the table
export function AmericanoInfo({ phone }) {
  const { okeyState, me, selected, openHand, layMelds } =
    useContext(OkeyContext);
  const { round, melds, message, players, opened } = okeyState;
  const offer = upForClaim(okeyState);
  // everyone sees who wants the discard, so others can claim it too
  const wanting = claimants(okeyState);
  const from = offer && players.find((p) => p.id === offer.from);
  const offered = from?.discardPile.at(-1);
  // clear of the top player's discard pile and the side racks
  const inset = players.length === 2 ? 100 : 380;

  // Picked tiles open (or, once opened, lay down) when one of them is
  // dragged onto the table; a drop on a meld adds to that meld instead.
  const canLay =
    okeyState.gameState === "play" &&
    okeyState.currentPlayer === me &&
    okeyState.drawn &&
    rounds[round - 1].melds &&
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
    const fit = () => {
      let scale = 1;
      el.style.setProperty("--fit", scale);
      while (el.scrollHeight > el.clientHeight && scale > 0.3) {
        scale -= 0.05;
        el.style.setProperty("--fit", scale);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout]);

  return (
    <>
      <h3 className="round">
        {t(`Round ${round}/${rounds.length}`)} · {t(rounds[round - 1].name)}
        {message && ` — ${t(message)}`}
        {wanting.length > 0 && offered && (
          <span className="claims">
            {t(
              `${wanting.map((p) => p.user.name).join(", ")} ${
                wanting.length > 1 ? "want" : "wants"
              } ${from.user?.name}'s ${
                offered.rank === "👌"
                  ? "fake okey"
                  : offered.name.replace(/^([a-z]+)/, "$1 ")
              }`,
            )}
          </span>
        )}
      </h3>
      <div
        ref={(el) => {
          band.current = el;
          drop(el);
        }}
        className={`melds ${canLay ? "droppable" : ""} ${over ? "over" : ""}`}
        style={phone ? undefined : { left: inset, right: inset }}
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
    </>
  );
}

// next round, once one ends (opening and catching happen at the tiles)
export function AmericanoActions({ phone }) {
  const { okeyState, nextRound } = useContext(OkeyContext);
  return (
    okeyState.gameState === "roundEnd" && (
      <button
        {...place(phone, { marginLeft: 150, marginTop: 100 })}
        onClick={nextRound}
      >
        {t("Next Round")}
      </button>
    )
  );
}

export function AmericanoTable() {
  return (
    <>
      <AmericanoInfo />
      <AmericanoActions />
    </>
  );
}

// children: extra controls under the sheet (the phone puts Reset / New Game here)
export function Scores({ children }) {
  const { okeyState, me } = useContext(OkeyContext);
  const { scores, gameState } = okeyState;
  // a freed seat keeps its column: whoever sits there next carries it on
  const players = allSeats(okeyState.players).filter(
    (p) => p.user || scores?.[p.id],
  );
  return (
    // closed for someone not seated: on phones it would cover the free seats
    <details className="scores" open={gameState !== "play" && !!me}>
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
            {rounds.map((r, i) => (
              <tr key={r.name}>
                <th>{t(r.name)}</th>
                {players.map((p) => (
                  <td key={p.id}>
                    {scores[p.id]?.[i] === FINISH_SCORE
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
        {children}
      </div>
    </details>
  );
}
