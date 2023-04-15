import { useState } from "react";
import Board from "./Board";
import { calculateAndRemoveCapturedPieces } from "./calculateCapture";

export function getNextPlayer(boardState) {
  let blackStones = 0;
  let whiteStones = 0;

  for (let i = 0; i < boardState.length; i++) {
    for (let j = 0; j < boardState[i].length; j++) {
      if (boardState[i][j] === 1) {
        blackStones++;
      } else if (boardState[i][j] === 2) {
        whiteStones++;
      }
    }
  }

  return blackStones === whiteStones ? 1 : 2;
}

export const BOARD_SIZE = 19;
export default function Go() {
  const [boardState, setBoardState] = useState(() => {
    const initialState = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      initialState.push([]);
      for (let j = 0; j < BOARD_SIZE; j++) {
        initialState[i].push(0);
      }
    }
    return initialState;
  });

  function handleIntersectionClick(row, col, player) {
    // Create a new copy of the board state array
    const newBoardState = [...boardState];
    newBoardState[row][col] = player;
    console.log(`${player === 1 ? "black" : "white"} played ${row}, ${col}`);
    calculateAndRemoveCapturedPieces(newBoardState);
    // Update the state of the board with the new array
    setBoardState(newBoardState);
  }
  return (
    <Board
      boardState={boardState}
      handleIntersectionClick={handleIntersectionClick}
    />
  );
}
