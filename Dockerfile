# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION} AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
# Optional runtime defaults (can be overridden at docker run -e or by build-args)
ARG RUNTIME_API_URL
ARG PROD_PROVIDER
ENV RUNTIME_API_URL=${RUNTIME_API_URL}
ENV PROD_PROVIDER=${PROD_PROVIDER}


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
# Ensure apt uses HTTPS mirrors (fixes environments where HTTP mirrors fail)
# Some slim base images may not have /etc/apt/sources.list — recreate it with HTTPS entries
RUN echo 'deb https://deb.debian.org/debian bookworm main contrib non-free' > /etc/apt/sources.list && \
    echo 'deb https://deb.debian.org/debian bookworm-updates main contrib non-free' >> /etc/apt/sources.list && \
    echo 'deb https://deb.debian.org/debian-security bookworm-security main contrib non-free' >> /etc/apt/sources.list && \
    apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
