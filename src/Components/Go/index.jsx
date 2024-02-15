import { useState } from "react";
import toast from "react-hot-toast";
import { useMap } from "@joebobmiles/y-react";
import Board from "./Board";
import {
  areBoardStatesEqual,
  calculateAndRemoveCapturedPieces,
  checkDirectLiberties,
} from "./calculateCapture";
import { useAuthStore } from "../../hooks/useStore";

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
  const ymap = useMap("go-state");

  let boardState = ymap.get("boardState");
  const setBoardState = (value) => ymap.set("boardState", value);
  if (boardState === undefined) {
    boardState = initializeBoard();
    setBoardState(boardState);
  }

  const [previousBoardState, setPreviousBoardState] = useState(boardState);

  let player = ymap.get("player");
  const setPlayer = (value) => ymap.set("player", value);
  if (player === undefined) {
    player = 1;
    setPlayer(player);
  }

  let passed = ymap.get("passed");
  const setPassed = (value) => ymap.set("passed", value);
  if (passed === undefined) {
    passed = 1;
    setPassed(passed);
  }

  // 0 = playing, 1 == player 1 win, 2 == player 2 win, 3 == draw
  let gameState = ymap.get("gameState");
  const setGameState = (value) => ymap.set("gameState", value);
  if (gameState === undefined) {
    gameState = 1;
    setGameState(gameState);
  }

  const [currentUser] = useAuthStore((state) => [state.currentUser]);

  const otherPlayer = player === 1 ? 2 : 1;
  function resetGame() {
    const newBoard = initializeBoard();
    setBoardState(newBoard);
    setPreviousBoardState(newBoard);
    setPlayer(1);
    setPassed(0);
    setGameState(0);
  }
  let users = ymap.get("users");
  const setUsers = (value) => {
    if (!value.black && !value.white) {
      // no users left reset game
      resetGame();
    }
    ymap.set("users", value);
  };
  if (users === undefined) {
    users = { black: null, white: null };
    setUsers(users);
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
      // assign players
      if (player === 1 && !users.black && users.white?.id !== currentUser.id) {
        setUsers({ ...users, black: currentUser });
      } else if (
        player === 2 &&
        !users.white &&
        users.black?.id !== currentUser.id
      ) {
        setUsers({ ...users, white: currentUser });
      } else {
        // players assigned > check turn
        if (player === 1 && users.black?.id !== currentUser.id) {
          toast("Not your turn");
          return;
        }
        if (player === 2 && users.white?.id !== currentUser.id) {
          toast("Not your turn");
          return;
        }
      }
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
    <div
      style={{
        position: "relative",
        height: "fit-content",
        width: "fit-content",
      }}
    >
      <div
        style={{
          position: "absolute",
          display: "flex",
          justifyContent: "center",
          padding: 10,
          gap: 10,
          width: "100%",
        }}
      >
        <div>Current player: {player === 1 ? "black" : "white"}</div>
        <div>
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
      </div>
      <Board
        player={player}
        boardState={boardState}
        handleIntersectionClick={handleIntersectionClick}
      />
      <div
        style={{
          position: "absolute",
          display: "flex",
          padding: 10,
          gap: 10,
          width: "100%",
          bottom: 0,
        }}
      >
        <button onClick={resetGame}>Reset Game</button>
      </div>
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
