import { create } from "zustand";
import { t } from "../i18n";
import { PRESETS } from "./Okey/rulesets";

// How each game is played, as briefly as it goes, for anyone who comes
// across the site with no one to teach them: what you're after, a turn,
// how it's scored and how it ends; the mode being played's only. Opened
// by the corner's ? (root.jsx), at the Okey table from its ⋯
// (TableMenu.jsx).
const TTT =
  "Take turns marking a square, X first; the other starts the next game.";
const OKEY = [
  "2 to 4 players. 106 tiles: 1 to 13 in four colours, two of each, and two fake okeys.",
  "The tile turned up at the deal is the indicator. The okey, its colour one higher, stands for any tile; a fake okey stands for the okey's own colour and number.",
  "A turn: draw from the middle, or take the tile the player before you threw; then throw one.",
  "Sets: one number in different colours. Runs: one colour in a row. Three tiles or more each.",
];

// by game (the room's, Menu.jsx), then mode (the table's, or the Okey ruleset's
// kind, okeyKind), the first when it's not there
export const RULES = {
  tictactoe: {
    classic: {
      title: "Tic-tac-toe",
      lines: [
        TTT,
        "Three of yours in a row, across, down or diagonally, wins the game and a point.",
      ],
    },
    super: {
      title: "Super tic-tac-toe",
      lines: [
        TTT,
        "Nine small boards in one. Where you mark in a small board sends the other to that board of the nine.",
        "Three in a row takes a small board; three boards in a row win the game and a point. Sent to a board that's decided, play anywhere.",
      ],
    },
  },
  backgammon: {
    tavla: {
      title: "Backgammon",
      lines: [
        "Race your 15 checkers round to your home, the last six points, then bear them off. The first to bear off all 15 wins.",
        "Tap the dice to roll. Each die moves a checker that many points; a double moves four times. Every die that can be played must be.",
        "Two or more of the other's checkers close a point. A lone one is a blot: land on it to hit it, and it goes to the bar.",
        "A checker on the bar comes back in on the other's home board before anything else moves.",
        "A win is a point; a mars, the other having borne none off, is two.",
      ],
    },
    checkers: {
      title: "Checkers",
      lines: [
        "Men step diagonally forward on the dark squares; black moves first.",
        "Jump a piece next to yours, onto the empty square past it, to take it, and jump on while you can. A jump has to be taken.",
        "A man reaching the far row becomes a king, stepping and jumping both ways.",
        "Take or block all the other's pieces to win. 40 moves each with no jump and no man going forward is a draw.",
      ],
    },
    dama: {
      title: "Dama",
      lines: [
        "Men step straight forward or sideways, never back; white moves first.",
        "Jump a piece next to yours to take it, and jump on while you can. A jump has to be taken, and of them the one taking the most.",
        "A man reaching the far row becomes a king: it goes any distance straight, and jumps a piece from afar, landing anywhere past it.",
        "Take or block all the other's pieces to win. A king against a lone man is a draw, as are 40 moves each with no jump and no man going forward.",
      ],
    },
  },
  go: {
    go: {
      title: "Go",
      lines: [
        "Take turns putting a stone on an empty point, black first. Tap your bowl to pass.",
        "Stones with no empty point beside them, alone or joined in a line, are captured.",
        "No stone may go where it would have none, unless it captures; nor may a capture undo the last one at once (ko).",
        "Two passes in a row end the game. Each side counts its stones on the board and the empty points only its stones surround; white gets 7.5 more for going second.",
        "Every stone left counts, so capture the other's dead stones before you pass. After a pass the board shows whose each empty point would be.",
        "The higher count wins the game and a point.",
      ],
    },
  },
  okey: {
    classic: {
      title: "Okey",
      lines: [
        ...OKEY,
        "Finish by laying your whole hand in sets and runs, or seven pairs, as you throw your last tile.",
        "The finisher scores −20, the others the numbers on their tiles (an okey 25). The lowest total wins.",
      ],
    },
    americano: {
      title: "Americano",
      lines: [
        ...OKEY,
        "13 hands, each opened with the melds it names; the last is finished from the hand in one go, nothing laid before.",
        "Once open, lay more melds and add to anyone's; finish by throwing your last tile.",
        "A discard can be claimed out of turn, with a tile from the middle as a penalty; a tile thrown that fits a meld on the table can be caught, and its thrower pays 20.",
        "Finishing scores −20, not opening 100, the rest their tiles (an okey 25); the okey thrown last doubles them. The lowest total after 13 hands wins.",
      ],
    },
    101: {
      title: "101",
      lines: [
        ...OKEY,
        "11 hands. Open with sets and runs worth 101 or more at face value, or with five pairs.",
        "Before you open, take a discard only to open with it that turn; once open, take them as you like, and lay and add to melds.",
        "Finishing scores −101, not opening 202, the rest their tiles (an okey 101); pairs and the okey thrown last double the scores. The lowest total after 11 hands wins.",
      ],
    },
  },
};

// which sheet an Okey ruleset reads by, a table's own too: one hand
// finished from the rack, hands opened by points, or by melds named; none
// picked yet, the first preset's, as the lobby's (GameSettings.jsx)
export const okeyKind = (rules) =>
  !rules
    ? okeyKind(PRESETS[0])
    : rules.rounds.some((r) => r.opening)
      ? "101"
      : rules.rounds.length === 1 && !rules.rounds[0].melds
        ? "classic"
        : "americano";

// the room's table (Table's useTable, Okey's): the mode it plays, for the ?
// and the site's menu; why you can't take the room to another game now
// (null: you can); and a game picked in the menu, { game, mode }, for its
// table to take up (Menu.jsx)
export const usePlaying = create(() => ({ mode: null, why: null, pick: null }));

const rulesOf = (game, mode) =>
  RULES[game][mode] ?? Object.values(RULES[game])[0];

// the rules of `game`'s `mode` on a card over the table; a tap outside
// closes it
export default function HowToPlay({ game, mode, onClose }) {
  const { title, lines } = rulesOf(game, mode);
  return (
    <div className="how-to" onClick={onClose}>
      <div
        className="card"
        role="dialog"
        aria-label={t(title)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* not .close: Bootstrap 3's, all but see-through */}
        <button className="shut" aria-label={t("Close")} onClick={onClose}>
          ×
        </button>
        <h2>{t(title)}</h2>
        <ul>
          {lines.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
