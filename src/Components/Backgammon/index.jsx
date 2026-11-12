import { useLeftHome } from "../../hooks/useStore";
import { Table, useHeard, useTable, useTok } from "../Table";
import { t } from "../../i18n";
import Board from "./Board";
import { newGame, pips } from "./rules";
import "./backgammon.css";

// The room's game at its table (Table: its own Yjs map, the seats, ⋯),
// the rules' state in rules.js

const NO_SEATS = [null, null];

// the board before a game: set up, no dice, no one's turn, no roll yet
// (the first game's opening dice are tossed, Board.jsx)
const SET_UP = {
  ...newGame(null, NO_SEATS, [2, 1]),
  turn: -1,
  by: -1,
  dice: [],
  left: [],
  opening: null,
  rolled: 0,
};

// Everyone hears a checker land: one wooden tok as it comes down (the
// slide in backgammon.css), however many dice took it there, each a little
// different. The dice are heard as they land (Board.jsx). A new level toks
// at itself, to be heard as it's set.
function useTableSounds(last) {
  const tak = useTok();
  useHeard(
    last,
    ({ kind }) => (kind === "move" || kind === "undo") && setTimeout(tak, 330),
    tak,
  );
}

export default function Backgammon() {
  const table = useTable("backgammon", newGame, ["White", "Black"]);
  const { game } = table;
  const state = game ?? SET_UP;
  useTableSounds(game?.last);
  const { left, setLeft } = useLeftHome();
  return (
    <Table
      table={table}
      mark={(s) => <i className={`bg-dot ${s ? "black" : "white"}`} />}
      info={(s) => ({ value: pips(state.checkers[s]), title: t("Pips to go") })}
      options={
        <label className="facing">
          {t("Home on the left")}
          <input
            type="checkbox"
            checked={left}
            onChange={(e) => setLeft(e.target.checked)}
          />
        </label>
      }
    >
      <Board
        state={state}
        live={table.live}
        mine={table.mine}
        viewer={table.near}
        across={table.across}
        left={left}
        names={table.names}
        note={table.note}
        act={table.act}
        deal={table.deal}
      />
    </Table>
  );
}
