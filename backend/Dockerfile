FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["node", "server.js"]
