#!/bin/bash
set -e
LAB=~/web_infra_lab
APP=~/newsdesk-api-app
SECRETS=~/newsdesk.env

[ -d "$LAB" ]     || { echo "Missing $LAB (clone the lab repo first)"; exit 1; }
[ -d "$APP" ]     || { echo "Missing $APP (upload or clone the project first)"; exit 1; }
[ -f "$SECRETS" ] || { echo "Missing $SECRETS (create it with your API keys)"; exit 1; }


WEB_SITE='server {
    listen 80 default_server;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header X-Web-Server NAME always;
    }
}'

LB_CONF='upstream newsdesk {
    zone newsdesk 64k;
    server web-01:80;
    server web-02:80;
}

server {
    listen 80;

    location / {
        proxy_pass http://newsdesk;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header X-Served-By $upstream_addr always;
    }
}'

echo "== Starting containers"
cd "$LAB"
docker compose up -d web-01 web-02 lb-01

for w in web-01 web-02; do
    echo "== Setting up $w"
    docker exec "$w" bash -c "apt-get update -qq && apt-get install -y -qq nginx python3 procps > /dev/null"
    docker exec "$w" bash -c "pkill -f '[s]erver.py' || true"
    docker exec "$w" rm -rf /opt/newsdesk
    docker cp "$APP" "$w":/opt/newsdesk
    docker cp "$SECRETS" "$w":/opt/newsdesk/.env
    docker exec "$w" chmod 600 /opt/newsdesk/.env
    docker exec -d "$w" bash -c "cd /opt/newsdesk && exec python3 server.py > /var/log/newsdesk.log 2>&1"
    echo "${WEB_SITE/NAME/$w}" | docker exec -i "$w" tee /etc/nginx/sites-available/default > /dev/null
    docker exec "$w" nginx -t
    docker exec "$w" service nginx restart
done

echo "== Setting up lb-01"
docker exec lb-01 bash -c "apt-get update -qq && apt-get install -y -qq nginx > /dev/null"
docker exec lb-01 rm -f /etc/nginx/sites-enabled/default
echo "$LB_CONF" | docker exec -i lb-01 tee /etc/nginx/conf.d/lb.conf > /dev/null
docker exec lb-01 nginx -t
docker exec lb-01 service nginx restart

echo "== Testing (should alternate between web-01 and web-02)"
sleep 2
for i in 1 2 3 4; do
    curl -s -D - -o /dev/null http://localhost:8082/health | grep -i x-web-server
done
echo "== Done. In Cloud Shell use Web Preview on port 8082 to open the app."
