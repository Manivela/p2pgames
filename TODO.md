# TODO

## Every table

- **The other players' hands on the table.** Where each one points, hovers or holds a piece, as their hand reaching over the board. `Awareness.jsx` already sends pointers, in window pixels, and turns them off for Okey and Backgammon: their boards turn for each viewer and differ in size between screens, so the pixels landed in the wrong places. Sent in the board's own terms instead (the piece or spot, or a place across the board as a knock is, from -1 to 1), turned for each viewer.
- **Best of X, or first to X.** Before the first game, the players choose how long the match is: best of X games, or first to X points (a mars in Backgammon is two), so the table knows when it's over. Batak plays matches already (its deals, picked in ⋯ before one starts, its rows on the shared `ScoreSheet`, a dealer's turn between deals); the two-player tables' score just carries on while the same two sit (`newGame` in each game's `rules.js`), until someone resets it from the ⋯ menu. Okey's best-of-three (under Known) is the same idea. To settle: who chooses it, and whether it can change mid-match.
- **Stats and titles for every game.** Only Okey gives titles. Backgammon's recordings already count rolls, doubles and checkers sent to the bar (`backgammonCounts` in `Stats/history.js`), with no titles from them; Checkers, Go and Tic-tac-toe count nothing. Titles for Backgammon could be the luckiest roller, the one who sends the most checkers to the bar, and the one who always comes in from the bar on the first try (not counted yet).
- **Missed moves at every table,** as Okey's missed finishes (under Okey): a count and a title wherever a game has a clear miss. In Backgammon a hit or a bear-off passed up, in Tic-tac-toe a win or a block. To settle: which games have one (Checkers' captures may be forced already; Go's misses aren't clear-cut).
- **How long each player takes to play.** A turn's time, from the turn reaching a player to their move, in the stats: each player's typical turn over a game and over all their games, with titles for the quickest and the slowest at a table. Every table already records each step with when the page saw it (`at`, from `step` in `Stats/history.js`), so it can be worked out from what's recorded, even for games played before. To settle: average or median, so one long wait (a phone call, a closed tab) doesn't decide it; whether bots count; and that it only shows the time, never hurries anyone (nothing times out).
- **Hitches on players' devices, in Sentry.** Choppy discards were felt on the deployed site, but on a fast Mac a discard's work fits in a frame (`Okey/PERF.md`), and Sentry can't say what players see. Its tracing (the loader, `main.jsx`) records only page loads and how fast a tap is answered, never frames during play. What it does see is the main thread, while the likelier causes aren't there: a GPU stall, or a browser capping the frame rate (Opera GX's limiter, Chrome's Energy Saver at 30 fps). A probe for that: only while something moves (a flight in `moves.js`, a drag, never all the time, as a frame loop always running costs a laptop's battery), it times each frame with requestAnimationFrame. A frame over 50 ms is a hitch, from the game's code if Chrome's long-animation-frame entries cover it, from the GPU or the browser if not; a steady frame time near 33 ms is a capped frame rate. Each hitch goes to Sentry as it happens, unsampled (the quota's ample): how long, which cause, what was moving, the frame time around it and the browser, through the loader's `window.Sentry`.
- **Two players in a room who can't see each other.** At a four-player Okey table, two of the players couldn't see each other, while the other two saw both of them and were seen by both. One of the two reloaded again and again until they could. Pages find each other through y-webrtc (`useWebRtc` in `vendor/y-react`, `signalingServers` and `peerOpts` in `constants.js`, the TURN relay from `/api/turn`), one connection per pair. A connection missing between those two doesn't explain it alone, as y-webrtc passes each page's presence and the game on through the others. Next time, before anyone reloads, both of them send ⋯ → Report a problem, saying what they see: the report carries whom the page is connected to and whose presence it has, beside each seat's presence key (`connections.json` in Sentry, from `window.room` in `root.jsx`, which the console reads too). Then compare the two: whom each is connected to (by y-webrtc peer id), whose presence each has (by awareness client id, a seat's `userKey`), and what "can't see" looked like (a seat empty or marked away, or a name missing). Presence matters at the table too: a page that stops hearing a seated player marks them gone (`markGone` in `Okey/okey.js`).

## Okey

### To design

- **Tips.** Open question first: tips about using the table (two taps knock, a right click turns the fake okey, a box drawn picks tiles, a pile tapped spreads on the pair round) or tips about play? The Okey CLAUDE.md rules out hints about what to lay ("make hands faster, not smarter"), so play tips would revisit that.
- **Spectator mode.** Today a page that doesn't sit down already watches: it sees the table from the first seat, every rack face down, and can sit down between rounds or from the ⋯ menu mid-round. To settle: what a spectator sees (a chosen seat's view? hands shown?), whether the players see who's watching, and whether watching is a choice on arriving instead of only a full table.

- **More colours and more numbers.** Rulesets that set how many colours the tiles come in and how high the numbers go, beside `tileSets` (copies of each tile).
- **The claim's extra tile from the discarder.** A ruleset setting beside `outOfTurnTakes`: the extra tile a claim brings (Americano's) comes from the hand of the player who threw the discard, picked by them, instead of from the pile. To settle: whether the table waits on their pick, and which tile a bot gives. The tile reaches the claimant through their inbox, as a hand is written only by its owner.
- **Chatbox.** Two channels: a lobby chat for the whole table and an eşli chat between partners. Voice recordings can be sent as well as text. (`main.jsx` and `root.jsx` still have a commented-out `Chat` route and nav link from an older chat.)
- **Missed finishes in the stats.** A count of turns where a player could have finished but threw a tile instead, with a title for whoever misses the most (beside `TITLES` in `Stats/history.js`). A recording already notes where every tile is (`okeyView`), so it can be worked out from what's recorded. To settle: what counts as a miss (the hand after the draw passes `checkFinished`, or also a finish the player would have had to rearrange their tiles to see), whether bots are counted, and the title's name.
- **Flipping the tile waiting on your rack.** Its ghost (a claim, or a draw waiting out the others' time to catch the discard: `waiting` in `OkeyContext.jsx`) acts as any tile but this: it can't be turned face down, as a flip is written to the hand (`flipTile`) and the tile isn't in the hand till it's won. A flip kept on the page and made once the tile is won would do.

### Known

- Sitting down or adding a bot mid-round replaces the table, so a move someone makes in that same moment is lost (their tile snaps back). A version that loses nothing: the joining page only takes the seat, and the page whose turn it is deals them in through their inbox, as out-of-turn takes do. Worth it once players report it.
- The stats dialog keeps each device's own recording, so a page that missed steps keeps fewer titles there than the score sheet showed (it takes the most any page counted: `together` in `Stats/history.js`, which a page that missed 101's take put back overcounts); to settle with the long-term storage, when the same people don't always play together. Too few titles may be given out: the bar for one (`LEAST` 3, `Z` 1.5, the same for every count) decides how often.
- A discard costs a 9–12 ms task on a fast Mac, inside a frame, two to four times that on a slower device: a third of it a bot's claim check, then React re-rendering the whole table. Where it goes, what would cut it and how to measure it (`perf/`): `Okey/PERF.md`.
- Not yet: "devam" (×4), best-of-three matches.
- From the README's old list, not seen since: with a bad connection, a tile drawn from the middle shows before it goes back; animations stopped after a long session and Chrome crashed (a memory leak?).

## Backgammon

- **"It's a game" before the end.** When the outcome is clear, a player can offer to end the game early instead of playing out the rest, offered only when the game isn't close. To settle: what counts as not close (no contact left and a big lead in pips?), whether the other player has to accept, and whether it scores a mars when the loser hasn't borne any checkers off. Like any move that ends a game, it lives in the ⋯ menu behind a second tap.
- **Forced moves play themselves.** When the dice can be played only one way, or the order of bearing off can't change anything, the game plays them after the roll. To settle: whether the checkers slide as if played, and whether a player can turn it off.
- **A double tap on a checker moves it,** with no spot to pick. To settle: by which die, or both; the game picking the better way (below) decides.
- **Cocked dice, rarely.** Once in a long while a die lands on a checker or leans against the frame and is thrown again, as at a real table. Rare enough to be funny.
- **The game picks the die.** When a tap or a drag can be played more than one way, the game plays the better one, so the player never chooses a die. Today `targets` (`rules.js`) prefers the way that hits more, then the one with fewer dice; the bot's `value` (`bot.js`) could rank the rest.

## New games

Two-player board games can sit at the shared table (`Table/`), as Backgammon, Checkers, Go and Tic-tac-toe do.

- **Chess.** On Checkers' 8×8 board.
- **Mangala.** Two rows of six pits and a store each, sown round the board, captured by evens and by landing in an empty pit of your own.
- **Five in a row (Gomoku).** On the Go board, with a win check like Tic-tac-toe's.
- **Four in a row.** Discs dropped into columns. Its own name, not Connect Four's (a trademark).
- **Dots and boxes.** On Tic-tac-toe's paper, with its pen sound.
- **Kızma Birader (Ludo).** Two to four race their pieces round the board, sending each other home. Rolls Backgammon's dice.
- **Yılan merdiven (Snakes and ladders).** Pure luck, for kids; rolls Backgammon's dice.
- **Tombala.** Numbers drawn from a bag, marked on everyone's cards; any number of players.
- **İsim Şehir Hayvan.** A letter drawn, everyone writes a name, a city, an animal… starting with it; a word someone else wrote too scores less. To settle: who judges a word.
- **Amiral Battı (Battleship).** Each fleet hidden from the other, as Okey's hands are.
- **Adam asmaca (Hangman).** On Tic-tac-toe's paper, with its pen.
- **Mahjong.** Four players and tiles, Okey's cousin. A big one: many tiles, and scoring with many rules.
- **Crazy Eights.** Cards matched by suit or number, an eight changes the suit (Uno's game, without its name, a trademark).
- **Poker (Texas hold'em).** Chips, not money. Hands hidden as Okey's are.
- **SOS.** S or O written on a grid in turns; an "SOS" in a line scores and plays again. On Tic-tac-toe's paper, with its pen.
- **Papaz kaçtı (Old Maid).** Cards drawn from each other's hands, pairs laid down; whoever is left with the odd king loses. For kids.
- **21 (Blackjack).** Against a dealer: a bot, or a player who deals. Chips, not money, as Poker's.
- **Bilardo (pool) and Carrom.** Aim, then a shot's strength, the balls or pieces rolling where it sends them. To settle: whether every page runs the same physics from the shot, or the shooter's page sends where everything stopped.
- **Puzzles solved together: Sudoku, Minesweeper.** Both players on the same board at once, not in turns.
- **Jigsaw puzzles together.** Everyone dragging pieces onto one picture. Freely licensed pictures, or a player's own, sent to the others' pages as the game is.
- **Memory (Hafıza).** Cards face down, two turned a turn, a pair kept and played again; most pairs wins.
- **Kelime avı (word search) together.** Everyone finding the hidden words in one grid at once. The grid is made from the word list Word tiles and Draw and guess use.
- **Draw and guess.** One player draws a word, the others guess it. On Tic-tac-toe's paper, with its pen. To settle: the word lists, in English and Turkish.
- **Card games: Pişti, King.** On Batak's deck, deal, card face, trick taker and sounds (`Cards/`), at the shared table seating four (`Table/`), each hand shown only to its player. To settle: what else they share (King's tricks are Batak's).
- **Batak, more of it.** Eşli (partners across), two or three players, the ×10 scores some apps keep, and a match to a points target as well as a number of deals.
- **Yacht.** Five dice, rolled up to three times a turn, scored in a card of categories. Its own name, not Yahtzee's (a trademark). It can roll Backgammon's dice.
- **Dominoes.** Tiles laid end to end, matching numbers, for two to four players. To settle: which game (block, draw, or one scored by the ends, like All Fives), partners at four as in Okey's eşli, and what it takes from the Okey table (tiles in a rack, the seats round a table).
- **Word tiles.** A crossword game: letter tiles laid on a grid to make words, scored by letter and square. To settle: its own board and letter values (not a trademarked game's), which word list checks a word in English and in Turkish, and whether a word is checked when it's played or only when another player challenges it.
