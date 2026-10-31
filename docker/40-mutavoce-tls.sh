#!/bin/sh
# Prepares the certificate for the HTTPS listener on port 8443.
#  - cert.pem + key.pem provided in /certs (e.g. a read-only mount): used as they are.
#  - otherwise a self-signed certificate is generated for localhost plus TLS_HOSTNAMES
#    (comma-separated names or IPs) and kept in /certs, so browsers don't warn again
#    after a restart. It is regenerated when TLS_HOSTNAMES changes.
set -eu

CERT_DIR="${TLS_CERT_DIR:-/certs}"
RUN_DIR="${TLS_RUN_DIR:-/tmp/mutavoce-tls}"
mkdir -p "$RUN_DIR"

san="DNS:localhost,IP:127.0.0.1,IP:::1"
for name in $(echo "${TLS_HOSTNAMES:-}" | tr ',' ' '); do
    case "$name" in
        *:*) san="$san,IP:$name" ;;          # IPv6
        *[!0-9.]*) san="$san,DNS:$name" ;;   # host name
        *) san="$san,IP:$name" ;;            # IPv4
    esac
done

cert="$CERT_DIR/cert.pem"
key="$CERT_DIR/key.pem"
marker="$CERT_DIR/.mutavoce-san"

if [ -f "$cert" ] && [ -f "$key" ] && [ ! -f "$marker" ]; then
    echo "mutavoce: using the certificate provided in $CERT_DIR"
elif [ -f "$cert" ] && [ -f "$key" ] && [ "$(cat "$marker")" = "$san" ]; then
    echo "mutavoce: reusing the self-signed certificate in $CERT_DIR"
else
    if [ ! -d "$CERT_DIR" ] || [ ! -w "$CERT_DIR" ]; then
        echo "mutavoce: $CERT_DIR is not writable, the certificate will change at every restart"
        cert="$RUN_DIR/cert.pem"
        key="$RUN_DIR/key.pem"
        marker="$RUN_DIR/.mutavoce-san"
    fi
    echo "mutavoce: generating a self-signed certificate for $san"
    openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 825 \
        -subj "/CN=MutaVoce" \
        -addext "subjectAltName=$san" \
        -addext "extendedKeyUsage=serverAuth" \
        -keyout "$key" -out "$cert" 2>/dev/null
    chmod 600 "$key"
    echo "$san" > "$marker"
fi

ln -sf "$cert" "$RUN_DIR/active-cert.pem"
ln -sf "$key" "$RUN_DIR/active-key.pem"
echo "mutavoce: HTTPS on port 8443, $(openssl x509 -in "$cert" -noout -fingerprint -sha256)"
