# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Run as non-root user for security (Bonus Best Practice!)
USER node

EXPOSE 5000

CMD ["npm", "start"]
