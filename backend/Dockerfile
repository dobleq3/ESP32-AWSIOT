# Imagen base
FROM node:18

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos del proyecto
COPY package*.json ./
RUN npm install
COPY . .

# Exponer el puerto
EXPOSE 3200

# Comando de inicio
CMD ["node", "server.js"]
