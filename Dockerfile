FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:24-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist

EXPOSE 2999
ENTRYPOINT ["node"]
CMD ["dist/server.js"]
