# Arcadia Academy – landing pages (static), served by nginx.
# Coolify: Build Pack = Dockerfile, Ports Exposes = 80.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Only what the site serves: pages + assets (no build scripts, no sources).
COPY index.html merci.html robots.txt /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY form /usr/share/nginx/html/form
COPY bac /usr/share/nginx/html/bac
COPY org /usr/share/nginx/html/org

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
