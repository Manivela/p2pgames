import { useState } from "react";
import Slot from "./Slot";
import "./rack.css";

function swapItems(array, fromIndex, toIndex) {
  console.log("swapItems: ", fromIndex, toIndex);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}

function removeItem(array, fromIndex) {
  console.log("removeItem: ", fromIndex);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[fromIndex] = null;

  return newArray;
}

function insertItem(array, toIndex, item) {
  console.log("insertItem: ", toIndex, item);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[toIndex] = item;

  return newArray;
}

function Rack({ initialHand, ...props }) {
  const [hand, setHand] = useState(initialHand);
  console.log("hand: ", hand);
  const [discarded, setDiscarded] = useState([]);
  function onDrop(tile, toIndex) {
    setHand((oldHand) => {
      const existing = oldHand.findIndex((t) => t?.id === tile.id);
      return existing !== -1
        ? swapItems(oldHand, existing, toIndex)
        : insertItem(oldHand, toIndex, tile);
    });
  }
  function onDiscard(tile, index) {
    setHand((oldHand) =>
      removeItem(
        oldHand,
        oldHand.findIndex((h) => h?.id === tile.id)
      )
    );
    setDiscarded((oldDiscarded) => [...oldDiscarded, tile]);
  }
  const canDiscard = hand.length > 14;
  return (
    <div className="rack" {...props}>
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
      <Slot
        type="DISCARD"
        showBorder
        className="discardPile"
        onDrop={onDiscard}
        tile={discarded[discarded.length - 1]}
        canDiscard={canDiscard}
      />
    </div>
  );
}

export default Rack;
