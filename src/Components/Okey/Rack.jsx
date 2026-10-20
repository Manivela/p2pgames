import { useContext } from "react";
import Slot from "./Slot";
import Tile from "./Tile";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";
import { t } from "../../i18n";
import { upForClaim } from "./americano";
import { seatColors } from "./constants";
import TeaGlass from "./TeaGlass";

const shownAtEnd = (s) => ["finish", "roundEnd"].includes(s.gameState);
const turnOf = (s, player) =>
  s.gameState === "play" && s.currentPlayer === player;

// A soft 30 s turn timer (rack.css): it starts when the turn reaches this
// device and loops, never skipping anyone. The key restarts it on a new
// deal with the same starter.
const Timer = ({ okeyState }) => (
  <i key={`${okeyState.deal}-${okeyState.currentPlayer}`} className="timer" />
);

// A name and what everyone at the table can see about them, or an empty
// seat to sit in
function Name({ player }) {
  const { okeyState, sit, isAlreadySitting } = useContext(OkeyContext);
  const seat = okeyState.players.find((p) => p.id === player);
  if (!seat.user) {
    return (
      <h1 className="playerName">
        {t(`Player ${player}`)}{" "}
        {!isAlreadySitting && (
          <button onClick={() => sit(player)}>{t("Sit")}</button>
        )}
      </h1>
    );
  }
  const playing = okeyState.gameState === "play";
  const turn = okeyState.currentPlayer === player;
  return (
    <h1 className={`playerName ${turn && playing ? "active" : ""}`}>
      <span className="name">{seat.user.name}</span>
      {playing && turn && okeyState.drawn && (
        <span className="badge drew">{t("drew")}</span>
      )}
      {playing && okeyState.rules && okeyState.opened[player] && (
        <span className="badge">{t("opened")}</span>
      )}
      {playing && turn && <TeaGlass />}
    </h1>
  );
}

// Your rack (the hand rows show only for you, and for everyone once the
// round ends), with your name over it
function Rack({ player }) {
  const { myHand, swapTile, drawTile, okeyState, me, claimDiscard } =
    useContext(OkeyContext);
  const offer = upForClaim(okeyState);
  function onDrop(tile, toIndex) {
    if (tile.source.startsWith("claim-")) {
      claimDiscard(toIndex); // move the ghost
    } else if (tile.source.includes("hand")) {
      swapTile(player, tile, toIndex);
    } else if (offer?.tileId === tile.id && me !== okeyState.currentPlayer) {
      claimDiscard(toIndex); // out-of-turn take
    } else {
      drawTile(player, tile, toIndex);
    }
  }
  const sittingPlayer = okeyState.players.find((p) => p.id === player);
  // my claim on the discard waits as a ghost in the slot I dropped it on
  const offered =
    offer &&
    !okeyState.players.some((p) => p.caught?.includes(offer.tileId)) &&
    okeyState.players.find((p) => p.id === offer.from)?.discardPile.at(-1);
  const ghost = me === player &&
    offered &&
    offered.id === offer.tileId &&
    sittingPlayer.claim?.id === offer.id && {
      slot: sittingPlayer.claim.slot,
      tile: { ...offered, source: `claim-${me}` },
    };
  const slotProps = (tile, index) =>
    !tile && ghost?.slot === index
      ? { tile: ghost.tile, className: "ghost" }
      : { tile };
  const row = (from) =>
    myHand(player)
      .slice(from, from + 13)
      .map((tile, i) => (
        <Slot
          key={from + i}
          index={from + i}
          onDrop={onDrop}
          {...slotProps(tile, from + i)}
        />
      ));

  const turn = turnOf(okeyState, player);
  return (
    <div className={`rack ${turn ? "turn" : ""}`} data-seat={player}>
      {turn && <Timer okeyState={okeyState} />}
      {(me === player || shownAtEnd(okeyState)) && (
        <>
          <div className="top">{row(0)}</div>
          <div className="bottom">{row(13)}</div>
        </>
      )}
      <Name player={player} />
    </div>
  );
}

// Someone else at the table: a round avatar in their seat's colour with
// how many tiles they hold, their name, and their hand once the round ends
export function Seat({ player, pos }) {
  const { okeyState, myHand } = useContext(OkeyContext);
  const name = okeyState.players.find((p) => p.id === player).user?.name;
  const hand = myHand(player);
  const left = hand.filter(Boolean).length;
  const turn = turnOf(okeyState, player);
  return (
    <div className={`seat pos-${pos} ${turn ? "turn" : ""}`} data-seat={player}>
      <div
        className={`avatar ${name ? "" : "empty"}`}
        style={{ "--c": seatColors[player] }}
      >
        {turn && <Timer okeyState={okeyState} />}
        {name && [...name][0].toLocaleUpperCase()}
        {okeyState.rules && okeyState.gameState === "play" && (
          <span className={`tilesLeft ${left === 1 ? "last" : ""}`}>
            {left}
          </span>
        )}
      </div>
      <Name player={player} />
      {shownAtEnd(okeyState) && left > 0 && (
        // the two rows as they were laid out, up to their last tile
        <div className="shown">
          {[0, 13].map((from) => {
            const row = hand.slice(from, from + 13);
            return (
              <div key={from}>
                {row
                  .slice(0, row.findLastIndex(Boolean) + 1)
                  .map((tile, i) =>
                    tile ? (
                      <Tile key={tile.id} tile={tile} disabled />
                    ) : (
                      <div key={i} className="slot" />
                    ),
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A player's discard pile, between them and the next player, who may take
// its top tile; anyone else can catch the latest discard
export function DiscardPile({ player, pos }) {
  const {
    okeyState,
    me,
    myDiscardPile,
    isMyTurn,
    discardTile,
    claimDiscard,
    catchDiscard,
    returnDiscard,
  } = useContext(OkeyContext);
  function onDiscard(tile, index) {
    const took = okeyState.tookDiscard;
    if (tile.source.startsWith("claim-"))
      claimDiscard(null); // put it back
    else if (took?.tileId === tile.id && took.from === player) returnDiscard();
    else discardTile(player, tile, index);
  }
  const pile = myDiscardPile(player);
  const top = pile.at(-1);
  const caught = okeyState.players.some((p) => p.caught?.includes(top?.id));
  // whether it fits a meld is for them to see
  const canCatch =
    okeyState.rules &&
    okeyState.gameState === "play" &&
    me &&
    me !== player &&
    okeyState.melds.length > 0 &&
    top?.id === okeyState.lastDiscard &&
    !caught;
  return (
    <div
      className={`discardPile ${pos === undefined ? "" : `pos-${pos}`}`}
      data-pile={player}
    >
      <h4>{pile.length}</h4>
      <Slot
        type="DISCARD"
        showBorder
        className={
          caught ? "caught" : top?.id === okeyState.lastDiscard ? "latest" : ""
        }
        onDrop={onDiscard}
        tile={top}
        canDiscard={() => isMyTurn(player)}
      />
      {canCatch && (
        <button className="catch" onClick={catchDiscard}>
          {t("Catch")}
        </button>
      )}
    </div>
  );
}

export default Rack;
