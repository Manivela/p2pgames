# TODO

## Every table

- **Knocking at every table.** Two quick taps on the felt knock on the table, heard by everyone where it landed, only in Okey today (`useKnock` in `Okey/Board.jsx`, `Okey/knock.js`, sent round as presence in `OkeyContext.jsx`). The other games' boards can knock too, from code they share.
- **The other players' hands on the table.** Where each one points, hovers or holds a piece, as their hand reaching over the board. `Awareness.jsx` already sends pointers, in window pixels, and turns them off for Okey and Backgammon: their boards turn for each viewer and differ in size between screens, so the pixels landed in the wrong places. Sent in the board's own terms instead (the piece or spot, or a place across the board as a knock is, from -1 to 1), turned for each viewer.
- **Okey's win sounds at every table.** Okey plays applause when someone finishes a round (`finish.mp3`) and a longer one when the game is over (`won.mp3`), in `OkeyContext.jsx`; the other tables (`Table/index.jsx`) play neither (Tic-tac-toe draws its winning line with a pen sound). Their round and game are one thing until a match length (below) sets when the game ends.
- **Best of X, or first to X.** Before the first game, the players choose how long the match is: best of X games, or first to X points (a mars in Backgammon is two), so the table knows when it's over. Today a score just carries on while the same two sit (`newGame` in each game's `rules.js`), until someone resets it from the ⋯ menu. Okey's best-of-three (under Known) is the same idea. To settle: who chooses it, and whether it can change mid-match.
- **Stats and titles for every game.** Only Okey gives titles. Backgammon's recordings already count rolls, doubles and checkers sent to the bar (`backgammonCounts` in `Stats/history.js`), with no titles from them; Checkers, Go and Tic-tac-toe count nothing. Titles for Backgammon could be the luckiest roller, the one who sends the most checkers to the bar, and the one who always comes in from the bar on the first try (not counted yet).
- **Missed moves at every table,** as Okey's missed finishes (under Okey): a count and a title wherever a game has a clear miss. In Backgammon a hit or a bear-off passed up, in Tic-tac-toe a win or a block. To settle: which games have one (Checkers' captures may be forced already; Go's misses aren't clear-cut).
- **How long each player takes to play.** A turn's time, from the turn reaching a player to their move, in the stats: each player's typical turn over a game and over all their games, with titles for the quickest and the slowest at a table. Every table already records each step with when the page saw it (`at`, from `step` in `Stats/history.js`), so it can be worked out from what's recorded, even for games played before. To settle: average or median, so one long wait (a phone call, a closed tab) doesn't decide it; whether bots count; and that it only shows the time, never hurries anyone (nothing times out).
- **The name plates are too narrow.** At the two-player tables, a six-letter name shows as three letters and "…" on desktop, with plenty of room beside it. The column the plates sit in is a fixed 190px (`.tb-head` in `Table/table.css`).
- **Two players in a room who can't see each other.** At a four-player Okey table, two of the players couldn't see each other, while the other two saw both of them and were seen by both. One of the two reloaded again and again until they could. Pages find each other through y-webrtc (`useWebRtc` in `vendor/y-react`, `signalingServers` and `peerOpts` in `constants.js`, the TURN relay from `/api/turn`), one connection per pair. A connection missing between those two doesn't explain it alone, as y-webrtc passes each page's presence and the game on through the others. Next time, before anyone reloads, on both pages: whom each is connected to (`provider.room.webrtcConns`) and whose presence it has (`provider.awareness.getStates()`), neither reachable from the live site's console today, and what "can't see" looked like (a seat empty or marked away, or a name missing). Presence matters at the table too: a page that stops hearing a seated player marks them gone (`markGone` in `Okey/okey.js`).

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
- **Ghosts act as any tile.** A tile waiting on your rack (a claim until the current player discards, or a draw until the others' time to catch the discard is up) is a ghost (`ghost` in `Rack.jsx`) and acts unlike the rest: it can only be dragged about the rack, and let go anywhere else it's withdrawn; the other tiles don't make room for it, so one dropped on its slot hides it; it can't be tapped into a pick or flipped (`myTile` in `Tile.jsx`: its source isn't the hand). Americano's preview of a tile held over a meld is a ghost too (`Ghost` in `AmericanoTable.jsx`), drawn as a bare face with a yellow outline (`.meld .ghost` in `rack.css`); it shows as the tile itself instead. Nothing in the game calls for the rack's ghost to differ: it's apart only because it isn't in the hand yet (a hand is written only by its owner, and a claim can still be lost), so this page's rack can show it in the hand until it's won. A claim lost leaves an empty slot where the ghost was, and a waiting tile can't be laid on a meld or thrown until the tile is won. Cancel stays on the Take button, which already turns into Cancel while it waits.

### Known

- In a partners game, "opened" (or "just opened") beside "partner" under a short name runs into the next pile, in English ("eş" fits in Turkish). It ran into it before the badges moved under the avatar too.
- Sitting down or adding a bot mid-round replaces the table, so a move someone makes in that same moment is lost (their tile snaps back). A version that loses nothing: the joining page only takes the seat, and the page whose turn it is deals them in through their inbox, as out-of-turn takes do. Worth it once players report it.
- The titles on the score sheet at a game's end are the same on every page: each page that recorded the game posts its summary's players to the room, and every page puts them together, the most any page counted, which a page that missed 101's take put back overcounts (`useSharedSummary` in `Stats/store.js`, `together` in `Stats/history.js`). What each device keeps for its stats (the stats dialog) is still its own recording's, so a page that missed steps keeps fewer titles there; to settle with the long-term storage, when the same people don't always play together. Too few titles may be given out: the bar for one (`LEAST` 3, `Z` 1.5, the same for every count) decides how often.
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
- **Card games: Pişti, King.** Batak is the first (`Batak/`), its deck, deal, card face and trick taker shared in `Cards/` for these to take up, at the shared table seating four (`Table/`), each hand shown only to its player. To settle: what else they share (King's tricks are Batak's).
- **Batak, more of it.** Played today as İhaleli Batak for four on their own: a bid of 5 to 13, each seat's tricks, less the bid for a bidder short of it or anyone else who took none. Not there yet: eşli (partners across), two or three players, the ×10 scores some apps keep, sounds, cards sliding to the trick and to who took it, and a match length (under Best of X).
- **Yacht.** Five dice, rolled up to three times a turn, scored in a card of categories. Its own name, not Yahtzee's (a trademark). It can roll Backgammon's dice.
- **Dominoes.** Tiles laid end to end, matching numbers, for two to four players. To settle: which game (block, draw, or one scored by the ends, like All Fives), partners at four as in Okey's eşli, and what it takes from the Okey table (tiles in a rack, the seats round a table).
- **Word tiles.** A crossword game: letter tiles laid on a grid to make words, scored by letter and square. To settle: its own board and letter values (not a trademarked game's), which word list checks a word in English and in Turkish, and whether a word is checked when it's played or only when another player challenges it.
