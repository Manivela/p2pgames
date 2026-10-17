import { useContext } from "react";
import Slot from "./Slot";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";
import { t } from "../../i18n";

function Rack({ initialHand, className = "", ...props }) {
  const {
    isMyTurn,
    myHand,
    myDiscardPile,
    discardTile,
    swapTile,
    drawTile,
    sit,
    okeyState,
    isAlreadySitting,
    stand,
    currentUser,
    me,
    claimDiscard,
  } = useContext(OkeyContext);
  const { offer } = okeyState;
  function onDrop(tile, toIndex) {
    if (tile.source.startsWith("claim-")) {
      claimDiscard(toIndex); // move the ghost
    } else if (tile.source.includes("hand")) {
      swapTile(props.player, tile, toIndex);
    } else if (offer?.tileId === tile.id && me !== okeyState.currentPlayer) {
      claimDiscard(toIndex); // out-of-turn take
    } else {
      drawTile(props.player, tile, toIndex);
    }
  }
  function onDiscard(tile, index) {
    if (tile.source.startsWith("claim-"))
      claimDiscard(null); // put it back
    else discardTile(props.player, tile, index);
  }
  const sittingPlayer = okeyState.players.find((p) => p.id === props.player);
  const top = myDiscardPile(props.player).at(-1);
  const caught = okeyState.players.some((p) => p.caught?.includes(top?.id));
  // my claim on the discard waits as a ghost in the slot I dropped it on
  const offered =
    offer &&
    !okeyState.players.some((p) => p.caught?.includes(offer.tileId)) &&
    okeyState.players.find((p) => p.id === offer.from)?.discardPile.at(-1);
  const ghost = me === props.player &&
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
  const americano =
    okeyState.mode === "americano" && okeyState.gameState === "play";
  const tilesLeft = myHand(props.player).filter(Boolean).length;

  return (
    <div className={`rack ${className}`} {...props}>
      {(me === props.player ||
        ["finish", "roundEnd"].includes(okeyState.gameState)) && (
        <>
          <div className="top">
            {myHand(props.player)
              .slice(0, 13)
              .map((tile, index) => (
                <Slot
                  key={props.player + index}
                  index={index}
                  onDrop={(a, b) => onDrop(a, b)}
                  {...slotProps(tile, index)}
                />
              ))}
          </div>
          <div className="bottom">
            {myHand(props.player)
              .slice(13, 26)
              .map((tile, index) => (
                <Slot
                  key={props.player + index + 13}
                  index={index + 13}
                  onDrop={onDrop}
                  {...slotProps(tile, index + 13)}
                />
              ))}
          </div>
        </>
      )}
      <div
        className="discardPile"
        style={{
          transform: props.style.discardTransform,
        }}
      >
        <h4>{myDiscardPile(props.player).length}</h4>
        <Slot
          type="DISCARD"
          showBorder
          className={
            caught
              ? "caught"
              : top?.id === okeyState.lastDiscard
                ? "latest"
                : ""
          }
          onDrop={onDiscard}
          tile={top}
          canDiscard={() => isMyTurn(props.player)}
        />
      </div>
      {sittingPlayer.user ? (
        <h1
          className={`playerName ${
            okeyState.currentPlayer === props.player ? "active" : ""
          }`}
          style={{
            transform: props.player !== me ? props.style.nameTransform : "",
          }}
        >
          <span className="name">{sittingPlayer.user.name}</span>{" "}
          {americano && okeyState.opened[props.player] && (
            <span className="badge">{t("opened")}</span>
          )}
          {americano && tilesLeft === 1 && (
            <span className="badge last">{t("1 tile")}</span>
          )}
          {sittingPlayer.user.id === currentUser.id && (
            <button onClick={() => stand(props.player)}>{t("Stand")}</button>
          )}
        </h1>
      ) : (
        <h1
          className="playerName"
          style={{
            transform:
              props.player !== me ? props.style.nameTransform : undefined,
          }}
        >
          {t(`Player ${props.player}`)}{" "}
          {!isAlreadySitting && (
            <button onClick={() => sit(props.player)}>{t("Sit")}</button>
          )}
        </h1>
      )}
    </div>
  );
}

export default Rack;
