# Use uma imagem oficial do Node.js baseada em Alpine Linux, que é leve e tem suporte para ARM (linux/arm64)
FROM --platform=linux/arm64 node:18-alpine

# Cria o diretório da aplicação dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de definição de pacotes
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o restante dos arquivos da aplicação (código fonte e posts)
COPY . .

# Comando para iniciar a aplicação quando o container for executado
CMD [ "node", "index.js" ]