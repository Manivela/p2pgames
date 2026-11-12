// where pages find each other. The e2e tests' dev server (vite --mode e2e,
// playwright.config.js) has y-webrtc's own on this machine, so their many
// pages at once don't wait on the live one; a page there with
// sessionStorage signaling "live" uses the live one (the e2e's check of it)
const live = "wss://webrtc-signaling.fly.dev";
export const signalingServers =
  import.meta.env.MODE === "e2e" &&
  sessionStorage.getItem("signaling") !== "live"
    ? ["ws://localhost:4444"]
    : [live];

// simple-peer's options, through y-webrtc: its own STUN servers until
// main.jsx gets a TURN relay login (functions/api/turn.js)
export const peerOpts = { config: {} };
