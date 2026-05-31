#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

cd "$ROOT_DIR"

docker compose stop ui
npm --prefix apps/ui run clean:next
docker compose up -d --no-deps ui

echo "Waiting for UI to respond..."
attempt=0
until docker compose exec -T ui node -e "fetch('http://localhost:3000/').then((r)=>process.exit(r.status === 200 ? 0 : 1)).catch(()=>process.exit(1))"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "UI did not become healthy. Last logs:"
    docker compose logs --tail=80 ui
    exit 1
  fi
  sleep 1
done

echo "UI Next cache cleaned and ui service restarted."
