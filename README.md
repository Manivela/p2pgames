# p2pgames

Collection of games modified to work over webRTC using [YJS](https://github.com/yjs/yjs) (and peerJS on the [peerjs](https://github.com/Manivela/p2pgames/tree/peerjs) branch)

demo: https://p2p.yunusgulcu.com/

### Features:

- You are given a room if you just visit the demo page. you can share this room link with your friends to let them join the same room.
- See each others cursors using the YJS awareness api
- See a list of all users in the current room
- play TicTacToe using the example project from the react team https://reactjs.org/tutorial/tutorial.html
  - players are assigned when they play a move.
  - players can leave and let another player continue.
  - players can't play each others moves.
  - players can use the history feature from the example to continue playing from a move in the past.
  - game is reset if both players leave.
- message each other using the very basic messaging UI
  - the order of messages should be the same for everyone thanks to the YArray data structure.
  - automatically scrolls when messages start overflowing the container.
- play the backgammon game made by [Bruno Nunes](https://github.com/bnunesc/react-backgammon) with another person in your room
  - players are assigned using the buttons shown before the game
  - either of the players can start the game
  - UI elements like roll dice button and available moves will only show up for the relevant player.
  - any player can hit the reset players button to reset the players and the game
- play a very basic implementation of Minecraft made by [danba340](https://github.com/danba340/minecraft-react)
  - players are assigned a random color when they first join the main room and the spheres use this color.
  - player location is updated for all players using the YJS awareness api
  - players can place blocks on the ground or on another block by clicking
  - blocks placed by one player will be placed for all players
  - players can remove blocks using the <kbd>Alt</kbd>+<kbd>Click</kbd>
  - you can place other block types by changing the active block type using <kbd>1</kbd>,<kbd>2</kbd>,<kbd>3</kbd>,<kbd>4</kbd>,<kbd>5</kbd> keys

## FAQ

**Q: All players look the same in backgammon?**

**A:** disable dark mode extensions

**Q: My computer struggles with the minecraft example**

**A:** make sure hardware acceleration is enabled in your browser

## Known bugs and improvements

### Backgammon:

- p2 can roll the dice for p1 on "No moves available" state
- p2 can undo for p1
- p2 sees the board from the same perspective as p1 which could be confusing, it should probably be flipped for p2 so both players try to go to the bottom right (similar to how you would see if you were sitting across each other on a real board)
- Sound effects can be added for when it's a players turn or when someone rolls the dice

### Minecraft:

- other players movement isn't very natural we should use physics to move players instead of setting their positions this would also enable doing player collisions.
- we should change the player model from a sphere to a rectangle similar to how minecraft has it to get more accurate movement.
- ground should be made out of cubes instead of being a special plane to allow players to dig and get the preview when placing a cube.
- change cube breaking to holding LMB on a cube instead of using the <kbd>alt</kbd> modifier key

## Running locally

- `npm install`
- `npm run dev`
