FROM oven/bun:1.3.11
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter=@bossbench/core build && bun run --filter=@bossbench/standalone build
EXPOSE 3000
CMD ["bun", "run", "--filter=@bossbench/standalone", "dev"]
