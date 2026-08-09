/*
 * What reaches the caller when the request never gets an HTTP status.
 *
 * DNS failures, refused connections, sockets dropped mid-response — none of
 * these produce a status code, so none of them go through the SDK's
 * status→class mapping. They surface as whatever `fetch` threw, which means
 * the documented `catch (e) { if (e instanceof SocialRouterError) … }` does
 * not catch them. That is worth knowing precisely rather than approximately,
 * so most of this file uses real sockets instead of a stub: a stub would only
 * prove the SDK forwards the error *I* invented.
 *
 * Everything here is offline and deterministic — a reserved `.invalid` host,
 * a closed port on loopback, and local servers that hang up on purpose.
 *
 * Run against `dist/`, like the rest of this suite.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SocialRouter, SocialRouterError } from "../dist/index.js";

const servers: Server[] = [];

after(() => {
  for (const server of servers) server.close();
});

/** A local server that runs `onRequest`, torn down at the end of the file. */
async function serve(onRequest: (req: any, res: any) => void): Promise<string> {
  const server = createServer(onRequest);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/**
 * A loopback address with nothing listening: bind a port, then release it.
 *
 * Not a hardcoded low port — fetch refuses to dial the WHATWG "bad ports"
 * list (1, 7, 9…) before opening a socket at all, which fails for a reason
 * that has nothing to do with the network.
 */
async function closedPort(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

const at = (baseUrl: string) => new SocialRouter({ apiKey: "sr_test", baseUrl });

/**
 * Node wraps every transport failure in `TypeError: fetch failed` and puts
 * the real one on `.cause`. The cause is therefore the only thing a caller
 * can diagnose from — if the SDK ever wraps these errors, it has to carry it
 * across.
 */
function assertTransportFailure(err: Error & { cause?: unknown }): true {
  assert.ok(
    !(err instanceof SocialRouterError),
    `transport failures are not mapped to a typed error (got ${err.constructor.name})`,
  );
  assert.equal(err.name, "TypeError");
  assert.ok(err.cause, "the underlying cause must survive — it is the only diagnosable part");
  return true;
}

// ─── No host, no port, no route ──────────────────────────

test("a hostname that does not resolve fails as a transport error", async () => {
  // `.invalid` is reserved precisely so it can never resolve (RFC 2606).
  await assert.rejects(
    () => at("http://socialrouter-does-not-exist.invalid").getBalance(),
    assertTransportFailure,
  );
});

test("a refused connection fails as a transport error", async () => {
  const base = await closedPort();
  await assert.rejects(() => at(base).getBalance(), assertTransportFailure);
});

test("the failure carries a diagnosable cause, not just 'fetch failed'", async () => {
  // The message alone is useless for triage. The code underneath is what
  // tells a wrong base URL apart from a dead network — and it is the reason
  // wrapping these errors would have to preserve `cause`.
  const base = await closedPort();
  await assert.rejects(
    () => at(base).getBalance(),
    (err: Error & { cause?: { code?: string; errors?: { code?: string }[] } }) => {
      // Happy Eyeballs can report several attempts at once, so the code sits
      // either on the cause or inside its aggregate.
      const codes = [err.cause?.code, ...(err.cause?.errors ?? []).map((e) => e.code)];
      assert.ok(codes.includes("ECONNREFUSED"), `no ECONNREFUSED in ${JSON.stringify(codes)}`);
      return true;
    },
  );
});

// ─── Connections that die mid-flight ─────────────────────

test("a socket dropped before any response fails as a transport error", async () => {
  const base = await serve((_req, res) => res.socket?.destroy());
  await assert.rejects(() => at(base).getBalance(), assertTransportFailure);
});

test("a socket dropped mid-body fails rather than returning a truncated payload", async () => {
  // The dangerous shape: headers say 200 and JSON, then the connection dies.
  // Returning what arrived would hand the caller a half-parsed object.
  const base = await serve((_req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-length": "999" });
    res.write('{"data":[{"id":"partial"');
    setTimeout(() => res.socket?.destroy(), 10);
  });

  await assert.rejects(
    () => at(base).listServices(),
    (err: Error) => {
      assert.ok(!(err instanceof SocialRouterError));
      return true;
    },
  );
});

test("a POST fails the same way a GET does", async () => {
  // `run()` is the only method that sends a body; nothing about the failure
  // path should differ, and a body left unconsumed is a socket leak.
  const base = await serve((_req, res) => res.socket?.destroy());
  await assert.rejects(
    () => at(base).run("reddit/subreddit.posts", { url: "https://www.reddit.com/r/x" }),
    assertTransportFailure,
  );
});

// ─── What the SDK does *not* do ──────────────────────────

test("a failed request is attempted exactly once", async () => {
  // No retry, no backoff. Worth pinning: a caller building its own retry loop
  // needs to know it is not stacking one on top of another, and a silent
  // retry would double-spend on the endpoints that bill.
  let attempts = 0;
  const base = await serve((_req, res) => {
    attempts++;
    res.socket?.destroy();
  });

  await assert.rejects(() => at(base).getBalance(), assertTransportFailure);
  assert.equal(attempts, 1);
});

test("a slow response is not cut short by the SDK", async () => {
  // There is no timeout and no way to pass a signal, so the only deadline is
  // the environment's. A response that takes its time must still arrive
  // intact — the day a client-side timeout is added, this is where the change
  // in behaviour shows up.
  const base = await serve((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ balance: 1.5, currency: "USD" }));
    }, 300);
  });

  assert.deepEqual(await at(base).getBalance(), { balance: 1.5, currency: "USD" });
});

test("an HTTP error from a real socket still maps to a typed error", async () => {
  // The counterpart to everything above: once a status exists, the mapping
  // applies — the two paths must not be confused for one another.
  const base = await serve((_req, res) => {
    res.writeHead(402, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: { code: "insufficient_credits", message: "Balance too low", type: "billing" },
      }),
    );
  });

  await assert.rejects(
    () => at(base).getBalance(),
    (err: SocialRouterError) => {
      assert.ok(err instanceof SocialRouterError);
      assert.equal(err.status, 402);
      return true;
    },
  );
});
