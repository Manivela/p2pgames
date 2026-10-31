import { useCallback, useContext, useEffect, useRef, useState } from "react";
import Slot from "./Slot";
import Tile, { TileFace } from "./Tile";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";
import { t } from "../../i18n";
import {
  discardWait,
  isElden,
  pairRound,
  pointsToOpen,
  rackPoints,
  roundOf,
  upForClaim,
} from "./americano";
import { seatColors } from "./constants";
import TeaGlass from "./TeaGlass";
import { ended, partner, placeTiles, rowOf } from "./game";

const turnOf = (s, player) =>
  s.gameState === "play" && s.currentPlayer === player;

// Whose turn it is, filling once in the time they wait before they may
// discard (rack.css), from when the turn reaches this device; full at once
// when they don't. The key starts it again on a new deal with the same
// starter.
const Timer = ({ okeyState }) => (
  <i
    key={`${okeyState.deal}-${okeyState.currentPlayer}`}
    className="timer"
    style={{ "--wait": `${discardWait(okeyState)}s` }}
  >
    <b />
    <b />
  </i>
);

// how many tiles a player holds, while a round is played (one finished
// from the hand doesn't shrink)
function TilesLeft({ player }) {
  const { okeyState, myHand } = useContext(OkeyContext);
  if (okeyState.gameState !== "play" || isElden(okeyState)) return null;
  const left = myHand(player).filter(Boolean).length;
  return (
    <span className={`tilesLeft ${left === 1 ? "last" : ""}`}>{left}</span>
  );
}

// a round opened with points, until you've opened: what your sets and runs
// are worth as they lie on your rack, against what opening takes
function RackPoints({ player }) {
  const { okeyState } = useContext(OkeyContext);
  const { gameState, opened } = okeyState;
  if (gameState !== "play" || opened[player]) return null;
  const { opening } = roundOf(okeyState);
  if (!opening) return null;
  return (
    <span className="badge points">
      {rackPoints(okeyState, player)}/{pointsToOpen(okeyState)}
    </span>
  );
}

// A name and what everyone at the table can see about them, or an empty
// seat to sit in or put a bot in; a bot's seat is anyone's to take over
function Name({ player, children }) {
  const { okeyState, me, sit, seatBot, isAlreadySitting } =
    useContext(OkeyContext);
  const seat = okeyState.players.find((p) => p.id === player);
  const sitHere = !isAlreadySitting && (!seat.user || seat.user.bot) && (
    <button onClick={() => sit(player)}>{t("Sit")}</button>
  );
  if (!seat.user) {
    return (
      <h1 className="playerName">
        {t(`Player ${player}`)}{" "}
        <span className="badges">
          {sitHere}
          <button aria-label={t("Add a bot")} onClick={() => seatBot(player)}>
            🤖
          </button>
        </span>
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
        {playing && okeyState.opened[player] && (
          <span className="badge">{t("opened")}</span>
        )}
        {playing &&
          okeyState.rules?.partners &&
          me &&
          partner(okeyState.players, me)?.id === player && (
            <span className="badge">{t("partner")}</span>
          )}
        {sitHere}
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
    moveTile,
    movedWith,
    drawTile,
    okeyState,
    me,
    claimDiscard,
    takeBack,
    held,
  } = useContext(OkeyContext);
  const offer = upForClaim(okeyState);
  // moving my claim's ghost, or claiming the discard out of turn
  const claim = (tile) =>
    tile.source.startsWith("claim-") ||
    (offer?.tileId === tile.id && me !== okeyState.currentPlayer);
  function onDrop(tile, toIndex) {
    if (claim(tile)) claimDiscard(toIndex);
    else if (tile.source.includes("hand")) moveTile(player, tile, toIndex);
    else if (tile.source === "table") takeBack(tile, toIndex);
    else drawTile(player, tile, toIndex);
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
  // a row's slots (13; 101's 15), empty before a deal, on someone else's
  // rack (watched from outside the game), and once the round ends: the
  // hands are shown
  const over = ended(okeyState);
  const hand = me === player && !over ? myHand(player) : [];
  const width = rowOf(okeyState);

  // A tile held over a slot shows what dropping it there would do
  // (placeTiles): the tiles in its way slide aside, the moved ones leave
  // their slots, and the slots they'd land in are marked.
  // (not useDragLayer: a quick drag on a phone could end before it
  // rendered and leave the tile in the air, index.jsx)
  // Every slot that says the tile is over it, the latest last: a quick drag
  // from one row to the other can have react-dnd say two at once, and the
  // one it then leaves mustn't take the other's preview with it.
  const [hovers, setHovers] = useState([]);
  const onOver = useCallback(
    (index, tile) =>
      setHovers((h) => {
        const rest = h.filter((x) => x.index !== index);
        if (tile) return [...rest, { index, tile }];
        return rest.length === h.length ? h : rest;
      }),
    [],
  );
  const hover = hovers.at(-1);
  const dragging = hover && hand.length > 0 && hover.tile;
  const moved =
    !dragging || claim(dragging)
      ? []
      : dragging.source === `hand-${me}`
        ? hand.filter((t) => t && movedWith(dragging).includes(t.id))
        : okeyState.currentPlayer === me
          ? [dragging]
          : [];
  const ids = moved.map((t) => t.id);
  const preview =
    moved.length > 0 &&
    placeTiles(hand, width, moved, hover.index, dragging.id);
  function slotProps(tile, index) {
    // a discard I made before the wait was over sits on my pile meanwhile
    if (!tile && ghost?.slot === index) {
      return { tile: ghost.tile, className: "ghost" };
    }
    const props = { tile: tile?.id === held ? null : tile };
    if (!preview) return props;
    // a moved tile may land where one of them was: its slot is marked too
    const landing = ids.includes(preview[index]?.id);
    if (tile && ids.includes(tile.id)) {
      return { ...props, className: landing ? "moving over" : "moving" };
    }
    const to = tile ? preview.findIndex((t) => t?.id === tile.id) : index;
    if (to === index) return { ...props, className: landing ? "over" : "" };
    return {
      ...props,
      className: landing ? "aside over" : "aside",
      style: {
        "--dx": (to % width) - (index % width),
        "--dy": Math.floor(to / width) - Math.floor(index / width),
      },
    };
  }
  const row = (from) =>
    Array.from({ length: width }, (_, i) => hand[from + i] ?? null).map(
      (tile, i) => (
        <Slot
          key={from + i}
          index={from + i}
          onDrop={onDrop}
          onOver={onOver}
          {...slotProps(tile, from + i)}
        />
      ),
    );

  const turn = turnOf(okeyState, player);
  return (
    <div
      className={`rack ${turn ? "turn" : ""} ${preview ? "holding" : ""}`}
      style={{ "--row": width }}
      data-seat={player}
    >
      {turn && <Timer okeyState={okeyState} />}
      <div className="top">{row(0)}</div>
      <div className="bottom">{row(width)}</div>
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
            <b className="score">{score > 0 ? `+${score}` : score}</b>
            <div className="tiles">
              {[0, rowOf(okeyState)].map((from) => {
                const row = hand.slice(from, from + rowOf(okeyState));
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
  // the pair round: a tap on a pile spreads all its tiles beside it, to
  // look through; another tap, there or anywhere, puts them back
  const [peek, setPeek] = useState(false);
  const pileRef = useRef();
  const canPeek =
    pairRound(okeyState) && okeyState.rules.peekPairRounds && pile.length > 1;
  useEffect(() => {
    if (!peek) return;
    const away = (e) => !pileRef.current?.contains(e.target) && setPeek(false);
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [peek]);
  const caught = okeyState.players.some((p) => p.caught?.includes(top?.id));
  // my discard, waiting for the others' time to take the last one to end
  const ghost = held && player === me && myHand(me).find((t) => t?.id === held);
  // whether it fits a meld is for them to see
  const canCatch =
    okeyState.gameState === "play" &&
    me &&
    me !== player &&
    okeyState.melds.length > 0 &&
    top?.id === okeyState.lastDiscard &&
    !caught;
  return (
    <div
      ref={pileRef}
      className={`discardPile ${small ? "small" : ""}`}
      data-pile={player}
      onClick={(e) => canPeek && !e.target.closest("button") && setPeek(!peek)}
    >
      <span className="count">{pile.length}</span>
      {peek && canPeek && (
        <div className="peek">
          {pile.map((tile) => (
            <TileFace key={tile.id} id={tile.id} />
          ))}
        </div>
      )}
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
