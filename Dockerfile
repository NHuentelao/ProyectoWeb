FROM php:8.2-apache

# Instalar dependencias del sistema y extensiones de PHP para PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql

# Habilitar mod_rewrite de Apache (opcional pero recomendado)
RUN a2enmod rewrite

# Copiar el código fuente al directorio de trabajo del contenedor
COPY . /var/www/html/

# Establecer permisos correctos (Render a veces necesita esto)
RUN chown -R www-data:www-data /var/www/html

# Exponer el puerto 80
EXPOSE 80
