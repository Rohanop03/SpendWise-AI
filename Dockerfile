# Multi-stage production Dockerfile for SpendWise AI Server
FROM node:22-alpine AS build

WORKDIR /app

# Copy root package manifests and server manifests for workspace installation
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci

# Copy application source code
COPY server ./server

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for health check
RUN apk --no-cache add curl

# Copy installed node modules and workspace code from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server

# Run as non-root user for container security
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

CMD ["node", "server/src/index.js"]
