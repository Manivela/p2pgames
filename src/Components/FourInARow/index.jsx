import { Table, useHeard, useTable, useTok } from "../Table";
import Board from "./Board";
import bot from "./bot";
import { newGame } from "./rules";
import "./fourinarow.css";

// Four in a row at the table (rules.js). Everyone hears a disc land, once
// it's fallen; a new level is heard as one.
export default function FourInARow() {
  const table = useTable("fourinarow", newGame, ["Black", "White"], null, bot);
  // the rack before a game: empty, no one's turn
  const state = table.game ?? { ...newGame(null, []), turn: null };
  const tok = useTok();
  useHeard(
    table.game?.last,
    ({ kind }) => kind === "disc" && setTimeout(tok, 250),
    tok,
  );
  return (
    <Table
      table={table}
      mark={(seat) => <i className={`fr-dot ${seat ? "white" : "black"}`} />}
    >
      <Board state={state} table={table} />
    </Table>
  );
}
