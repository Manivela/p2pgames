# p2pgames

Collection of games modified to work over webRTC using PeerJS

to run the dev server:

```
npm run dev
```

### currently implemented:

- Get id from PeerJS on page load and store this id to use on subsequent refreshes
- Store target peer's id to automatically connect on refresh
- message each other using the very basic messaging UI
- play TicTacToe using the example project from the react team https://reactjs.org/tutorial/tutorial.html

# FAQ

## All players look the same in backgammon?

disable dark mode extensions

# BUGS

## Backgammon

- "No moves available" da p2 p1 yerine zar atabiliyor.
- p2 p1 yerine undo yapabiliyor.
- p1 boardun üstüne topluyor taşları p1 in ters görmesi lazımki iki tarafta sağ alta toplasın.
- sıra gelince ve zar atınca ses eklenebilir.
