release: if [ ! -f '.build-landing' ]; then cd server && npx prisma migrate deploy && npx prisma generate; fi
web: if [ -f '.build-landing' ]; then cd landing && bin/start-nginx-static; else node server/dist/index.js; fi
