-- Скрипт инициализации базы данных для курсовой работы
-- Тема: Автоматизация склада консервного завода

-- 1. Создание базы данных (если она еще не создана)
CREATE DATABASE IF NOT EXISTS cannery_db;
USE cannery_db;

-- 2. Таблица Категорий
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- 3. Таблица Пользователей (с поддержкой ролей и доп. полей по ТЗ)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    company_name VARCHAR(255),
    role VARCHAR(50) NOT NULL
);

-- 4. Таблица Товаров
CREATE TABLE IF NOT EXISTS product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 0,
    price DECIMAL(19, 2),
    photo_url VARCHAR(255),
    category_id BIGINT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 5. Таблица Адресов (для Директоров магазинов)
CREATE TABLE IF NOT EXISTS addresses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255),
    latitude DOUBLE,
    longitude DOUBLE,
    user_id BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Таблица Заказов
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME,
    status VARCHAR(50),
    store_director_id BIGINT,
    driver_id BIGINT,
    delivery_address_id BIGINT,
    FOREIGN KEY (store_director_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    FOREIGN KEY (delivery_address_id) REFERENCES addresses(id)
);

-- 7. Таблица Состава заказа (многие-ко-многим)
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT,
    product_id BIGINT,
    quantity INT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES product(id)
);

-- ПРИМЕЧАНИЕ: Spring Boot автоматически заполнит данные (пользователей и товары) 
-- через класс DataInitializer при первом запуске приложения.
