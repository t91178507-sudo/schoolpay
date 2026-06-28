# InvoiceHub WhatsApp Bridge

Standalone WhatsApp Web bridge for InvoiceHub.

## Environment Variables

- `WHATSAPP_BRIDGE_BASE_URL`: public bridge URL, for example `https://your-bridge.example.com`
- `WHATSAPP_BRIDGE_API_KEY`: shared API key used by InvoiceHub
- `WHATSAPP_BRIDGE_SESSION_NAME`: optional default session name
- `WHATSAPP_BRIDGE_PORT`: defaults to `8787`
- `WHATSAPP_BRIDGE_BROWSER_PATH`: defaults to `/usr/bin/chromium` on Linux

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
