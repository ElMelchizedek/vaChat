# For local testing, as I need to set AWS secrets as environment variables for the test to work, yet in production that should be
# handled by the IAM roles associated with the ECS service tasks.
FROM --platform=linux/amd64 oven/bun

COPY package.json .
COPY bun.lockb .

RUN bun install --production

COPY src src
COPY tsconfig.json .

# ENV NODE_ENV production
CMD ["bun", "src/index.tsx"]

EXPOSE 3000