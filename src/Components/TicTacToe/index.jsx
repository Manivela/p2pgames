import React from "react";
import "./ttt.modules.css";

function Square(props) {
  return (
    <button className="square" onClick={props.onClick}>
      {props.value}
    </button>
  );
}

class Board extends React.Component {
  renderSquare(i) {
    return (
      <Square
        value={this.props.squares[i]}
        onClick={() => this.props.onClick(i)}
      />
    );
  }

  render() {
    return (
      <div>
        <div className="board-row">
          {this.renderSquare(0)}
          {this.renderSquare(1)}
          {this.renderSquare(2)}
        </div>
        <div className="board-row">
          {this.renderSquare(3)}
          {this.renderSquare(4)}
          {this.renderSquare(5)}
        </div>
        <div className="board-row">
          {this.renderSquare(6)}
          {this.renderSquare(7)}
          {this.renderSquare(8)}
        </div>
      </div>
    );
  }
}

export default class TicTacToe extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      history: [
        {
          squares: Array(9).fill(null),
        },
      ],
      stepNumber: 0,
      xIsNext: true,
      error: "",
    };
    const handleData = (data) => {
      if (data.type === "ttt") {
        console.log("receive data: ", data);
        if (this.state.stepNumber === 0) {
          // assign players on the first move
          this.props.setPlayers((prevPlayers) =>
            prevPlayers.map((p) => {
              if (p.id === this.props.id) {
                return { ...p, ticTacToe: "O" };
              } else {
                return { ...p, ticTacToe: "X" };
              }
            })
          );
        }
        this.setState(data.data);
      }
    };
    props.setDataListeners((prevDataListeners) => [
      ...prevDataListeners,
      handleData,
    ]);
  }

  handleClick(i) {
    const nextPlayer = this.state.xIsNext ? "X" : "O";
    if (this.state.stepNumber === 0) {
      // assign players on the first move
      this.props.setPlayers((prevPlayers) =>
        prevPlayers.map((p) => {
          if (p.id === this.props.id) {
            return { ...p, ticTacToe: "X" };
          } else {
            return { ...p, ticTacToe: "O" };
          }
        })
      );
    } else {
      if (
        !(
          this.props.players.find((p) => p.id === this.props.id) &&
          this.props.players.find((p) => p.id === this.props.id).ticTacToe ===
            nextPlayer
        )
      ) {
        this.setState({
          error: "Not your turn",
        });
        return;
      }
    }

    const history = this.state.history.slice(0, this.state.stepNumber + 1);
    const current = history[history.length - 1];
    const squares = current.squares.slice();
    if (calculateWinner(squares) || squares[i]) {
      return;
    }
    squares[i] = nextPlayer;
    const newState = {
      history: history.concat([
        {
          squares: squares,
        },
      ]),
      stepNumber: history.length,
      xIsNext: !this.state.xIsNext,
      error: "",
    };
    this.setState(newState);
    this.props.sendData({ type: "ttt", data: newState });
  }

  jumpTo(step) {
    this.setState({
      stepNumber: step,
      xIsNext: step % 2 === 0,
    });
  }

  render() {
    const history = this.state.history;
    const current = history[this.state.stepNumber];
    const winner = calculateWinner(current.squares);

    const moves = history.map((step, move) => {
      const desc = move ? "Go to move #" + move : "Go to game start";
      return (
        <li key={move}>
          <button onClick={() => this.jumpTo(move)}>{desc}</button>
        </li>
      );
    });

    let status;
    if (winner) {
      status = "Winner: " + winner;
    } else {
      status = "Next player: " + (this.state.xIsNext ? "X" : "O");
    }

    return (
      <>
        <div className="game">
          <div className="game-board">
            <Board
              squares={current.squares}
              onClick={(i) => this.handleClick(i)}
            />
          </div>
          <div className="game-info">
            <div>{status}</div>
            <ol>{moves}</ol>
          </div>
        </div>
        <div className="error">{this.state.error}</div>
      </>
    );
  }
}

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
