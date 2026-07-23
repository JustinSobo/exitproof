/**
 * ExitProof Hybrid Connector — outbound agent entrypoint.
 *
 * Usage:
 *   tsx src/index.ts                  # heartbeat loop
 *   tsx src/index.ts --once heartbeat
 *   tsx src/index.ts --once snapshot
 */

import { loadConfig } from "./config.js";
import { runHeartbeatLoop } from "./heartbeat.js";
import { sendHeartbeat, sendSnapshots } from "./protocol.js";

async function main() {
  const args = process.argv.slice(2);
  const onceIdx = args.indexOf("--once");
  const once = onceIdx >= 0 ? args[onceIdx + 1] : null;
  const config = loadConfig();

  console.log(
    `[connector] tenant=${config.tenantId} mode=${config.adMode} host=${config.hostname}`,
  );

  if (once === "heartbeat") {
    await sendHeartbeat(config);
    return;
  }
  if (once === "snapshot") {
    await sendSnapshots(config);
    return;
  }

  // Default: long-running outbound heartbeat (no inbound server).
  await runHeartbeatLoop(config);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
