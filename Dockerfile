FROM oven/bun:1.1.30

WORKDIR /pma

COPY package*.json ./
RUN bun install

COPY . .

CMD ["bun", "run", "dev"]
