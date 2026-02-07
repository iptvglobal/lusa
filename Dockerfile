# Build stage
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
# This ensures that if PORT is missing, it defaults to 3000
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
