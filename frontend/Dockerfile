FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NITRO_PRESET=node-server

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8081

COPY --from=build /app/.output ./.output

EXPOSE 8081

CMD ["sh", "-c", "PORT=${PORT:-8081} node .output/server/index.mjs"]
