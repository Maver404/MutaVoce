# syntax=docker/dockerfile:1

# The build output is static files, so build once on the native platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Unprivileged nginx: runs as a non-root user, HTTP on 8080 and HTTPS on 8443.
FROM nginxinc/nginx-unprivileged:1.27-alpine
USER root
RUN apk add --no-cache openssl \
 && mkdir -p /certs /etc/nginx/mutavoce \
 && chown 101:101 /certs
USER 101
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/common.conf /etc/nginx/mutavoce/common.conf
COPY --chmod=755 docker/40-mutavoce-tls.sh /docker-entrypoint.d/40-mutavoce-tls.sh
COPY --from=build /app/dist /usr/share/nginx/html
VOLUME /certs
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
