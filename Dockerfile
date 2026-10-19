FROM node:22-alpine
RUN apk add --no-cache iputils traceroute
WORKDIR /app
COPY server.js index.html relatorio.html ./
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.js"]
