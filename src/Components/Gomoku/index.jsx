import { Table, useTable } from "../Table";
import Board from "../Go/Board";
import { useStoneSounds } from "../Go";
import bot from "./bot";
import * as rules from "./rules";

// Five in a row at the table, on Go's board with Go's stones and sounds,
// by its own rules (rules.js)
export default function Gomoku() {
  const table = useTable(
    "gomoku",
    rules.newGame,
    ["Black", "White"],
    String(rules.SIZE),
    bot,
  );
  // the board before a game: empty, no one's turn
  const state = table.game ?? { ...rules.newGame(null, []), turn: null };
  useStoneSounds(table.game);
  return (
    <Table
      table={table}
      mark={(seat) => <i className={`go-dot ${seat ? "white" : "black"}`} />}
    >
      <Board state={state} table={table} rules={rules} />
    </Table>
  );
}
