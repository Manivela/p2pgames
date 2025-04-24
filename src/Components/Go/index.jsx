import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  const currentUser = useAuthStore((state) => state.currentUser);

  // Get values from ymap directly in the component render
  const boardStateFromMap = ymap.get("boardState");
  const previousBoardStateFromMap = ymap.get("previousBoardState");
  const playerFromMap = ymap.get("player");
  const blackCapturedFromMap = ymap.get("blackCaptured");
  const whiteCapturedFromMap = ymap.get("whiteCaptured");
  const passedFromMap = ymap.get("passed");
  const gameStateFromMap = ymap.get("gameState");
  const usersFromMap = ymap.get("users");

  // Local state as fallback when ymap values aren't available
  const [boardState, setBoardStateLocal] = useState(
    boardStateFromMap || initializeBoard(),
  );
  const [previousBoardState, setPreviousBoardStateLocal] = useState(
    previousBoardStateFromMap || boardState,
  );
  const [player, setPlayerLocal] = useState(playerFromMap || 1);
  const [blackCaptured, setBlackCapturedLocal] = useState(
    blackCapturedFromMap || 0,
  );
  const [whiteCaptured, setWhiteCapturedLocal] = useState(
    whiteCapturedFromMap || 0,
  );
  const [passed, setPassedLocal] = useState(passedFromMap || 0);
  const [gameState, setGameStateLocal] = useState(gameStateFromMap || 0);
  const [users, setUsersLocal] = useState(
    usersFromMap || { black: null, white: null },
  );

  // Update local state when ymap values change
  useEffect(() => {
    if (boardStateFromMap) setBoardStateLocal(boardStateFromMap);
  }, [boardStateFromMap]);

  useEffect(() => {
    if (previousBoardStateFromMap)
      setPreviousBoardStateLocal(previousBoardStateFromMap);
  }, [previousBoardStateFromMap]);

  useEffect(() => {
    if (playerFromMap !== undefined) setPlayerLocal(playerFromMap);
  }, [playerFromMap]);

  useEffect(() => {
    if (blackCapturedFromMap !== undefined)
      setBlackCapturedLocal(blackCapturedFromMap);
  }, [blackCapturedFromMap]);

  useEffect(() => {
    if (whiteCapturedFromMap !== undefined)
      setWhiteCapturedLocal(whiteCapturedFromMap);
  }, [whiteCapturedFromMap]);

  useEffect(() => {
    if (passedFromMap !== undefined) setPassedLocal(passedFromMap);
  }, [passedFromMap]);

  useEffect(() => {
    if (gameStateFromMap !== undefined) setGameStateLocal(gameStateFromMap);
  }, [gameStateFromMap]);

  useEffect(() => {
    if (usersFromMap) setUsersLocal(usersFromMap);
  }, [usersFromMap]);

  const setBoardState = useCallback(
    (value) => {
      setBoardStateLocal(value);
      ymap.set("boardState", value);
    },
    [ymap],
  );

  const setPreviousBoardState = useCallback(
    (value) => {
      setPreviousBoardStateLocal(value);
      ymap.set("previousBoardState", value);
    },
    [ymap],
  );

  const setPlayer = useCallback(
    (value) => {
      setPlayerLocal(value);
      ymap.set("player", value);
    },
    [ymap],
  );

  const setBlackCaptured = useCallback(
    (value) => {
      setBlackCapturedLocal(value);
      ymap.set("blackCaptured", value);
    },
    [ymap],
  );

  const setWhiteCaptured = useCallback(
    (value) => {
      setWhiteCapturedLocal(value);
      ymap.set("whiteCaptured", value);
    },
    [ymap],
  );

  const setPassed = useCallback(
    (value) => {
      setPassedLocal(value);
      ymap.set("passed", value);
    },
    [ymap],
  );

  const setGameState = useCallback(
    (value) => {
      setGameStateLocal(value);
      ymap.set("gameState", value);
    },
    [ymap],
  );

  const setUsers = useCallback(
    (value) => {
      if (!value.black && !value.white) {
        resetGame();
      }
      setUsersLocal(value);
      ymap.set("users", value);
    },
    [ymap],
  );

  useEffect(() => {
    if (ymap.get("boardState") === undefined) {
      const initialBoard = initializeBoard();
      ymap.set("boardState", initialBoard);
      ymap.set("previousBoardState", initialBoard);
      ymap.set("player", 1);
      ymap.set("blackCaptured", 0);
      ymap.set("whiteCaptured", 0);
      ymap.set("passed", 0);
      ymap.set("gameState", 0);
      ymap.set("users", { black: null, white: null });
    }
  }, [ymap]);

  const otherPlayer = useMemo(() => (player === 1 ? 2 : 1), [player]);

  const resetGame = useCallback(() => {
    const newBoard = initializeBoard();
    setBoardState(newBoard);
    setPreviousBoardState(newBoard);
    setPlayer(1);
    setPassed(0);
    setGameState(0);
    setBlackCaptured(0);
    setWhiteCaptured(0);
  }, [
    setBoardState,
    setPreviousBoardState,
    setPlayer,
    setPassed,
    setGameState,
    setBlackCaptured,
    setWhiteCaptured,
  ]);

  const handleIntersectionClick = useCallback(
    (row, col) => {
      if (
        row >= 0 &&
        row < boardState.length &&
        col >= 0 &&
        col < boardState[row].length &&
        boardState[row][col] === 0
      ) {
        const tempBoardState = boardState.map((r) => [...r]);
        tempBoardState[row][col] = player;

        const captures = calculateAndRemoveCapturedPieces(tempBoardState, {
          row,
          col,
        });
        const isSelfCapture =
          !checkDirectLiberties(row, col, tempBoardState, player) &&
          (player !== 2 || captures.blackCaptured === 0) &&
          (player !== 1 || captures.whiteCaptured === 0);

        const isDuplicateBoardState = areBoardStatesEqual(
          tempBoardState,
          previousBoardState,
        );

        if (
          player === 1 &&
          !users.black &&
          users.white?.id !== currentUser.id
        ) {
          setUsers({ ...users, black: currentUser });
        } else if (
          player === 2 &&
          !users.white &&
          users.black?.id !== currentUser.id
        ) {
          setUsers({ ...users, white: currentUser });
        } else {
          if (player === 1 && users.black?.id !== currentUser.id) {
            toast("Not your turn");
            return;
          }
          if (player === 2 && users.white?.id !== currentUser.id) {
            toast("Not your turn");
            return;
          }
        }

        if (isSelfCapture) {
          toast(
            "Invalid move. This move results in self-capture without capturing any enemy stones.",
          );
          return;
        }

        if (isDuplicateBoardState) {
          toast(
            "Invalid move. No stone may be played so as to recreate a former board position.",
          );
          return;
        }

        setPreviousBoardState(boardState);
        setBoardState(tempBoardState);
        setPlayer(otherPlayer);
        setPassed(0);
        setBlackCaptured(blackCaptured + captures.blackCaptured);
        setWhiteCaptured(whiteCaptured + captures.whiteCaptured);
      } else {
        toast(
          "Invalid move. Please choose an empty position within the board.",
        );
      }
    },
    [
      boardState,
      player,
      users,
      currentUser,
      previousBoardState,
      otherPlayer,
      setPreviousBoardState,
      setBoardState,
      setPlayer,
      setPassed,
      setBlackCaptured,
      setWhiteCaptured,
      blackCaptured,
      whiteCaptured,
      setUsers,
    ],
  );

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
        <div>
          black: {users.black?.name || "-"} ({blackCaptured})
          {users.black && users.black.id === currentUser.id && (
            <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setUsers({ ...users, black: null });
              }}
            >
              leave
            </button>
          )}{" "}
          / white: {users.white?.name || "-"} ({whiteCaptured})
          {users.white && users.white.id === currentUser.id && (
            <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setUsers({ ...users, white: null });
              }}
            >
              leave
            </button>
          )}
        </div>
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
