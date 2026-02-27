# Bun 公式イメージ（Alpine ベースで軽量）
FROM oven/bun:1-alpine

WORKDIR /app

# 依存関係のみ先にインストール（レイヤーキャッシュ活用）
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# サーバーコードをコピー
COPY server/ ./server/

# SQLite データ保存ディレクトリを作成
RUN mkdir -p /app/data

EXPOSE 3000
ENV NODE_ENV=production

CMD ["bun", "run", "server/index.ts"]
