// A day's login for Cloudflare's TURN relay, which carries the game between
// players whose networks block a direct connection. TURN_KEY_ID and
// TURN_KEY_API_TOKEN are set on the Pages project; the key stays here.
// ponytail: players have no account to check, so anyone can get a login;
// a billing alert on the account flags use past the free 1,000 GB a month
export async function onRequestGet({ env }) {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    },
  );
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
