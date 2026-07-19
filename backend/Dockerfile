FROM node:20-bookworm-slim

# ffmpeg is required for video evidence processing (see src/lib/mediaProcessing.js).
# exiftool is optional (document metadata stripping) but cheap to include.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg exiftool ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

ENV PORT=4000
EXPOSE 4000

# Applies any pending migrations against DATABASE_URL before starting —
# keeps the deployed schema in sync without a separate manual step.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
