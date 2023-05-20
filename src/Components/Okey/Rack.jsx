import { useContext } from "react";
import Slot from "./Slot";
import "./rack.css";
import { OkeyContext } from "./OkeyContext";

function Rack({ initialHand, ...props }) {
  const { isMyTurn, myHand, myDiscardPile, discardTile, swapTile, drawTile } =
    useContext(OkeyContext);
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
  return (
    <div className="rack" {...props}>
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
      <Slot
        type="DISCARD"
        showBorder
        className="discardPile"
        onDrop={onDiscard}
        tile={
          myDiscardPile(props.player)[myDiscardPile(props.player).length - 1]
        }
        canDiscard={() => isMyTurn(props.player)}
      />
      <h1>Player {props.player}</h1>
    </div>
  );
}

export default Rack;
