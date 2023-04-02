import { useArray, useMap } from "@joebobmiles/y-react";
import { useEffect, useState } from "react";
import "./ttt.modules.css";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../../hooks/useStore";

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
  let currentMove = ymap.get("currentMove");
  const setCurrentMove = (value) => ymap.set("currentMove", value);
  let history = ymap.get("history");
  const setHistory = (value) => ymap.set("history", value);
  let users = ymap.get("users");
  const setUsers = (value) => {
    if (!value.x && !value.o) {
      // no users left reset game
      setCurrentMove(0);
      setHistory([Array(9).fill(null)]);
    }
    ymap.set("users", value);
  };
  const [currentUser] = useAuthStore((state) => [state.currentUser]);

  if (users === undefined) {
    users = { x: null, o: null };
    setUsers(users);
  }

  if (history === undefined) {
    history = [Array(9).fill(null)];
    setHistory(history);
  }
  if (currentMove === undefined) {
    currentMove = 0;
    setCurrentMove(currentMove);
  }
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove];

  function handlePlay(nextSquares) {
    // assign players
    if (xIsNext && !users.x && users.o?.id !== currentUser.id) {
      setUsers({ ...users, x: currentUser });
    } else if (!xIsNext && !users.o && users.x?.id !== currentUser.id) {
      setUsers({ ...users, o: currentUser });
    } else {
      // players assigned > check turn
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
  }

  function jumpTo(nextMove) {
    setCurrentMove(nextMove);
  }

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
