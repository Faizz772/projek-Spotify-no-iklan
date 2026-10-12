FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache python3 py3-pip \
    && pip install --break-system-packages --no-cache-dir yt-dlp
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/sdk/package.json packages/sdk/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages packages
RUN npm run build --workspace @miusix/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@miusix/api"]
