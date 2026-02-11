#!/usr/bin/env npx tsx
/**
 * Alert Sender
 * 
 * Sends alerts when scraping health is degraded or critical.
 * Supports multiple notification channels.
 * 
 * Usage: 
 *   npx tsx scripts/send-alert.ts --type critical --message "Scraping broken"
 *   echo "message" | npx tsx scripts/send-alert.ts --type warning
 * 
 * Environment variables:
 *   ALERT_WEBHOOK_URL - Slack/Discord webhook URL
 *   ALERT_EMAIL - Email address for alerts (requires SMTP config)
 *   ALERT_ENABLED - Set to "true" to enable alerts (default: false)
 */

import "dotenv/config";

interface AlertPayload {
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  source: string;
}

/**
 * Send alert to Slack webhook
 */
async function sendSlackAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("ALERT_WEBHOOK_URL not configured - skipping Slack alert");
    return false;
  }

  const color = payload.type === "critical" ? "#dc3545" : 
                payload.type === "warning" ? "#ffc107" : "#17a2b8";

  const slackPayload = {
    attachments: [
      {
        color,
        title: `🚨 ${payload.title}`,
        text: payload.message,
        fields: [
          {
            title: "Type",
            value: payload.type.toUpperCase(),
            short: true,
          },
          {
            title: "Source",
            value: payload.source,
            short: true,
          },
        ],
        footer: "NMLegTracker Health Monitor",
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status}`);
      return false;
    }

    console.log("✅ Slack alert sent");
    return true;
  } catch (error) {
    console.error("Error sending Slack alert:", error);
    return false;
  }
}

/**
 * Send alert to Discord webhook
 */
async function sendDiscordAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = process.env.ALERT_DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return false;
  }

  const color = payload.type === "critical" ? 0xdc3545 : 
                payload.type === "warning" ? 0xffc107 : 0x17a2b8;

  const discordPayload = {
    embeds: [
      {
        title: `🚨 ${payload.title}`,
        description: payload.message,
        color,
        fields: [
          { name: "Type", value: payload.type.toUpperCase(), inline: true },
          { name: "Source", value: payload.source, inline: true },
        ],
        footer: { text: "NMLegTracker Health Monitor" },
        timestamp: payload.timestamp,
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status}`);
      return false;
    }

    console.log("✅ Discord alert sent");
    return true;
  } catch (error) {
    console.error("Error sending Discord alert:", error);
    return false;
  }
}

/**
 * Log alert to file for later review
 */
function logAlert(payload: AlertPayload): void {
  const logLine = JSON.stringify({
    ...payload,
    logged_at: new Date().toISOString(),
  });
  
  // Append to alerts log
  const fs = require("fs");
  const path = require("path");
  const logPath = path.join(process.cwd(), "logs", "alerts.log");
  
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logLine + "\n");
  } catch (error) {
    console.error("Error logging alert:", error);
  }
}

/**
 * Main alert function
 */
async function sendAlert(payload: AlertPayload): Promise<void> {
  const alertEnabled = process.env.ALERT_ENABLED === "true";
  
  console.log("\n📢 Alert Details:");
  console.log(`   Type: ${payload.type.toUpperCase()}`);
  console.log(`   Title: ${payload.title}`);
  console.log(`   Message: ${payload.message}`);
  console.log(`   Time: ${payload.timestamp}`);
  console.log("");

  // Always log to file
  logAlert(payload);

  if (!alertEnabled) {
    console.log("ℹ️  Alerts disabled (set ALERT_ENABLED=true to enable)");
    return;
  }

  // Send to all configured channels
  const results = await Promise.all([
    sendSlackAlert(payload),
    sendDiscordAlert(payload),
  ]);

  const sent = results.filter(Boolean).length;
  if (sent === 0) {
    console.log("⚠️  No alert channels configured");
    console.log("   Set ALERT_WEBHOOK_URL for Slack or ALERT_DISCORD_WEBHOOK_URL for Discord");
  }
}

// CLI handling
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let type: "critical" | "warning" | "info" = "warning";
  let message = "";
  let title = "NMLegTracker Alert";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      type = args[i + 1] as "critical" | "warning" | "info";
      i++;
    } else if (args[i] === "--message" && args[i + 1]) {
      message = args[i + 1];
      i++;
    } else if (args[i] === "--title" && args[i + 1]) {
      title = args[i + 1];
      i++;
    }
  }

  // Read from stdin if no message provided
  if (!message) {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    message = lines.join("\n");
  }

  if (!message) {
    console.error("Usage: npx tsx scripts/send-alert.ts --type critical --message 'Alert message'");
    process.exit(1);
  }

  await sendAlert({
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    source: "cron-update-bills.sh",
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { sendAlert, type AlertPayload };
