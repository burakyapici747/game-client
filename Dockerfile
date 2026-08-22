# Build stage
FROM node:20-alpine AS build
# Burayı ekliyoruz:
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# Artık Vite build yaparken bu IP'yi görebilecek
RUN npm run build-proto
RUN npm run build-nolog

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]