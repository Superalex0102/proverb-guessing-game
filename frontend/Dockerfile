# Use Debian-based Node.js image (more reliable native module support than Alpine)
FROM node:20-bullseye-slim

# Set the working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
ENV NPM_CONFIG_OPTIONAL=true
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application code
COPY . .

# Accept build args for Next.js public env vars
ARG FRONTEND_URL

# Set environment variables for build
ENV FRONTEND_URL=$FRONTEND_URL

# Build the application
RUN pnpm build

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]