import { useState } from "react";
import toast from "react-hot-toast";
import Board from "./Board";
import {
  areBoardStatesEqual,
  calculateAndRemoveCapturedPieces,
  checkDirectLiberties,
} from "./calculateCapture";

export const BOARD_SIZE = 9;

function initializeBoard() {
  const initialState = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    initialState.push([]);
    for (let j = 0; j < BOARD_SIZE; j++) {
      initialState[i].push(0);
    }
  }
  return initialState;
}

export default function Go() {
  const [boardState, setBoardState] = useState(initializeBoard);
  const [previousBoardState, setPreviousBoardState] = useState(boardState);
  const [player, setPlayer] = useState(1);
  const [passed, setPassed] = useState(0);
  const [gameState, setGameState] = useState(0); // 0 = playing, 1 == player 1 win, 2 == player 2 win, 3 == draw

  const otherPlayer = player === 1 ? 2 : 1;
  function resetGame() {
    const newBoard = initializeBoard();
    setBoardState(newBoard);
    setPreviousBoardState(newBoard);
    setPlayer(1);
    setPassed(0);
    setGameState(0);
  }

  function handleIntersectionClick(row, col) {
    // First, check if the position is within the board bounds and the intersection is empty
    if (
      row >= 0 &&
      row < boardState.length &&
      col >= 0 &&
      col < boardState[row].length &&
      boardState[row][col] === 0
    ) {
      // Create a temporary board state to check the validity of the move
      const tempBoardState = boardState.map((r) => [...r]);
      tempBoardState[row][col] = player;

      // Check if the move results in capturing any enemy stones
      const captures = calculateAndRemoveCapturedPieces(tempBoardState, {
        row,
        col,
      }); // Assuming this function returns the number of captures
      const isValidMove =
        checkDirectLiberties(row, col, tempBoardState, player) ||
        (player === 2 && captures.blackCaptured > 0) ||
        (player === 1 && captures.whiteCaptured > 0);

      if (isValidMove) {
        if (!areBoardStatesEqual(tempBoardState, previousBoardState)) {
          console.log(
            `${player === 1 ? "black" : "white"} played ${row}, ${col}`
          );
          setPreviousBoardState(boardState);
          setBoardState(tempBoardState);
          setPlayer(otherPlayer);
          setPassed(0);
        } else {
          toast(
            "Invalid move. No stone may be played so as to recreate a former board position."
          );
        }
      } else {
        toast(
          "Invalid move. This move results in self-capture without capturing any enemy stones."
        );
      }
    } else {
      toast("Invalid move. Please choose an empty position within the board.");
    }
  }

  return (
    <div style={{ position: "relative", height: "fit-content" }}>
      <div
        style={{
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          padding: 10,
        }}
      >
        <button
          onClick={() => {
            if (passed === otherPlayer) {
              setGameState(3);
            }
            setPassed(player);
            setPlayer(otherPlayer);
            toast(`${player === 1 ? "black" : "white"} skipped`);
          }}
        >
          Pass turn
        </button>
      </div>
      <Board
        player={player}
        boardState={boardState}
        handleIntersectionClick={handleIntersectionClick}
      />
      {gameState !== 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
          }}
        >
          {gameState === 3 && <div style={{ fontSize: 72 }}>Draw</div>}
          <button onClick={resetGame}>Reset</button>
        </div>
      )}
    </div>
  );
}
