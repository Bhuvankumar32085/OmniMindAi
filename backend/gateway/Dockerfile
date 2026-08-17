# Stage 1: Build TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci || npm install

COPY src ./src

RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --only=production || npm install --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/index.js"]
