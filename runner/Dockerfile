FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache docker-cli curl openssl

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

VOLUME ["/var/run/docker.sock", "/secrets"]

CMD ["npm", "start"]
