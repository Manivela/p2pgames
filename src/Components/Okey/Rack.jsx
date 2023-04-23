import { useState } from "react";
import Slot from "./Slot";
import "./rack.css";

function swapItems(array, fromIndex, toIndex) {
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}
function Rack({ initialHand }) {
  const [hand, setHand] = useState(initialHand);
  function onDrop(tile, toIndex) {
    setHand((oldHand) =>
      swapItems(
        oldHand,
        oldHand.findIndex((t) => t?.id === tile.id),
        toIndex
      )
    );
  }
  return (
    <div className="rack">
      <div className="top">
        {hand.slice(0, 13).map((tile, index) => (
          <Slot key={index} index={index} onDrop={onDrop} tile={tile} />
        ))}
      </div>
      <div className="bottom">
        {hand.slice(13, 26).map((tile, index) => (
          <Slot
            key={index + 13}
            index={index + 13}
            onDrop={onDrop}
            tile={tile}
          />
        ))}
      </div>
    </div>
  );
}

export default Rack;
