# 🚀 Инструкция по деплою (Production)

Проект настроен для полностью бесплатного деплоя (**Forever Free**) с использованием современных облачных сервисов.

## 1. База данных (PostgreSQL)
- Используется **Neon.tech**.
- Создайте новый проект на [Neon.tech](https://neon.tech).
- Выберите PostgreSQL.
- Получите строку подключения (**Connection String**). Она будет выглядеть так:
  `postgresql://user:password@host/dbname?sslmode=require`

## 2. Бэкенд (Render.com)
- Создайте новый **Web Service** на [Render.com](https://render.com).
- Подключите ваш GitHub репозиторий.
- Выберите `Docker` в качестве окружения (Environment).
- Render автоматически подхватит настройки из `render.yaml` и `backend/Dockerfile`.
- В разделе **Environment Variables** добавьте:
  - `SPRING_DATASOURCE_URL`: (Ваша строка подключения от Neon)
  - `SPRING_DATASOURCE_USERNAME`: (Ваш логин от Neon)
  - `SPRING_DATASOURCE_PASSWORD`: (Ваш пароль от Neon)
  - `SPRING_DATASOURCE_DRIVER_CLASS_NAME`: `org.postgresql.Driver`
  - `SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT`: `org.hibernate.dialect.PostgreSQLDialect`

## 3. Фронтенд (Render.com Static Site)
- Создайте новый **Static Site** на Render.
- В настройках укажите:
  - **Build Command**: `cd frontend && npm install && npm run build`
  - **Publish Directory**: `frontend/dist`
- В разделе **Environment Variables** добавьте:
  - `VITE_API_URL`: (URL вашего развернутого бэкенда, например `https://cannery-backend.onrender.com`)

## 4. Домен (По желанию)
- Вы можете привязать кастомный домен (например, `farmer.indevs.in`) через настройки Render.

---
*Конфигурация автоматизирована через файл `render.yaml` в корне проекта.*
