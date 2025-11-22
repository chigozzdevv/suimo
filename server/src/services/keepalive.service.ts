import { loadEnv } from "@/config/env.js";

export class KeepAliveService {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL = 10 * 60 * 1000;
    private readonly env = loadEnv();

    start(): void {
        const isProduction = this.env.NODE_ENV === "production";
        const isEnabled = this.env.ENABLE_KEEPALIVE === "true";

        if (!isProduction || !isEnabled) {
            console.log(
                `[KeepAlive] Disabled (NODE_ENV=${this.env.NODE_ENV}, ENABLE_KEEPALIVE=${this.env.ENABLE_KEEPALIVE})`
            );
            return;
        }

        const serverUrl = this.env.SERVER_URL;
        if (!serverUrl) {
            console.warn("[KeepAlive] SERVER_URL not set");
            return;
        }

        console.log(`[KeepAlive] Started - pinging ${serverUrl}/health every 10 min`);

        this.intervalId = setInterval(() => {
            this.ping(serverUrl);
        }, this.PING_INTERVAL);

        setTimeout(() => this.ping(serverUrl), 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[KeepAlive] Stopped");
        }
    }

    private async ping(serverUrl: string): Promise<void> {
        try {
            const response = await fetch(`${serverUrl}/health`);
            const timestamp = new Date().toISOString();

            if (response.ok) {
                console.log(`[KeepAlive] ${timestamp} - OK`);
            } else {
                console.warn(`[KeepAlive] ${timestamp} - Failed (${response.status})`);
            }
        } catch (error) {
            console.error(`[KeepAlive] ${new Date().toISOString()} - Error:`, error);
        }
    }
}
