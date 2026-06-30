FROM node:22-alpine

# glslangValidator: actual GLSL compiler for build-time shader validation
RUN apk add --no-cache glslang

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 1339
CMD ["node", "server-wrapper.js"]
