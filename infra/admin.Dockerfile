FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config ./packages/config
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_BASE_PATH=/backend
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN pnpm --filter @ulfy/admin build
RUN node -e 'const fs=require("fs"); const expected=process.env.NEXT_PUBLIC_BASE_PATH || ""; const manifest=JSON.parse(fs.readFileSync("apps/admin/.next/routes-manifest.json","utf8")); if (manifest.basePath !== expected) { throw new Error("Admin image basePath mismatch. Expected "+expected+" got "+manifest.basePath); }'
RUN if [ -n "$NEXT_PUBLIC_BASE_PATH" ]; then grep -R "\"basePath\":\"${NEXT_PUBLIC_BASE_PATH}\"" apps/admin/.next/routes-manifest.json >/dev/null; fi

FROM node:22-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=/backend
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/public ./apps/admin/public
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /app/apps/admin/node_modules ./apps/admin/node_modules
EXPOSE 3000
CMD ["pnpm", "--filter", "@ulfy/admin", "start"]
