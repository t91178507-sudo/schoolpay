FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

ENV NODE_ENV=production
ENV WHATSAPP_BRIDGE_PORT=8787
ENV WHATSAPP_BRIDGE_BROWSER_PATH=/usr/bin/chromium

EXPOSE 8787

CMD ["npm", "start"]
