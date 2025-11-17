# Define a arquitetura ARM64 (Oracle Cloud) e a imagem base do Node
FROM --platform=linux/arm64 node:18-alpine

# 1. Instala e configura o fuso horário (Essencial para postar às 06:30 do Brasil)
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# 2. Define a pasta de trabalho dentro do container
WORKDIR /usr/src/app

# 3. Copia os arquivos de dependências primeiro (para aproveitar o cache do Docker)
COPY package*.json ./

# 4. Instala as dependências
RUN npm install

# 5. Copia todo o resto do código (index.js, autenticar.js, pasta posts, etc.)
COPY . .

# 6. Comando que roda quando o container inicia
CMD [ "node", "index.js" ]