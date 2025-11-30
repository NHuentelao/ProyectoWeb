FROM php:8.2-apache

# 1. Instalar dependencias del sistema y librerías necesarias
# libzip-dev y zip son CRÍTICOS para que Composer funcione bien
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql zip

# 2. (Paso eliminado: Composer ya no es necesario)

# 3. Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# 4. Establecer directorio de trabajo
WORKDIR /var/www/html

# 5. Copiar los archivos del proyecto
COPY . .

# 6. (Paso eliminado: Composer ya no es necesario)

# 7. Ajustar permisos para Apache
RUN chown -R www-data:www-data /var/www/html

# 8. Exponer puerto
EXPOSE 80
