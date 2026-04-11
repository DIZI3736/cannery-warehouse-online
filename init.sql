-- Скрипт инициализации базы данных для PostgreSQL (Neon.tech)
-- Тема: Автоматизация склада консервного завода

-- 1. Удаление таблиц (для чистого запуска, если нужно)
-- DROP TABLE IF EXISTS activity_log;
-- DROP TABLE IF EXISTS order_items;
-- DROP TABLE IF EXISTS orders;
-- DROP TABLE IF EXISTS addresses;
-- DROP TABLE IF EXISTS product;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS categories;

-- 2. Таблица Категорий
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- 3. Таблица Пользователей
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    company_name VARCHAR(255),
    role VARCHAR(50) NOT NULL
);

-- 4. Таблица Товаров
CREATE TABLE IF NOT EXISTS product (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 0,
    price DECIMAL(19, 2),
    photo_url VARCHAR(255),
    notes TEXT,
    quality_status VARCHAR(40),
    packaging_type VARCHAR(40),
    manufacturer VARCHAR(255),
    brand VARCHAR(255),
    category_id BIGINT,
    CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 5. Таблица Адресов
CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    user_id BIGINT,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Таблица Заказов
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(50),
    store_director_id BIGINT,
    driver_id BIGINT,
    delivery_address_id BIGINT,
    CONSTRAINT fk_store_director FOREIGN KEY (store_director_id) REFERENCES users(id),
    CONSTRAINT fk_driver FOREIGN KEY (driver_id) REFERENCES users(id),
    CONSTRAINT fk_delivery_address FOREIGN KEY (delivery_address_id) REFERENCES addresses(id)
);

-- 7. Таблица Состава заказа
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT,
    product_id BIGINT,
    quantity INT,
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES product(id)
);

-- 8. Таблица журнала изменений
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    actor_name VARCHAR(255),
    actor_role VARCHAR(50),
    product_id BIGINT,
    product_name VARCHAR(255),
    action_type VARCHAR(50),
    field_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    description TEXT
);


-- ПРИМЕЧАНИЕ: Spring Boot автоматически заполнит данные (пользователей и товары) 
-- через класс DataInitializer при первом запуске приложения.
