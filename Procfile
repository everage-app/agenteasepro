release: if [ -n "$DATABASE_URL" ]; then cd server && npx prisma migrate deploy && npx prisma generate; else echo "Skipping DB migrate for Marketing App"; fi
web: if [ -z "$DATABASE_URL" ]; then bin/start-nginx; else node server/dist/index.js; fi
