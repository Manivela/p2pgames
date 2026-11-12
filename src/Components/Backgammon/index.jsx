import { useLeftHome } from "../../hooks/useStore";
import { Table, useHeard, useTable, useTok } from "../Table";
import { t } from "../../i18n";
import Board from "./Board";
import bot from "./bot";
import { newGame, pips } from "./rules";
import "./backgammon.css";
import Checkers from "../Checkers/Board";
import checkersBot from "../Checkers/bot";
import { newGame as newCheckers } from "../Checkers/rules";

// The room's game at its table (Table: its own Yjs map, the seats, ⋯),
// the rules' state in rules.js; or, its other modes (the site's menu),
// checkers on the back of the case (Checkers/): "checkers" or "dama", a
// game's `mode` saying which (none: backgammon, "tavla")
const newGameOf = (prev, ids, mode) =>
  mode === "tavla" ? newGame(prev, ids) : newCheckers(prev, ids, mode);
const botOf = {
  play: (s, seat) => (s.mode ? checkersBot : bot).play(s, seat),
  wait: (s) => (s.mode ? 900 : bot.wait(s)),
};
// checkers before a game: set up, no one's turn
const blank = (mode) => ({ ...newCheckers(null, [], mode), turn: null });

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

// Everyone hears a piece put down: a checker's toks are the board's
// (Board.jsx, by the stops it shows), a checkers piece's hop one here. A
// new level toks at itself, to be heard as it's set.
function useTableSounds(last) {
  const tak = useTok();
  useHeard(last, ({ kind }) => kind === "hop" && setTimeout(tak, 300), tak);
}

export default function Backgammon() {
  const table = useTable(
    "backgammon",
    newGameOf,
    ["White", "Black"],
    "tavla",
    botOf,
  );
  const { game } = table;
  // the game's own kind, or before one, the one picked
  const mode = game ? (game.mode ?? "tavla") : table.mode;
  const tavla = mode === "tavla";
  const state = game ?? (tavla ? SET_UP : blank(mode));
  useTableSounds(game?.last);
  const { left, setLeft } = useLeftHome();
  return (
    <Table
      table={table}
      mark={(s) => <i className={`bg-dot ${s ? "black" : "white"}`} />}
      info={
        tavla
          ? (s) => ({ value: pips(state.checkers[s]), title: t("Pips to go") })
          : null
      }
      options={
        tavla && (
          <label className="facing">
            {t("Home on the left")}
            <input
              type="checkbox"
              checked={left}
              onChange={(e) => setLeft(e.target.checked)}
            />
          </label>
        )
      }
    >
      {tavla ? (
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
      ) : (
        <Checkers state={state} table={table} />
      )}
    </Table>
  );
}
