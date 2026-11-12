# TODO

## Okey

### To design

- **Tips.** Open question first: tips about using the table (two taps knock, a right click turns the fake okey, a box drawn picks tiles, a pile tapped spreads on the pair round) or tips about play? The Okey CLAUDE.md rules out hints about what to lay ("make hands faster, not smarter"), so play tips would revisit that.
- **Spectator mode.** Today a page that doesn't sit down already watches: it sees the table from the first seat, every rack face down, and can sit down between rounds or from the ⋯ menu mid-round. To settle: what a spectator sees (a chosen seat's view? hands shown?), whether the players see who's watching, and whether watching is a choice on arriving instead of only a full table.

- **More colours and more numbers.** Rulesets that set how many colours the tiles come in and how high the numbers go, beside `tileSets` (copies of each tile).
- **The claim's extra tile from the discarder.** A ruleset setting beside `outOfTurnTakes`: the extra tile a claim brings (Americano's) comes from the hand of the player who threw the discard, picked by them, instead of from the pile. To settle: whether the table waits on their pick, and which tile a bot gives. The tile reaches the claimant through their inbox, as a hand is written only by its owner.
- **Everyone starts the next round.** The button that starts the next round (and the next game) waits for every player in the game to press it, showing who has pressed it and who hasn't. To settle: whether a bot counts as pressed, and what happens when a player who hasn't pressed is away (a closed tab).
- **Chatbox.** Two channels: a lobby chat for the whole table and an eşli chat between partners. Voice recordings can be sent as well as text. (`main.jsx` and `root.jsx` still have a commented-out `Chat` route and nav link from an older chat.)

### Known

- In a partners game, "opened" (or "just opened") beside "partner" under a short name runs into the next pile, in English ("eş" fits in Turkish). It ran into it before the badges moved under the avatar too.
- Sitting down or adding a bot mid-round replaces the table, so a move someone makes in that same moment is lost (their tile snaps back). A version that loses nothing: the joining page only takes the seat, and the page whose turn it is deals them in through their inbox, as out-of-turn takes do. Worth it once players report it.
- Not yet: "devam" (×4), best-of-three matches.
- README's "Known bugs and improvements" for Okey is out of date (reshuffling the pile, scoring and moving groups of tiles are done).
