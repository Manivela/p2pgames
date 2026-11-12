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
  - ⋯ picks Classic or Super: nine small boards in a big one, each mark sending the other to the matching small board, three boards in a row to win
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
- play a very basic implementation of Minecraft made by [danba340](https://github.com/danba340/minecraft-react)
  - players are assigned a random color when they first join the main room and the spheres use this color.
  - player location is updated for all players using the YJS awareness api
  - players can place blocks on the ground or on another block by clicking
  - blocks placed by one player will be placed for all players
  - players can remove blocks using the <kbd>Alt</kbd>+<kbd>Click</kbd>
  - you can place other block types by changing the active block type using <kbd>1</kbd>,<kbd>2</kbd>,<kbd>3</kbd>,<kbd>4</kbd>,<kbd>5</kbd> keys
- play Okey made by [me](https://github.com/Manivela)
  - 2 to 4 players
  - check [wikipedia](https://en.wikipedia.org/wiki/Okey) for the rules
- play Go made by [me](https://github.com/Manivela), on a 9×9, 13×13 or 19×19 board (⋯)
  - tap Sit on a name plate to take black or white; a tap on your bowl passes
  - counted as the [Tromp-Taylor rules](https://tromp.github.io/go.html) count: two passes in a row end the game and count it, every stone on the board alive (capture dead stones first: it costs nothing), white 7.5 more for moving second; no suicide, and plain ko
  - after a pass the board shows whose each empty point would count for
  - check [wikipedia](https://en.wikipedia.org/wiki/Rules_of_Go) for the rules
- in every two-player game, ⋯ lets one device play both sides, and Face to face turns each player's words to them when they sit across the screen

## FAQ

**Q: All players look the same in backgammon?**

**A:** disable dark mode extensions

**Q: My computer struggles with the minecraft example**

**A:** make sure hardware acceleration is enabled in your browser

## Known bugs and improvements

### Minecraft

- other players movement isn't very natural we should use physics to move players instead of setting their positions this would also enable doing player collisions.
- we should change the player model from a sphere to a rectangle similar to how minecraft has it to get more accurate movement.
- ground should be made out of cubes instead of being a special plane to allow players to dig and get the preview when placing a cube.
- change cube breaking to holding LMB on a cube instead of using the <kbd>alt</kbd> modifier key

### Okey

- Ask to redistribute the tiles or end the games when no tiles are left
- Fix css for player names and tiles
- Add timers and scoring
- if there is a connection issue tile from the middle can be seen before it goes back
- Add a way to move whole groups of tiles at once
- Possible memory leak, animations stopped working after a while and Chrome crashed

## Running locally

- `npm install`
- `npm run dev`
