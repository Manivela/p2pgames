export const signalingServers = ["wss://webrtc-signaling.fly.dev"];

// simple-peer's options, through y-webrtc: its own STUN servers until
// main.jsx gets a TURN relay login (functions/api/turn.js)
export const peerOpts = { config: {} };
