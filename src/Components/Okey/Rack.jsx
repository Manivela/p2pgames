import { useCallback, useContext, useEffect, useRef, useState } from "react";
import Slot from "./Slot";
import Tile, { TileFace } from "./Tile";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";
import { t } from "../../i18n";
import { useKey } from "../../hooks/useKey";
import {
  canPeek as peekable,
  callLocked,
  catchDiscard,
  claimDiscard,
  drawTile as drawRule,
  returnDiscard,
  cantCatch,
  discardWait,
  freeSlot,
  isCaught,
  isElden,
  pointsToOpen,
  rackPoints,
  roundOf,
  upForClaim,
  ended,
  partner,
  penaltySlot,
  placeTiles,
  rowOf,
  seatAt,
} from "./okey";
import { seatColors } from "./constants";
import TeaGlass from "./TeaGlass";

// a claim's penalty tile on the rack before it's drawn: face down, as no
// one knows it yet
const PENALTY = { id: "penalty", source: "claim", hidden: true };

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
  const drew = okeyState.currentPlayer === player && okeyState.drawn;
  return (
    <span
      className={`tilesLeft ${drew ? "drew" : ""} ${left === 1 ? "last" : ""}`}
    >
      {left}
    </span>
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
// (a seat round the table, on its avatar: `avatarSits`)
function Name({ player, avatarSits, children }) {
  const { okeyState, me, sit, seatBot } = useContext(OkeyContext);
  const seat = seatAt(okeyState, player);
  const bot = seat.user?.bot && !avatarSits;
  const sitHere = !me && (!seat.user || bot) && (
    <button onClick={() => sit(player)}>{t("Sit")}</button>
  );
  // a seat whose player dropped out shows who it's waiting for
  if (!seat.user) {
    const away = seat.away && seat.awayName;
    return (
      <h1 className="playerName">
        {away ? <span className="name">{away}</span> : t(`Player ${player}`)}{" "}
        <span className="badges">
          {seat.away && <span className="badge away">{t("away")}</span>}
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
        {/* round the table, the tile count says it (TilesLeft) */}
        {playing && turn && okeyState.drawn && !avatarSits && (
          <span className="badge drew">{t("drew")}</span>
        )}
        {playing &&
          okeyState.opened[player] &&
          (okeyState.justOpened === player ? (
            <span className="badge just">{t("just opened")}</span>
          ) : (
            <span className="badge">{t("opened")}</span>
          ))}
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
    act,
    takeBack,
    held,
    unhold,
    waiting,
  } = useContext(OkeyContext);
  const offer = upForClaim(okeyState);
  // claiming the discard out of turn
  const claim = (tile) =>
    offer?.tileId === tile.id && me !== okeyState.currentPlayer;
  // My claim on the discard, or my draw while the others have time to
  // catch the discard, waits as a ghost in the slot I dropped it on
  // (OkeyContext's `waiting`): moved along the rack as any tile, the others
  // making room for it; dragged off the rack, it's withdrawn. A claim's
  // penalty tile, unknown till it's drawn, a blank ghost where it'll land.
  const ghost = me === player &&
    waiting && {
      ...waiting,
      cancel: waiting.claim ? () => act(claimDiscard, me, null) : unhold,
    };
  const isGhost = (tile) => !!ghost && tile?.id === ghost.tile.id;
  function onDrop(tile, toIndex) {
    if (isGhost(tile) || tile.source.includes("hand")) {
      moveTile(player, tile, toIndex);
    } else if (tile.source.startsWith("claim-") || claim(tile)) {
      // a claim, or its ghost just won or lost: refused then, not a draw
      act(claimDiscard, me, toIndex);
    } else if (tile.source === "table") takeBack(tile, toIndex);
    else drawTile(player, tile, toIndex);
  }
  // a row's slots (13; 101's 15), empty before a deal, on someone else's
  // rack (watched from outside the game), and once the round ends: the
  // hands are shown
  const over = ended(okeyState);
  const hand = me === player && !over ? myHand(player) : [];
  const width = rowOf(okeyState, player);
  // the rack as it shows: the ghost in its slot with the rest
  const shown = [...hand];
  if (ghost && ghost.slot >= 0 && !shown[ghost.slot]) {
    shown[ghost.slot] = ghost.tile;
  }
  const penalty = ghost?.claim ? penaltySlot(hand, ghost.slot, width) : -1;

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
  // the same as the move will do (okey.moveTiles, placeAround): over the
  // rack as it shows, the ghost one of its tiles
  const moved = !dragging
    ? []
    : isGhost(dragging) || dragging.source === `hand-${me}`
      ? shown.filter((t) => t && movedWith(dragging).includes(t.id))
      : claim(dragging) || okeyState.currentPlayer === me
        ? [dragging]
        : [];
  const ids = moved.map((t) => t.id);
  const preview =
    moved.length > 0 &&
    placeTiles(shown, width, moved, hover.index, dragging.id);
  function slotProps(tile, index) {
    if (!tile && index === penalty && !preview) {
      return { tile: PENALTY, className: "ghost", disabled: true };
    }
    const ghostly = isGhost(tile);
    const props = {
      tile: tile?.id === held ? null : tile,
      ...(ghostly && { onDragOff: ghost.cancel }),
    };
    const cls = (...c) => [ghostly && "ghost", ...c].filter(Boolean).join(" ");
    if (!preview) return { ...props, className: cls() };
    // a moved tile may land where one of them was: its slot is marked too
    const landing = ids.includes(preview[index]?.id);
    if (tile && ids.includes(tile.id)) {
      return { ...props, className: cls("moving", landing && "over") };
    }
    const to = tile ? preview.findIndex((t) => t?.id === tile.id) : index;
    if (to === index) return { ...props, className: cls(landing && "over") };
    return {
      ...props,
      className: cls("aside", landing && "over"),
      style: {
        "--dx": (to % width) - (index % width),
        "--dy": Math.floor(to / width) - Math.floor(index / width),
      },
    };
  }
  const row = (from) =>
    Array.from({ length: width }, (_, i) => shown[from + i] ?? null).map(
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
// how many tiles they hold, your partner's with a 🤝 on it, and their
// name. A bot's, while you watch, is the Sit that takes it over: under its
// name, beside drew and opened, the next pile would cover it. (The partner
// sign was a word among the badges, and ran into the next pile beside
// "just opened" under a short name.)
export function Seat({ player }) {
  const { okeyState, sit, me } = useContext(OkeyContext);
  const partnered =
    okeyState.gameState === "play" &&
    okeyState.rules?.partners &&
    me &&
    partner(okeyState.players, me)?.id === player;
  const user = seatAt(okeyState, player).user;
  const name = user?.name;
  const turn = turnOf(okeyState, player);
  const takeOver = !me && user?.bot;
  const Avatar = takeOver ? "button" : "div";
  return (
    <div className={`seat ${turn ? "turn" : ""}`} data-seat={player}>
      <Avatar
        className={`avatar ${name ? "" : "empty"} ${takeOver ? "sit" : ""}`}
        style={{ "--c": seatColors[player] }}
        {...(takeOver && {
          "aria-label": t("Sit"),
          onClick: () => sit(player),
        })}
      >
        {turn && <Timer okeyState={okeyState} />}
        {takeOver ? t("Sit") : name && [...name][0].toLocaleUpperCase()}
        <TilesLeft player={player} />
        {partnered && (
          <span
            className="partnerMark"
            role="img"
            title={t("partner")}
            aria-label={t("partner")}
          >
            🤝
          </span>
        )}
      </Avatar>
      <Name player={player} avatarSits />
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
              {[0, rowOf(okeyState, player)].map((from) => {
                const row = hand.slice(from, from + rowOf(okeyState, player));
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
    act,
    held,
    heldDraw,
    unhold,
    myHand,
    drawTile,
  } = useContext(OkeyContext);
  function onDiscard(tile, index) {
    const took = okeyState.tookDiscard;
    if (took?.tileId === tile.id && took.from === player)
      act(returnDiscard, me);
    else discardTile(player, tile, index);
  }
  const pile = myDiscardPile(player);
  const top = pile.at(-1);
  // the pair round: a tap on a pile spreads all its tiles beside it, to
  // look through; another tap, there or anywhere, puts them back
  const [peek, setPeek] = useState(false);
  const pileRef = useRef();
  const canPeek = pile.length > 1 && peekable(okeyState);
  useEffect(() => {
    if (!peek) return;
    const away = (e) => !pileRef.current?.contains(e.target) && setPeek(false);
    addEventListener("pointerdown", away);
    return () => removeEventListener("pointerdown", away);
  }, [peek]);
  const caught = isCaught(okeyState, top?.id);
  // my discard, waiting for the others' time to take the last one to end
  const ghost = held && player === me && myHand(me).find((t) => t?.id === held);
  // Call! for the latest discard, whoever threw it, always over the pile
  // left of your rack, beside Take: two answers to the same tile, a thumb
  // away (along the top it would lie on the melds or on the tile you'd
  // drag). Its pile glows (latest). Whether it fits a meld is for them to
  // see.
  const latest = okeyState.lastDiscard;
  const canCatch = !small && player !== me && me && !cantCatch(okeyState, me);
  // wrong calls lock it a while (okey.catchDiscard): pressed, it says so
  const locked = canCatch && callLocked(okeyState, me);
  // Take: the discard onto your rack, as dragging it there does
  // (Rack's onDrop), for whom a drag is hard. On your turn the previous
  // discard, waiting out the others' time to catch it; out of turn the one
  // on offer, claimed (outOfTurnTakes). Only when the rule would let it.
  // While it waits, a ghost on the rack, it's Cancel, as dragging the
  // ghost off is.
  const offer = upForClaim(okeyState);
  const claimed =
    offer && okeyState.players.find((p) => p.id === me)?.claim?.id === offer.id;
  const slot = me ? freeSlot(myHand(me), rowOf(okeyState, me)) : -1;
  const lets = (s) => s && typeof s !== "string";
  function takeButton() {
    if (small || player === me || !me) return null;
    if (heldDraw?.tile.source === `discard-${player}`)
      return { cancel: unhold };
    if (claimed) return { cancel: () => act(claimDiscard, me, null) };
    if (heldDraw || slot < 0) return null;
    if (isMyTurn()) {
      return top && lets(drawRule(okeyState, me, top, slot))
        ? { tile: top.id, press: () => drawTile(me, top, slot, true) }
        : null;
    }
    return offer && lets(claimDiscard(okeyState, me, slot))
      ? { tile: offer.tileId, press: () => act(claimDiscard, me, slot) }
      : null;
  }
  const take = takeButton();
  const press = {
    catch: canCatch && (() => act(catchDiscard, me)),
    take: take && (take.cancel ?? take.press),
  };
  useKey(" ", press.catch);
  useKey("t", press.take);
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
        // the latest discard lies turned on the tile before it, both in sight
        under={
          !ghost &&
          !caught &&
          top?.id === okeyState.lastDiscard &&
          pile.length > 1 && (
            <span className="under" aria-hidden="true">
              <TileFace id={pile.at(-2).id} />
            </span>
          )
        }
        canDiscard={() => isMyTurn(player)}
      />
      {take && (
        <button
          className="take"
          onClick={(e) => {
            // or Space, meant to call, would press it again
            e.currentTarget.blur();
            press.take();
          }}
        >
          {take.cancel ? (
            t("Cancel")
          ) : (
            <>
              <TileFace id={take.tile} />
              {t("Take")}
            </>
          )}
          <kbd>T</kbd>
        </button>
      )}
      {canCatch && (
        <button
          className={locked ? "catch locked" : "catch"}
          onClick={press.catch}
        >
          {/* which tile: it may lie on another pile */}
          <TileFace id={latest} />
          {t("Call!")}
          <kbd>{t("Space")}</kbd>
        </button>
      )}
    </div>
  );
}

export default Rack;
