import { useContext, useLayoutEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import { sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
import { FINISH_SCORE, claimants, rounds } from "./americano";
import { colorOf, isOkey, rankOf } from "./melds";
import Tile from "./Tile";
import { t } from "../../i18n";

function Meld({ meld, index }) {
  const { playOnMeld, okeyState } = useContext(OkeyContext);
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => {
        playOnMeld(e.tile, index);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [playOnMeld, index],
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
  const { okeyState } = useContext(OkeyContext);
  const { round, melds, message, players, offer } = okeyState;
  // everyone sees who wants the discard, so others can claim it too
  const wanting = claimants(okeyState);
  const from = offer && players.find((p) => p.id === offer.from);
  const offered = from?.discardPile.at(-1);
  // clear of the top player's discard pile and the side racks
  const inset = players.length === 2 ? 100 : 380;

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
        ref={band}
        className="melds"
        style={phone ? undefined : { left: inset, right: inset }}
      >
        {melds.map((meld, i) => (
          <Meld key={meld.tiles[0].id} meld={meld} index={i} />
        ))}
      </div>
    </>
  );
}

// open / lay down, catch the discard, next round
export function AmericanoActions({ phone }) {
  const { okeyState, me, openHand, layMelds, catchDiscard, nextRound } =
    useContext(OkeyContext);
  const { round, opened, gameState, players, melds, lastDiscard } = okeyState;
  const elden = !rounds[round - 1].melds;
  // the latest discard, while it's on top, can be caught if it fits a meld
  const discarder = players.find(
    (p) => lastDiscard && p.discardPile.at(-1)?.id === lastDiscard,
  );
  const canCatch =
    gameState === "play" &&
    me &&
    melds.length > 0 &&
    discarder &&
    discarder.id !== me &&
    !players.some((p) => p.caught?.includes(lastDiscard));

  return (
    <>
      {gameState === "play" && me && !elden && (
        <button
          {...place(phone, { marginLeft: -220 })}
          onClick={opened[me] ? layMelds : openHand}
        >
          {t(opened[me] ? "Lay down" : "Open")}
        </button>
      )}
      {canCatch && (
        <button
          {...place(phone, { marginLeft: -220, marginTop: 20 })}
          onClick={catchDiscard}
        >
          {t("Catch discard")}
        </button>
      )}
      {gameState === "roundEnd" && (
        <button
          {...place(phone, { marginLeft: 150, marginTop: 100 })}
          onClick={nextRound}
        >
          {t("Next Round")}
        </button>
      )}
    </>
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
  const { okeyState } = useContext(OkeyContext);
  const { players, scores, gameState } = okeyState;
  return (
    <details className="scores" open={gameState !== "play"}>
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
                <td key={p.id}>{sum(scores[p.id] ?? [])}</td>
              ))}
            </tr>
          </tbody>
        </table>
        {children}
      </div>
    </details>
  );
}
