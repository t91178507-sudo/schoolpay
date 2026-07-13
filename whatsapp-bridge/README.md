# InvoiceHub WhatsApp Bridge

Standalone WhatsApp Web bridge for InvoiceHub.

## Local Windows Start

From the InvoiceHub root folder:

```powershell
npm run bridge:start
```

To confirm the bridge is up:

```powershell
npm run bridge:status
```

Default local settings for InvoiceHub:

- Public bridge base URL: `http://localhost:8787`
- Bridge port: `8787`
- Bridge API key: `invoicehub-bridge-local`

## Environment Variables

- `WHATSAPP_BRIDGE_BASE_URL`: public bridge URL, for example `https://your-bridge.example.com`
- `WHATSAPP_BRIDGE_API_KEY`: shared API key used by InvoiceHub
- `WHATSAPP_BRIDGE_SESSION_NAME`: optional default session name
- `WHATSAPP_BRIDGE_PORT`: defaults to `8787`
- `WHATSAPP_BRIDGE_BROWSER_PATH`: defaults to `/usr/bin/chromium` on Linux

Render-compatible aliases are also supported:

- `PORT`: used when `WHATSAPP_BRIDGE_PORT` is not set
- `BRIDGE_PUBLIC_URL`: used when `WHATSAPP_BRIDGE_BASE_URL` is not set
- `BRIDGE_API_KEY`: used when `WHATSAPP_BRIDGE_API_KEY` is not set

Visiting the base Render URL should show the bridge status page. `Cannot GET /`
means the running deployment is older and should be redeployed with the latest
bridge server.

## Docker

```bash
docker build -t invoicehub-whatsapp-bridge .
docker run -p 8787:8787 \
  -e WHATSAPP_BRIDGE_BASE_URL=https://your-bridge.example.com \
  -e WHATSAPP_BRIDGE_API_KEY=change-this-secret \
  -v invoicehub-whatsapp-sessions:/app/.sessions \
  invoicehub-whatsapp-bridge
```

After deployment, set the same public bridge URL and API key in InvoiceHub WhatsApp Web settings.
