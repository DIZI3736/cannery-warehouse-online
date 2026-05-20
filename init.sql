-- Скрипт инициализации базы данных для PostgreSQL (Neon.tech)
-- Тема: Автоматизация склада консервного завода

-- 1. Удаление таблиц (для чистого запуска, если нужно)
-- DROP TABLE IF EXISTS activity_log;
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

-- 5. Таблица журнала изменений
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
