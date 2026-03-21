---
name: telegram-notify
description: >-
  Send a Telegram notification to the user (Sam) via his personal agent.
  TRIGGER when: the user asks you to notify them on Telegram, send a Telegram message
  when done, ping them on Telegram, or says "notify me when finished", "let me know
  on Telegram", "send me a message when done", or any variation of requesting a
  Telegram/mobile notification about task completion. Also trigger when the user
  explicitly includes this skill in a prompt. DO NOT TRIGGER for general messaging,
  chatbot building, or Telegram bot development tasks.
---

# Telegram Notify

Send a short notification message to Sam's Telegram via his personal agent's Azure Function.
This is a lightweight push — no AI processing, just a direct message delivery.

## How it works

The personal agent runs as an Azure Function with a `/api/notify` endpoint that forwards
messages directly to Telegram. You call it with `curl` from the terminal.

## Configuration

The endpoint requires two values:

| Variable | Value |
|----------|-------|
| `NOTIFY_URL` | `https://func-agents-s6vbks3oteo4y.azurewebsites.net/api/notify` |
| `NOTIFY_KEY` | `r_R7xLV9tH3-9XjJ0dbniNan9OXwkZ2S8luCASzGE8OZAzFuxePshQ==` |

## Sending a notification

Run this command in the terminal to send a notification:

```bash
curl -s -X POST "https://func-agents-s6vbks3oteo4y.azurewebsites.net/api/notify?code=r_R7xLV9tH3-9XjJ0dbniNan9OXwkZ2S8luCASzGE8OZAzFuxePshQ==" \
  -H "Content-Type: application/json" \
  -d '{"message": "YOUR_MESSAGE_HERE"}'
```

Replace `YOUR_MESSAGE_HERE` with the notification text.

### Message formatting

- Keep messages concise — 1-3 sentences max
- Use plain text (no HTML tags) for reliability
- Include what task was completed and the outcome
- If a task failed, mention the error briefly

### Examples

**Task completed successfully:**
```bash
curl -s -X POST "https://func-agents-s6vbks3oteo4y.azurewebsites.net/api/notify?code=r_R7xLV9tH3-9XjJ0dbniNan9OXwkZ2S8luCASzGE8OZAzFuxePshQ==" \
  -H "Content-Type: application/json" \
  -d '{"message": "Done: Migrated database schema to v3. All 47 tests passing."}'
```

**Task failed:**
```bash
curl -s -X POST "https://func-agents-s6vbks3oteo4y.azurewebsites.net/api/notify?code=r_R7xLV9tH3-9XjJ0dbniNan9OXwkZ2S8luCASzGE8OZAzFuxePshQ==" \
  -H "Content-Type: application/json" \
  -d '{"message": "Failed: Docker build errors in auth-service. Check logs for details."}'
```

## When to send notifications

- **After completing the user's main task** — summarize what was done
- **After a long-running operation finishes** — build, deploy, migration, etc.
- **On failure** — if something went wrong, notify with the error
- **When explicitly asked** — "notify me when done"

Do NOT send notifications for trivial sub-steps or intermediate progress.

## Setup (first-time only)

If you don't have the function key yet, get it by running:

```bash
az functionapp keys list --name func-agents-s6vbks3oteo4y --resource-group rg-personal-agents --query "functionKeys.default" -o tsv
```

This requires the user to be logged into Azure CLI with `samoletov@live.com`.

## Troubleshooting

- **401/403 response**: Function key is wrong or missing. Re-fetch with the `az` command above.
- **502 response**: Telegram API issue — retry once after a few seconds.
- **No response**: Check that the Azure Function is running: `curl https://func-agents-s6vbks3oteo4y.azurewebsites.net/api/health`
