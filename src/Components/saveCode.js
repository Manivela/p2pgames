// A save code (Saves.jsx): a game's state deflated and base64'd, so nobody
// reads the hands at a glance or edits their own. Deflating also makes it
// ~5x shorter.
// ponytail: obfuscation, not encryption; anyone who knows deflate can open
// it, and every phone at the table holds the whole state anyway
export async function encodeSave(state) {
  const deflated = new Blob([JSON.stringify(state)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(deflated).arrayBuffer());
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

// the state in a save code, or null if it isn't one
export async function decodeSave(code) {
  try {
    const bytes = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
    const inflated = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(inflated).text()) ?? null;
  } catch {
    return null;
  }
}
