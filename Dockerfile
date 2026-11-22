# Yo'lim: website + Telegram reminder bot + optional AI letter review, in one Node process.
FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=8787 STATE_DIR=/app/state
EXPOSE 8787
# Keep telegram.json and students.json on a volume so subscriptions survive restarts.
VOLUME ["/app/state"]
CMD ["node", "server.js"]
