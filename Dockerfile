FROM node:12

WORKDIR /app

ADD package.json .
ADD ormconfig.yml.example ./ormconfig.yml
ADD yarn.lock .
ADD tsconfig.json .
ADD src ./src
ADD configs ./configs
ADD swagger ./swagger/.

RUN yarn install
RUN yarn build:dev

EXPOSE 8080

CMD [ "npm", "run", "start:glia:dev" ]
