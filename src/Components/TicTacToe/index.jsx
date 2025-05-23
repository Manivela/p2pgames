import React, { useState, useEffect, useCallback } from "react";
import { useMap } from "@joebobmiles/y-react";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../../hooks/useStore";
import "./ttt.modules.css";

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

function Square({ value, onSquareClick }) {
  return (
    <button className="square" onClick={onSquareClick}>
      {value}
    </button>
  );
}

function Board({ xIsNext, squares, onPlay }) {
  function handleClick(i) {
    if (calculateWinner(squares) || squares[i]) {
      return;
    }
    const nextSquares = squares.slice();
    if (xIsNext) {
      nextSquares[i] = "X";
    } else {
      nextSquares[i] = "O";
    }
    onPlay(nextSquares);
  }

  const winner = calculateWinner(squares);
  let status;
  if (winner) {
    status = `Winner: ${winner}`;
  } else {
    status = `Next player: ${xIsNext ? "X" : "O"}`;
  }

  return (
    <>
      <div className="status">{status}</div>
      <div className="board-row">
        <Square value={squares[0]} onSquareClick={() => handleClick(0)} />
        <Square value={squares[1]} onSquareClick={() => handleClick(1)} />
        <Square value={squares[2]} onSquareClick={() => handleClick(2)} />
      </div>
      <div className="board-row">
        <Square value={squares[3]} onSquareClick={() => handleClick(3)} />
        <Square value={squares[4]} onSquareClick={() => handleClick(4)} />
        <Square value={squares[5]} onSquareClick={() => handleClick(5)} />
      </div>
      <div className="board-row">
        <Square value={squares[6]} onSquareClick={() => handleClick(6)} />
        <Square value={squares[7]} onSquareClick={() => handleClick(7)} />
        <Square value={squares[8]} onSquareClick={() => handleClick(8)} />
      </div>
    </>
  );
}

export default function Game() {
  const ymap = useMap("tictactoe-state");
  const currentUser = useAuthStore((state) => state.currentUser);

  // Get values from ymap directly in the component render
  const currentMoveFromMap = ymap.get("currentMove");
  const historyFromMap = ymap.get("history");
  const usersFromMap = ymap.get("users");

  // Local state with fallbacks when ymap values aren't available
  const [currentMove, setCurrentMoveLocal] = useState(currentMoveFromMap || 0);
  const [history, setHistoryLocal] = useState(
    historyFromMap || [Array(9).fill(null)],
  );
  const [users, setUsersLocal] = useState(usersFromMap || { x: null, o: null });

  // Update local state when ymap values change
  useEffect(() => {
    if (currentMoveFromMap !== undefined)
      setCurrentMoveLocal(currentMoveFromMap);
  }, [currentMoveFromMap]);

  useEffect(() => {
    if (historyFromMap) setHistoryLocal(historyFromMap);
  }, [historyFromMap]);

  useEffect(() => {
    if (usersFromMap) setUsersLocal(usersFromMap);
  }, [usersFromMap]);

  const setCurrentMove = useCallback(
    (value) => {
      setCurrentMoveLocal(value);
      ymap.set("currentMove", value);
    },
    [ymap],
  );

  const setHistory = useCallback(
    (value) => {
      setHistoryLocal(value);
      ymap.set("history", value);
    },
    [ymap],
  );

  const setUsers = useCallback(
    (value) => {
      if (!value.x && !value.o) {
        setCurrentMove(0);
        setHistory([Array(9).fill(null)]);
      }
      setUsersLocal(value);
      ymap.set("users", value);
    },
    [ymap, setCurrentMove, setHistory],
  );

  useEffect(() => {
    if (ymap.get("currentMove") === undefined) {
      ymap.set("currentMove", 0);
      ymap.set("history", [Array(9).fill(null)]);
      ymap.set("users", { x: null, o: null });
    }
  }, [ymap]);

  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];

  const handlePlay = useCallback(
    (nextSquares) => {
      if (xIsNext && !users.x && users.o?.id !== currentUser.id) {
        setUsers({ ...users, x: currentUser });
      } else if (!xIsNext && !users.o && users.x?.id !== currentUser.id) {
        setUsers({ ...users, o: currentUser });
      } else {
        if (xIsNext && users.x?.id !== currentUser.id) {
          toast("Not your turn");
          return;
        }
        if (!xIsNext && users.o?.id !== currentUser.id) {
          toast("Not your turn");
          return;
        }
      }
      const nextHistory = [...history.slice(0, currentMove + 1), nextSquares];
      setHistory(nextHistory);
      setCurrentMove(nextHistory.length - 1);
    },
    [
      xIsNext,
      users,
      currentUser,
      history,
      currentMove,
      setUsers,
      setHistory,
      setCurrentMove,
    ],
  );

  const jumpTo = useCallback(
    (nextMove) => {
      setCurrentMove(nextMove);
    },
    [setCurrentMove],
  );

  const moves = history.map((squares, move) => {
    let description;
    if (move > 0) {
      description = `Go to move #${move}`;
    } else {
      description = "Go to game start";
    }
    return (
      <li key={move}>
        <button onClick={() => jumpTo(move)}>{description}</button>
      </li>
    );
  });

  return (
    <>
      <ul>
        <li>
          X: <span>{users.x?.name}</span>
          {users.x && users.x.id === currentUser.id && (
            <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setUsers({ ...users, x: null });
              }}
            >
              leave
            </button>
          )}
        </li>
        <li>
          O: <span>{users.o?.name}</span>
          {users.o && users.o.id === currentUser.id && (
            <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setUsers({ ...users, o: null });
              }}
            >
              leave
            </button>
          )}
        </li>
      </ul>
      <div className="game">
        <div className="game-board">
          <Board
            xIsNext={xIsNext}
            squares={currentSquares}
            onPlay={handlePlay}
          />
        </div>
        <div className="game-info">
          <ol>{moves}</ol>
        </div>
      </div>
    </>
  );
}
