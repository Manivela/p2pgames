# p2pgames

Collection of games modified to work over webRTC using [YJS](https://github.com/yjs/yjs) (and peerJS on the [peerjs](https://github.com/Manivela/p2pgames/tree/peerjs) branch)

demo: <https://p2p.yunusgulcu.com/>

### Features

- You are given a room if you just visit the demo page. you can share this room link with your friends to let them join the same room.
- See each others cursors using the YJS awareness api
- See a list of all users in the current room
- play TicTacToe using the example project from the react team <https://reactjs.org/tutorial/tutorial.html>
  - players are assigned when they play a move.
  - players can leave and let another player continue.
  - players can't play each others moves.
  - players can use the history feature from the example to continue playing from a move in the past.
  - game is reset if both players leave.
- message each other using the very basic messaging UI (disabled for liability concerns)
  - the order of messages should be the same for everyone thanks to the YArray data structure.
  - automatically scrolls when messages start overflowing the container.
- play backgammon (tavla) with another person in your room, first made from [Bruno Nunes](https://github.com/bnunesc/react-backgammon)'s game
  - tap Sit on a name plate to take white or black; anyone else watches
  - each player sees the board from their own side, their home bottom right
  - a picked checker shows where each die takes it and, in one go, where both do (3-2 also shows 5)
  - both dice have to be played when they can, and when only one can, the higher one; a move the rules rule out says why
  - a mars (the other has borne nothing off) counts two, and the score carries from game to game
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
- play Go made by [me](https://github.com/Manivela)
  - 2 players
  - check [wikipedia](https://en.wikipedia.org/wiki/Rules_of_Go) for the rules

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

### GO

- One side puts down a stone that would take their own group of stones, but it doesn't update until the other side plays.

## Running locally

- `npm install`
- `npm run dev`
