# OGCTV ships as a standalone Node server (Astro's @astrojs/node adapter, output: 'server').
# `astro build` writes no HTML pages for the newsroom — every article, category, search and
# admin page is rendered by this process, which also owns a SQLite database and an uploads
# directory on a persistent volume. A static file host therefore cannot serve this site:
# it would find nothing to serve at / and return its own 404.
#
#   docker build -t ogctv .
#   docker volume create ogctv-data
#   docker run -d --name ogctv -p 4321:4321 \
#     -v ogctv-data:/data \
#     -e PUBLIC_SITE_URL=https://your-domain.example \
#     ogctv
#
# The first request creates and seeds the database. Open /admin/setup once to create the
# first administrator (there are no default credentials).

FROM node:22-bookworm-slim AS build
WORKDIR /app
# .npmrc sets engine-strict, so an older base image fails here with a clear message
# instead of half-way through `astro build`.
COPY package.json package-lock.json .npmrc ./
COPY astro.config.mjs tsconfig.json biome.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm ci && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV OGCTV_DATA_DIR=/data
WORKDIR /app
# better-sqlite3 and sharp are deliberately kept out of the bundle (see astro.config.mjs),
# so the installed modules have to travel with the image.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
RUN install -d -o node -g node /data
VOLUME /data
USER node
EXPOSE 4321
# / is the cheapest honest readiness signal: it only answers once the database is open.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "./dist/server/entry.mjs"]
