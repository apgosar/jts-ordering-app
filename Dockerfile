# Stage 1: Build the React client
FROM node:22-alpine AS build
WORKDIR /app

# Copy client package files first (layer cache: only re-install if package files change)
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install

# Copy client source and build
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Lean production server image
FROM node:22-alpine
WORKDIR /app

# Copy server package files and install ONLY production deps
# --omit=dev strips Jest, Playwright, nodemon, concurrently etc. from the image
# --ignore-scripts skips postinstall (prevents client npm install in Docker)
COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy server source (server.js, scripts/, etc.)
# .dockerignore prevents node_modules, .git, test artifacts from being sent
COPY . .

# Overwrite client/ with only the compiled build artifact from Stage 1
# (COPY . . above may have brought raw client/src — this clears it)
RUN rm -rf ./client/*
COPY --from=build /app/client/build ./client/build

# Runtime config
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
