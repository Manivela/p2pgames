# p2pgames

Collection of games modified to work over webRTC using [YJS](https://github.com/yjs/yjs) (and peerJS on the [peerjs](https://github.com/Manivela/p2pgames/tree/peerjs) branch)

demo: <https://p2p.yunusgulcu.com/>

### Features

- You are given a room if you just visit the demo page. you can share this room link with your friends to let them join the same room.
- See each others cursors using the YJS awareness api
- See a list of all users in the current room
- play TicTacToe on a sheet of squared paper
  - tap Sit on a name plate to take X or O; anyone else watches
  - X and O are drawn in ink as they're made, and a win struck through; the two take turns to start
  - the last mark can be taken back till the other marks; a tap on the sheet starts the next game
  - Classic or Super, picked on the sheet: nine small boards in a big one, each mark sending the other to the matching small board, three boards in a row to win
- message each other using the very basic messaging UI (disabled for liability concerns)
  - the order of messages should be the same for everyone thanks to the YArray data structure.
  - automatically scrolls when messages start overflowing the container.
- play backgammon (tavla) with another person in your room
  - tap Sit on a name plate to take white or black; anyone else watches
  - each player sees the board from their own side, their home bottom right
  - a picked checker shows where each die takes it and, in one go, where both do (3-2 also shows 5)
  - both dice have to be played when they can, and when only one can, the higher one; a move the rules rule out says why
  - a mars (the other has borne nothing off) counts two, and the score carries from game to game
  - a tap on the dice rolls them, and starts the next game once one's won
  - ⋯ has the home on the left for those who play so
  - the back of the case is a checkerboard: American checkers or Turkish dama, picked on the board between games, against each other or a bot
- play Okey made by [me](https://github.com/Manivela)
  - 2 to 4 players
  - on a computer, D draws from the middle, T takes the discard and Space calls a tile that fits the table; a wrong call costs no points, but after two warnings each one locks calling until everyone has thrown
  - check [wikipedia](https://en.wikipedia.org/wiki/Okey) for the rules
- play Go made by [me](https://github.com/Manivela), on a 9×9, 13×13 or 19×19 board, picked beside your bowl
  - tap Sit on a name plate to take black or white; a tap on your bowl passes
  - counted as the [Tromp-Taylor rules](https://tromp.github.io/go.html) count: two passes in a row end the game and count it, every stone on the board alive (capture dead stones first: it costs nothing), white 7.5 more for moving second; no suicide, and plain ko
  - after a pass the board shows whose each empty point would count for
  - check [wikipedia](https://en.wikipedia.org/wiki/Rules_of_Go) for the rules
- your stats, from the bar chart in ☰: every game you sit at is recorded move by move on your device (IndexedDB) and the stats worked out from the record, so a stat added later counts the games already played: wins, streaks, time played, your nemesis, who takes the discard and who feeds the table at Okey, doubles and hits at backgammon, and more; Export and Import take the record to another device
  - an Okey game over puts a title on the score sheet under anyone who stood out at that game (The Feeder, Hawk-eye…): at least 3 of a thing, and well beyond an even share of the table's; a tap on one says why
  - someone who stands up and sits back down on another device under the same name is one player, in that game and every game either device played
- every game's rules, in brief, are a tap away: ? in the corner, or ⋯ → How to play at the Okey table
- in every two-player game, 🤖 on an empty seat puts a bot in it (in either seat, or both to watch them play), ⋯ lets one device play both sides, and Face to face turns each player's words to them when they sit across the screen

## FAQ

**Q: All players look the same in backgammon?**

**A:** disable dark mode extensions

## Known bugs and improvements

In [TODO.md](TODO.md).

## Running locally

- `npm install`
- `npm run dev`

## License

© Yunus Gülcü. All rights reserved; [ask me](https://github.com/Manivela) if you'd like to use it. Parts made by others keep their own terms: `src/vendor/y-react` (MIT) and the sounds credited in each game.
