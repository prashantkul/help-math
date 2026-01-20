# Build stage
FROM node:20 AS builder

WORKDIR /app

# Ensure dev deps are installed (don’t use NODE_ENV=production here)
ENV NODE_ENV=development

# Install build tools for native Node modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files *from frontend context*
COPY package*.json ./

# Install dependencies
RUN npm install \
    && npx tsc -v \
    && ls node_modules/.bin/tsc

# Copy the rest of the frontend source
COPY . .

# Build arg for API URL
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Build
RUN npm run build --verbose

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default values for Docker Compose (override in Railway)
ENV BACKEND_HOST=helpmath-backend
ENV BACKEND_PORT=8080

EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOST} ${BACKEND_PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]