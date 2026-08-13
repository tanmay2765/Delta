FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Render injects dashboard env vars at build time; ARG picks them up for Vite.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV NITRO_PRESET=node-server

RUN test -n "$VITE_API_URL" || echo "WARNING: VITE_API_URL is empty — API calls will fall back to localhost"
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8081

COPY --from=build /app/.output ./.output

EXPOSE 8081

CMD ["sh", "-c", "PORT=${PORT:-8081} node .output/server/index.mjs"]
