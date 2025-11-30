FROM php:8.2-apache

# Instalar dependencias del sistema, extensiones de PHP y utilidades para Composer
RUN apt-get update && apt-get install -y \
    libpq-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql

# Instalar Composer globalmente
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# Copiar el código fuente
COPY . /var/www/html/

# Establecer directorio de trabajo
WORKDIR /var/www/html/

# Instalar dependencias de PHP (PHPMailer, etc.)
# --no-dev: no instalar dependencias de desarrollo
# --optimize-autoloader: optimizar la carga de clases
RUN composer install --no-dev --optimize-autoloader

# Establecer permisos correctos
RUN chown -R www-data:www-data /var/www/html

# Exponer el puerto 80
EXPOSE 80
