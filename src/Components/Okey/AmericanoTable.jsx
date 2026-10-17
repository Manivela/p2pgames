import { useContext } from "react";
import { useDrop } from "react-dnd";
import { sum } from "lodash";
import { OkeyContext } from "./OkeyContext";
import { FINISH_SCORE, MAX_TAKES, claimants, rounds } from "./americano";
import Tile from "./Tile";

function Meld({ meld, index }) {
  const { playOnMeld } = useContext(OkeyContext);
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
  return (
    <div ref={drop} className={`meld ${isOver ? "over" : ""}`}>
      {meld.tiles.map((t) => (
        <Tile key={t.id} tile={t} disabled />
      ))}
    </div>
  );
}

// Americano bits that sit on the table: round, melds, open / lay, next round
export function AmericanoTable() {
  const { okeyState, me, openHand, layMelds, claimDiscard, nextRound } =
    useContext(OkeyContext);
  const { round, melds, opened, gameState, message, players, offer } =
    okeyState;
  const myClaim = players.find((p) => p.id === me)?.claim;
  const takesLeft = MAX_TAKES - (okeyState.takes?.[me] ?? 0);
  const canClaim =
    gameState === "play" &&
    offer &&
    me &&
    takesLeft > 0 &&
    me !== okeyState.currentPlayer &&
    me !== offer.from;
  // everyone sees who wants the discard, so others can claim it too
  const wanting = claimants(okeyState);
  const from = offer && players.find((p) => p.id === offer.from);
  const offered = from?.discardPile.at(-1);
  const elden = !rounds[round - 1].melds;
  // clear of the top player's discard pile and the side racks
  const inset = players.length === 2 ? 30 : 380;

  return (
    <>
      <h3 className="round">
        Round {round}/{rounds.length} · {rounds[round - 1].name}
        {message && ` — ${message}`}
        {wanting.length > 0 && offered && (
          <span className="claims">
            {wanting.map((p) => p.user.name).join(", ")}{" "}
            {wanting.length > 1 ? "want" : "wants"} {from.user?.name}&apos;s{" "}
            {offered.rank === "👌"
              ? "fake okey"
              : offered.name.replace(/^([a-z]+)/, "$1 ")}
          </span>
        )}
      </h3>
      <div className="melds" style={{ left: inset, right: inset }}>
        {melds.map((meld, i) => (
          <Meld key={meld.tiles[0].id} meld={meld} index={i} />
        ))}
      </div>
      {gameState === "play" && me && !elden && (
        <button
          className="drawPile"
          style={{ marginLeft: -220 }}
          onClick={opened[me] ? layMelds : openHand}
        >
          {opened[me] ? "Lay down" : "Open"}
        </button>
      )}
      {canClaim && (
        <button
          className="drawPile"
          style={{ marginLeft: -220, marginTop: 20 }}
          onClick={claimDiscard}
        >
          {myClaim === offer.id
            ? "Taking discard ✓"
            : `Take discard (+1) · ${takesLeft} left`}
        </button>
      )}
      {gameState === "roundEnd" && (
        <button
          className="drawPile"
          style={{ marginLeft: 150, marginTop: 100 }}
          onClick={nextRound}
        >
          Next Round
        </button>
      )}
    </>
  );
}

export function Scores() {
  const { okeyState } = useContext(OkeyContext);
  const { players, scores, gameState } = okeyState;
  return (
    <details className="scores" open={gameState !== "play"}>
      <summary>Scores</summary>
      <table>
        <thead>
          <tr>
            <th />
            {players.map((p) => (
              <th key={p.id}>{p.user?.name ?? `Player ${p.id}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((r, i) => (
            <tr key={r.name}>
              <th>{r.name}</th>
              {players.map((p) => (
                <td key={p.id}>
                  {scores[p.id]?.[i] === FINISH_SCORE ? "—" : scores[p.id]?.[i]}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th>Total</th>
            {players.map((p) => (
              <td key={p.id}>{sum(scores[p.id] ?? [])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </details>
  );
}
