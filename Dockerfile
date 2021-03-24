FROM node:12

WORKDIR /app

ADD package.json .
ADD yarn.lock .
ADD tsconfig.json .
ADD src ./src
ADD configs ./configs
ADD swagger ./swagger/.

RUN yarn install
RUN yarn build:dev

CMD [ "npm", "run", "start" ]
