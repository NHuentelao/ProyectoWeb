FROM php:8.2-apache

# 1. Instalar dependencias del sistema y librerías necesarias
# libzip-dev y zip son CRÍTICOS para que Composer funcione bien
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql zip

# 2. Instalar Composer globalmente
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 3. Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# 4. Establecer directorio de trabajo
WORKDIR /var/www/html

# 5. Copiar los archivos del proyecto
COPY . .

# 6. Instalar dependencias con Composer
# --ignore-platform-reqs: Evita errores si el composer.lock se generó en Windows con otra versión de PHP
RUN composer install --no-dev --optimize-autoloader --ignore-platform-reqs

# 7. Ajustar permisos para Apache
RUN chown -R www-data:www-data /var/www/html

# 8. Exponer puerto
EXPOSE 80
