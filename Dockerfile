FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p /app/data

ENV PORT=8080
ENV DB_PATH=/app/data/quiz.db
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
