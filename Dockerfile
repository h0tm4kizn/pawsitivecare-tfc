FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        gettext-base \
        libicu-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libpq-dev \
        libwebp-dev \
        libzip-dev \
        unzip \
        zip \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" bcmath gd intl opcache pdo_pgsql pgsql zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Render secret files are mounted with group ID 1000. Create the matching group
# and allow PHP/Apache to read the mounted PowerSync private key.
RUN groupadd --gid 1000 render-secrets \
    && usermod -a -G render-secrets www-data

COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

COPY backend/ ./
COPY render/apache.conf /etc/apache2/sites-available/000-default.conf
COPY render/start.sh /usr/local/bin/render-start

RUN composer dump-autoload --optimize --no-dev --no-scripts \
    && mkdir -p storage/app storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x /usr/local/bin/render-start

EXPOSE 10000

CMD ["render-start"]
