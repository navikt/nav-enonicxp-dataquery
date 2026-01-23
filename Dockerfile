FROM node:24-alpine

WORKDIR /app

COPY package*.json /app/
COPY node_modules /app/node_modules/
COPY dist /app/dist/

# Start app
EXPOSE 2999
CMD ["npm", "run", "start"]
