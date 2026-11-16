# TODO

## Every table

- **Knocking at every table.** Two quick taps on the felt knock on the table, heard by everyone where it landed, only in Okey today (`useKnock` in `Okey/Board.jsx`, `Okey/knock.js`, sent round as presence in `OkeyContext.jsx`). The other games' boards can knock too, from code they share.
- **The other players' hands on the table.** Where each one points, hovers or holds a piece, as their hand reaching over the board. `Awareness.jsx` already sends pointers, in window pixels, and turns them off for Okey and Backgammon: their boards turn for each viewer and differ in size between screens, so the pixels landed in the wrong places. Sent in the board's own terms instead (the piece or spot, or a place across the board as a knock is, from -1 to 1), turned for each viewer.
- **Okey's win sounds at every table.** Okey plays applause when someone finishes a round (`finish.mp3`) and a longer one when the game is over (`won.mp3`), in `OkeyContext.jsx`; the other tables (`Table/index.jsx`) play neither (Tic-tac-toe draws its winning line with a pen sound). Their round and game are one thing until a match length (below) sets when the game ends.
- **Best of X, or first to X.** Before the first game, the players choose how long the match is: best of X games, or first to X points (a mars in Backgammon is two), so the table knows when it's over. Today a score just carries on while the same two sit (`newGame` in each game's `rules.js`), until someone resets it from the ⋯ menu. Okey's best-of-three (under Known) is the same idea. To settle: who chooses it, and whether it can change mid-match.
- **Stats and titles for every game.** Only Okey gives titles. Backgammon's recordings already count rolls, doubles and checkers sent to the bar (`backgammonCounts` in `Stats/history.js`), with no titles from them; Checkers, Go and Tic-tac-toe count nothing. Titles for Backgammon could be the luckiest roller, the one who sends the most checkers to the bar, and the one who always comes in from the bar on the first try (not counted yet).
- **Missed moves at every table,** as Okey's missed finishes (under Okey): a count and a title wherever a game has a clear miss. In Backgammon a hit or a bear-off passed up, in Tic-tac-toe a win or a block. To settle: which games have one (Checkers' captures may be forced already; Go's misses aren't clear-cut).
- **The name plates are too narrow.** At the two-player tables, a six-letter name shows as three letters and "…" on desktop, with plenty of room beside it. The column the plates sit in is a fixed 190px (`.tb-head` in `Table/table.css`).

## Okey

### To design

- **Tips.** Open question first: tips about using the table (two taps knock, a right click turns the fake okey, a box drawn picks tiles, a pile tapped spreads on the pair round) or tips about play? The Okey CLAUDE.md rules out hints about what to lay ("make hands faster, not smarter"), so play tips would revisit that.
- **Spectator mode.** Today a page that doesn't sit down already watches: it sees the table from the first seat, every rack face down, and can sit down between rounds or from the ⋯ menu mid-round. To settle: what a spectator sees (a chosen seat's view? hands shown?), whether the players see who's watching, and whether watching is a choice on arriving instead of only a full table.

- **More colours and more numbers.** Rulesets that set how many colours the tiles come in and how high the numbers go, beside `tileSets` (copies of each tile).
- **The claim's extra tile from the discarder.** A ruleset setting beside `outOfTurnTakes`: the extra tile a claim brings (Americano's) comes from the hand of the player who threw the discard, picked by them, instead of from the pile. To settle: whether the table waits on their pick, and which tile a bot gives. The tile reaches the claimant through their inbox, as a hand is written only by its owner.
- **Everyone starts the next round.** The button that starts the next round (and the next game) waits for every player in the game to press it, showing who has pressed it and who hasn't. To settle: whether a bot counts as pressed, and what happens when a player who hasn't pressed is away (a closed tab).
- **Chatbox.** Two channels: a lobby chat for the whole table and an eşli chat between partners. Voice recordings can be sent as well as text. (`main.jsx` and `root.jsx` still have a commented-out `Chat` route and nav link from an older chat.)
- **Missed finishes in the stats.** A count of turns where a player could have finished but threw a tile instead, with a title for whoever misses the most (beside `TITLES` in `Stats/history.js`). A recording already notes where every tile is (`okeyView`), so it can be worked out from what's recorded. To settle: what counts as a miss (the hand after the draw passes `checkFinished`, or also a finish the player would have had to rearrange their tiles to see), whether bots are counted, and the title's name.
- **The latest discard turned slightly.** The tile thrown last lies a little rotated on its pile, so it's clear what was thrown this turn and what was left on a pile from the turn before. Nothing marks it today.

### Known

- In a partners game, "opened" (or "just opened") beside "partner" under a short name runs into the next pile, in English ("eş" fits in Turkish). It ran into it before the badges moved under the avatar too.
- Sitting down or adding a bot mid-round replaces the table, so a move someone makes in that same moment is lost (their tile snaps back). A version that loses nothing: the joining page only takes the seat, and the page whose turn it is deals them in through their inbox, as out-of-turn takes do. Worth it once players report it.
- The stats' titles don't match between players of the same game, and too few are given out. Each page works out titles from its own recording (`summarize` in `Stats/history.js`), so a page that missed steps counts fewer, but nobody has checked that this is the only cause. The bar for a title (`LEAST` 3, `Z` 1.5, the same for every count) is what decides how often one is given.
- Not yet: "devam" (×4), best-of-three matches.
- README's "Known bugs and improvements" for Okey is out of date (reshuffling the pile, scoring and moving groups of tiles are done).

## Backgammon

- **"It's a game" before the end.** When the outcome is clear, a player can offer to end the game early instead of playing out the rest, offered only when the game isn't close. To settle: what counts as not close (no contact left and a big lead in pips?), whether the other player has to accept, and whether it scores a mars when the loser hasn't borne any checkers off. Like any move that ends a game, it lives in the ⋯ menu behind a second tap.
- **The other player's last move shown.** Their checkers slide into place, then nothing marks where they came from or went. A mark on both until the next roll, as Okey's latest discard (under Okey).
- **Forced moves play themselves.** When the dice can be played only one way, or the order of bearing off can't change anything, the game plays them after the roll. To settle: whether the checkers slide as if played, and whether a player can turn it off.
- **A double tap on a checker moves it,** with no spot to pick. To settle: by which die, or both; the game picking the better way (below) decides.
- **Cocked dice, rarely.** Once in a long while a die lands on a checker or leans against the frame and is thrown again, as at a real table. Rare enough to be funny.
- **The game picks the die.** When a tap or a drag can be played more than one way, the game plays the better one, so the player never chooses a die. Today `targets` (`rules.js`) prefers the way that hits more, then the one with fewer dice; the bot's `value` (`bot.js`) could rank the rest.

- A point with more than five checkers shows how many on its top one (`Board.jsx`), though the stack already closes up to fit the point and every checker can be seen. The number can go.

## New games

- **Word tiles.** A crossword game: letter tiles laid on a grid to make words, scored by letter and square. To settle: its own board and letter values (not a trademarked game's), which word list checks a word in English and in Turkish, and whether a word is checked when it's played or only when another player challenges it.
