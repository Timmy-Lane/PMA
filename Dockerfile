FROM node:22

WORKDIR /pma 

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]