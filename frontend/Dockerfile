FROM node:22-alpine

# glslangValidator: actual GLSL compiler for build-time shader validation
RUN apk add --no-cache glslang

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Kein COPY . . — docker-compose mountet ./frontend nach /app und überdeckt es
# ohnehin; kopiert würden sonst u. a. 9 GB Kartenrohdaten (.karten-roh).

EXPOSE 1339
CMD ["node", "server-wrapper.js"]
