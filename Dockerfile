# =============================================================================
#  GAME CLIENT IMAGE — INSTANCE-AGNOSTIC
# =============================================================================
#  One image serves EVERY instance. The server endpoint is injected at
#  CONTAINER START (see docker-entrypoint.d/20-render-config-json.sh), not baked
#  in at build time, so spinning up N instances costs one build, not N.
#
#  No host, IP or port literal appears in this file: the internal listen port
#  arrives as a build arg with a runtime override, and the server endpoint is
#  read from the environment when the container boots.
# =============================================================================

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Legacy BUILD-TIME fallback, consulted by the bundle ONLY if the runtime
# config.json fails to load. Empty by default and SHOULD stay empty for
# multi-instance work — a value here bakes a host into the image and makes it
# instance-specific, which is exactly what this design avoids.
ARG VITE_SERVER_URL=""
ENV VITE_SERVER_URL=$VITE_SERVER_URL

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build-proto
RUN npm run build-nolog

# ── Production stage ─────────────────────────────────────────────────────────
FROM nginx:alpine

# Container-internal listen port. Constant across instances by design —
# isolation comes from host port mapping, never from renumbering this.
# Overridable at run time because the nginx config is a template (below).
ARG CLIENT_INTERNAL_PORT=80
ENV CLIENT_INTERNAL_PORT=$CLIENT_INTERNAL_PORT

COPY --from=build /app/dist /usr/share/nginx/html

# The runtime config template ships OUTSIDE the served webroot so it can never
# be fetched by a browser; the entrypoint renders it INTO the webroot.
COPY public/config.template.json /etc/game-client/config.template.json

# nginx:alpine runs envsubst over /etc/nginx/templates/*.template at startup and
# writes the result to /etc/nginx/conf.d/ — this is the image's own documented
# mechanism, so no custom entrypoint is needed just for the listen port.
# Only the vars named here are substituted, leaving nginx's own $uri, $host etc.
# untouched.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER="CLIENT_INTERNAL_PORT"

# Scripts in /docker-entrypoint.d are executed by the stock nginx entrypoint
# before the server starts. 20- runs after the image's own 10-listen-on-ipv6
# and 20-envsubst-on-templates steps.
COPY docker-entrypoint.d/20-render-config-json.sh /docker-entrypoint.d/20-render-config-json.sh
RUN chmod +x /docker-entrypoint.d/20-render-config-json.sh

# Documentation only — the published mapping lives in docker-compose.yml. Uses
# the build arg so it tracks CLIENT_INTERNAL_PORT rather than restating it.
EXPOSE ${CLIENT_INTERNAL_PORT}

CMD ["nginx", "-g", "daemon off;"]
