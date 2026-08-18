#!/bin/sh
# =============================================================================
#  Render the client's RUNTIME config into the webroot, before nginx starts.
# =============================================================================
#  This is what makes one client image usable by every instance: the bundle is
#  identical everywhere and fetches /config.json at boot, which this script
#  materialises from the environment the container was started with.
#
#  Executed by the stock nginx:alpine entrypoint, which sources/runs every
#  executable in /docker-entrypoint.d in filename order.
#
#  Inputs (all optional — see the resolution rules below):
#    WS_SERVER_URL         fully-qualified override, wins over everything
#    SERVER_PUBLIC_SCHEME  ws | wss
#    SERVER_PUBLIC_HOST    empty => client derives it from the page origin
#    SERVER_PUBLIC_PORT    published host port of THIS instance's game server
#    SERVER_PUBLIC_PATH    WebSocket path
#    SERVER_DISPLAY_NAME   label in the client's server picker
#    INSTANCE_ID           identifier surfaced to the client for logging
# =============================================================================

set -eu

TEMPLATE=/etc/game-client/config.template.json
TARGET=/usr/share/nginx/html/config.json

if [ ! -f "$TEMPLATE" ]; then
    echo "[config.json] template missing at $TEMPLATE — leaving any baked-in config in place" >&2
    exit 0
fi

# ── Resolve the WebSocket endpoint ───────────────────────────────────────────
# Precedence:
#   1. WS_SERVER_URL, verbatim.
#   2. Composed from the parts, but ONLY when a host is given.
#   3. Empty — the client then derives host AND port from the page origin.
#      Correct whenever the client and server share a hostname; it also keeps
#      the image instance-agnostic, since nothing instance-specific is written.
RESOLVED_WS_URL="${WS_SERVER_URL:-}"

if [ -z "$RESOLVED_WS_URL" ] && [ -n "${SERVER_PUBLIC_HOST:-}" ]; then
    scheme="${SERVER_PUBLIC_SCHEME:-ws}"
    path="${SERVER_PUBLIC_PATH:-/ws}"
    if [ -n "${SERVER_PUBLIC_PORT:-}" ]; then
        RESOLVED_WS_URL="${scheme}://${SERVER_PUBLIC_HOST}:${SERVER_PUBLIC_PORT}${path}"
    else
        RESOLVED_WS_URL="${scheme}://${SERVER_PUBLIC_HOST}${path}"
    fi
fi

# When no explicit URL was resolved, the client still needs the PORT: the page
# is served on CLIENT_HOST_PORT while the game server listens on a different
# published port, so origin-derivation alone cannot supply it.
RESOLVED_WS_PORT="${SERVER_PUBLIC_PORT:-}"
RESOLVED_WS_PATH="${SERVER_PUBLIC_PATH:-/ws}"
RESOLVED_WS_SCHEME="${SERVER_PUBLIC_SCHEME:-ws}"
RESOLVED_NAME="${SERVER_DISPLAY_NAME:-Game Server}"
RESOLVED_INSTANCE="${INSTANCE_ID:-default}"

# ── Render ───────────────────────────────────────────────────────────────────
# Values are JSON-escaped before substitution: an unescaped quote or backslash
# in an env var would otherwise emit a malformed config.json and the client
# would silently fall back to its build-time defaults.
json_escape() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

export WS_SERVER_URL="$(json_escape "$RESOLVED_WS_URL")"
export SERVER_PUBLIC_SCHEME="$(json_escape "$RESOLVED_WS_SCHEME")"
export SERVER_PUBLIC_HOST="$(json_escape "${SERVER_PUBLIC_HOST:-}")"
export SERVER_PUBLIC_PORT="$(json_escape "$RESOLVED_WS_PORT")"
export SERVER_PUBLIC_PATH="$(json_escape "$RESOLVED_WS_PATH")"
export SERVER_DISPLAY_NAME="$(json_escape "$RESOLVED_NAME")"
export INSTANCE_ID="$(json_escape "$RESOLVED_INSTANCE")"

envsubst \
    '${WS_SERVER_URL} ${SERVER_PUBLIC_SCHEME} ${SERVER_PUBLIC_HOST} ${SERVER_PUBLIC_PORT} ${SERVER_PUBLIC_PATH} ${SERVER_DISPLAY_NAME} ${INSTANCE_ID}' \
    < "$TEMPLATE" > "$TARGET"

# Fail fast and loudly. A config.json that is not valid JSON makes the client
# fall back to build-time defaults — which, in a multi-instance deployment,
# means players silently land on the WRONG instance's server. Better to refuse
# to start than to serve a stack that looks healthy and misroutes traffic.
if command -v node >/dev/null 2>&1; then
    node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$TARGET" \
        || { echo "[config.json] rendered file is not valid JSON — aborting startup" >&2; exit 1; }
fi

echo "[config.json] instance=$RESOLVED_INSTANCE ws=${RESOLVED_WS_URL:-<derived from page origin>} port=${RESOLVED_WS_PORT:-<origin>}"
