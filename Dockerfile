FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.ts tsconfig.json ./
RUN pnpm build

RUN pnpm install --frozen-lockfile --prod


FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

RUN addgroup -S botuser && adduser -S botuser -G botuser
USER botuser

CMD ["node", "dist/index.js"]
