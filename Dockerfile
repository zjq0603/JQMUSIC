FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server ./server
COPY config.json ./config.json
COPY dist ./dist
EXPOSE 3000
CMD ["node", "server/index.js"]
