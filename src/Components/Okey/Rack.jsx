import { useContext } from "react";
import Slot from "./Slot";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";

function Rack({ initialHand, ...props }) {
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
  } = useContext(OkeyContext);
  function onDrop(tile, toIndex) {
    if (tile.source.includes("hand")) {
      swapTile(props.player, tile, toIndex);
    } else {
      drawTile(props.player, tile, toIndex);
    }
  }
  function onDiscard(tile, index) {
    discardTile(props.player, tile, index);
  }
  const sittingPlayer = okeyState.players.find((p) => p.id === props.player);

  return (
    <div className="rack" {...props}>
      {(me === props.player || okeyState.gameState === "finish") && (
        <>
          <div className="top">
            {myHand(props.player)
              .slice(0, 13)
              .map((tile, index) => (
                <Slot
                  key={props.player + index}
                  index={index}
                  onDrop={(a, b) => onDrop(a, b)}
                  tile={tile}
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
                  tile={tile}
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
          onDrop={onDiscard}
          tile={
            myDiscardPile(props.player)[myDiscardPile(props.player).length - 1]
          }
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
          {sittingPlayer.user.name}{" "}
          {sittingPlayer.user.id === currentUser.id && (
            <button onClick={() => stand(props.player)}>Stand</button>
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
          Player {props.player}{" "}
          {!isAlreadySitting && (
            <button onClick={() => sit(props.player)}>Sit</button>
          )}
        </h1>
      )}
    </div>
  );
}

export default Rack;
