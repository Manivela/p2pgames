import { useContext, useRef } from "react";
import Slot from "./Slot";
import Tile from "./Tile";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";
import { t } from "../../i18n";
import { rackPoints, upForClaim } from "./americano";
import { seatColors } from "./constants";
import TeaGlass from "./TeaGlass";
import { ended } from "./game";

const turnOf = (s, player) =>
  s.gameState === "play" && s.currentPlayer === player;

// A soft 30 s turn timer (rack.css): it starts when the turn reaches this
// device and loops, never skipping anyone. The key restarts it on a new
// deal with the same starter.
const Timer = ({ okeyState }) => (
  <i key={`${okeyState.deal}-${okeyState.currentPlayer}`} className="timer" />
);

// how many tiles a player holds, while a ruleset's round is played
// (classic hands don't shrink)
function TilesLeft({ player }) {
  const { okeyState, myHand } = useContext(OkeyContext);
  if (!okeyState.rules || okeyState.gameState !== "play") return null;
  const left = myHand(player).filter(Boolean).length;
  return (
    <span className={`tilesLeft ${left === 1 ? "last" : ""}`}>{left}</span>
  );
}

// 101, until you've opened: what your sets and runs are worth as they lie
// on your rack, against what opening takes
function RackPoints({ player }) {
  const { okeyState } = useContext(OkeyContext);
  const { rules, gameState, opened } = okeyState;
  if (!rules?.opening || gameState !== "play" || opened?.[player]) return null;
  return (
    <span className="badge points">
      {rackPoints(okeyState, player)}/{rules.opening.points}
    </span>
  );
}

// A name and what everyone at the table can see about them, or an empty
// seat to sit in
function Name({ player, children }) {
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
      {/* under a seat's name, so the row doesn't shift each turn */}
      <span className="badges">
        {playing && turn && okeyState.drawn && (
          <span className="badge drew">{t("drew")}</span>
        )}
        {playing && okeyState.rules && okeyState.opened[player] && (
          <span className="badge">{t("opened")}</span>
        )}
      </span>
      {playing && turn && <TeaGlass />}
      {children}
    </h1>
  );
}

// Your rack (its tiles show only to you), with your name on its top edge;
// once the round ends, every hand (`hands`, yours first) in place of its
// tiles
function Rack({ player, hands }) {
  const {
    myHand,
    swapTile,
    drawTile,
    okeyState,
    me,
    claimDiscard,
    held,
    unselectAll,
  } = useContext(OkeyContext);
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
  // a discard I made before the wait was over sits on my pile meanwhile
  const slotProps = (tile, index) =>
    !tile && ghost?.slot === index
      ? { tile: ghost.tile, className: "ghost" }
      : { tile: tile?.id === held ? null : tile };
  // 13 slots a row, empty before a deal, on someone else's rack (watched
  // from outside the game), and once the round ends: the hands are shown
  const over = ended(okeyState);
  const hand = me === player && !over ? myHand(player) : [];
  const row = (from) =>
    Array.from({ length: 13 }, (_, i) => hand[from + i] ?? null).map(
      (tile, i) => (
        <Slot
          key={from + i}
          index={from + i}
          onDrop={onDrop}
          {...slotProps(tile, from + i)}
        />
      ),
    );

  // a tap on the rack off the tiles drops the pick; a mouse drag that ends
  // elsewhere clicks what's under both ends, which isn't a tap
  const pressed = useRef();
  const tap = (e) =>
    e.target === pressed.current && !e.target.closest(".tile") && unselectAll();

  const turn = turnOf(okeyState, player);
  return (
    <div
      className={`rack ${turn ? "turn" : ""}`}
      data-seat={player}
      onPointerDown={(e) => (pressed.current = e.target)}
      onClick={tap}
    >
      {turn && <Timer okeyState={okeyState} />}
      <div className="top">{row(0)}</div>
      <div className="bottom">{row(13)}</div>
      {over && <Hands players={hands} />}
      <Name player={player}>
        {me === player && (
          <>
            <RackPoints player={player} />
            <TilesLeft player={player} />
          </>
        )}
      </Name>
    </div>
  );
}

// Someone else at the table: a round avatar in their seat's colour with
// how many tiles they hold, and their name
export function Seat({ player }) {
  const { okeyState } = useContext(OkeyContext);
  const name = okeyState.players.find((p) => p.id === player).user?.name;
  const turn = turnOf(okeyState, player);
  return (
    <div className={`seat ${turn ? "turn" : ""}`} data-seat={player}>
      <div
        className={`avatar ${name ? "" : "empty"}`}
        style={{ "--c": seatColors[player] }}
      >
        {turn && <Timer okeyState={okeyState} />}
        {name && [...name][0].toLocaleUpperCase()}
        <TilesLeft player={player} />
      </div>
      <Name player={player} />
    </div>
  );
}

// Every hand once the round ends, on your rack, with what each scored:
// each as it sat on its rack, so the groups keep their spaces (rack.css)
function Hands({ players }) {
  const { okeyState, myHand } = useContext(OkeyContext);
  const round = okeyState.round - 1;
  return (
    <div className="hands">
      {players.map((player) => {
        const hand = myHand(player);
        if (!hand.some(Boolean)) return null;
        const name = okeyState.players.find((p) => p.id === player).user?.name;
        const score = okeyState.scores?.[player]?.[round];
        return (
          <div key={player} className="hand" data-hand={player}>
            <span className="avatar" style={{ "--c": seatColors[player] }}>
              {name && [...name][0].toLocaleUpperCase()}
            </span>
            {okeyState.rules && (
              <b className="score">{score > 0 ? `+${score}` : score}</b>
            )}
            <div className="tiles">
              {[0, 13].map((from) => {
                const row = hand.slice(from, from + 13);
                return (
                  <span key={from} className="half">
                    {row
                      .slice(0, row.findLastIndex(Boolean) + 1)
                      .map((tile, i) =>
                        tile ? (
                          <Tile key={tile.id} tile={tile} disabled />
                        ) : (
                          <i key={i} className="gap" />
                        ),
                      )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A player's discard pile, between them and the next player, who may take
// its top tile; anyone else can catch the latest discard
export function DiscardPile({ player, small }) {
  const {
    okeyState,
    me,
    myDiscardPile,
    isMyTurn,
    discardTile,
    claimDiscard,
    catchDiscard,
    returnDiscard,
    held,
    myHand,
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
  // my discard, waiting for the others' time to take the last one to end
  const ghost = held && player === me && myHand(me).find((t) => t?.id === held);
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
    <div className={`discardPile ${small ? "small" : ""}`} data-pile={player}>
      <span className="count">{pile.length}</span>
      <Slot
        type="DISCARD"
        showBorder
        className={
          ghost
            ? "ghost"
            : caught
              ? "caught"
              : top?.id === okeyState.lastDiscard
                ? "latest"
                : ""
        }
        onDrop={onDiscard}
        tile={ghost || top}
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
