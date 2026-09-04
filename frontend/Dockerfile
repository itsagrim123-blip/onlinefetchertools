FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-fund --no-audit

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
