FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run ci:verify

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
