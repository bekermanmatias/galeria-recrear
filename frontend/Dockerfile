FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# .dockerignore excluye node_modules locales (binarios de Windows)
COPY . .

EXPOSE 4321

CMD ["npm", "run", "dev", "--", "--host"]
