FROM node:22-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/src ./src

ENV NODE_ENV=production
ENV PORT=8000
ENV DB_PATH=/data/bist.db

EXPOSE 8000

CMD ["node", "src/index.js"]