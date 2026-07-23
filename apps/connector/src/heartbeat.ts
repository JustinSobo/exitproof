import type { ConnectorConfig } from "./config.js";
import { sendHeartbeat } from "./protocol.js";

export async function runHeartbeatLoop(config: ConnectorConfig): Promise<never> {
  console.log(
    `[connector] heartbeat every ${config.heartbeatSeconds}s → ${config.apiBase}`,
  );
  for (;;) {
    try {
      await sendHeartbeat(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[heartbeat]", msg);
      if (msg.includes("revoked")) {
        process.exit(2);
      }
    }
    await new Promise((r) => setTimeout(r, config.heartbeatSeconds * 1000));
  }
}
