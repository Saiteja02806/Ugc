FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y ffmpeg ca-certificates fontconfig \
  && mkdir -p /usr/local/share/fonts/geist \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf /usr/local/share/fonts/geist/
COPY --from=build /app/node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf /usr/local/share/fonts/geist/
COPY --from=build /app/node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf /usr/local/share/fonts/geist/

RUN fc-cache -f

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json

CMD ["node", "dist/index.js"]
