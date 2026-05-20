package com.cannery.warehouse.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.Locale;

@Configuration
public class ActivityLogSchemaInitializer {

    @Bean
    public ApplicationRunner ensureActivityLogSchema(JdbcTemplate jdbcTemplate) {
        return args -> {
            boolean mysql = isMysql(jdbcTemplate);

            jdbcTemplate.execute(mysql ? """
                    CREATE TABLE IF NOT EXISTS activity_log (
                        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        created_at TIMESTAMP NULL,
                        actor_name VARCHAR(255),
                        actor_role VARCHAR(50),
                        product_id BIGINT,
                        product_name VARCHAR(255),
                        action_type VARCHAR(50),
                        field_name VARCHAR(255),
                        old_value TEXT,
                        new_value TEXT,
                        description TEXT
                    )
                    """ : """
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
                    )
                    """);

            addColumnIfMissing(jdbcTemplate, "created_at",
                    mysql ? "TIMESTAMP NULL" : "TIMESTAMP WITHOUT TIME ZONE", mysql);
            addColumnIfMissing(jdbcTemplate, "actor_name", "VARCHAR(255)", mysql);
            addColumnIfMissing(jdbcTemplate, "actor_role", "VARCHAR(50)", mysql);
            addColumnIfMissing(jdbcTemplate, "product_id", "BIGINT", mysql);
            addColumnIfMissing(jdbcTemplate, "product_name", "VARCHAR(255)", mysql);
            addColumnIfMissing(jdbcTemplate, "action_type", "VARCHAR(50)", mysql);
            addColumnIfMissing(jdbcTemplate, "field_name", "VARCHAR(255)", mysql);
            addColumnIfMissing(jdbcTemplate, "old_value", "TEXT", mysql);
            addColumnIfMissing(jdbcTemplate, "new_value", "TEXT", mysql);
            addColumnIfMissing(jdbcTemplate, "description", "TEXT", mysql);

            ensureTextColumn(jdbcTemplate, "actor_name", "VARCHAR(255)", mysql);
            ensureTextColumn(jdbcTemplate, "actor_role", "VARCHAR(50)", mysql);
            ensureTextColumn(jdbcTemplate, "product_name", "VARCHAR(255)", mysql);
            ensureTextColumn(jdbcTemplate, "action_type", "VARCHAR(50)", mysql);
            ensureTextColumn(jdbcTemplate, "field_name", "VARCHAR(255)", mysql);
            ensureTextColumn(jdbcTemplate, "old_value", "TEXT", mysql);
            ensureTextColumn(jdbcTemplate, "new_value", "TEXT", mysql);
            ensureTextColumn(jdbcTemplate, "description", "TEXT", mysql);
        };
    }

    private boolean isMysql(JdbcTemplate jdbcTemplate) {
        return jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            try {
                DatabaseMetaData metaData = connection.getMetaData();
                return metaData.getDatabaseProductName().toLowerCase(Locale.ROOT).contains("mysql");
            } catch (SQLException ex) {
                throw new IllegalStateException("Failed to determine database type", ex);
            }
        });
    }

    private void addColumnIfMissing(JdbcTemplate jdbcTemplate, String columnName, String columnDefinition, boolean mysql) {
        if (columnExists(jdbcTemplate, columnName, mysql)) {
            return;
        }

        jdbcTemplate.execute(String.format(
                "ALTER TABLE activity_log ADD COLUMN %s %s",
                columnName,
                columnDefinition
        ));
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String columnName, boolean mysql) {
        Integer count = jdbcTemplate.queryForObject(
                mysql
                        ? """
                                SELECT COUNT(*)
                                FROM information_schema.columns
                                WHERE table_schema = DATABASE() AND table_name = 'activity_log' AND column_name = ?
                                """
                        : """
                                SELECT COUNT(*)
                                FROM information_schema.columns
                                WHERE table_name = 'activity_log' AND column_name = ?
                                """,
                Integer.class,
                columnName
        );

        return count != null && count > 0;
    }

    private void ensureTextColumn(JdbcTemplate jdbcTemplate, String columnName, String targetType, boolean mysql) {
        String sqlType = jdbcTemplate.query(
                mysql
                        ? """
                                SELECT data_type
                                FROM information_schema.columns
                                WHERE table_schema = DATABASE() AND table_name = 'activity_log' AND column_name = ?
                                """
                        : """
                                SELECT data_type
                                FROM information_schema.columns
                                WHERE table_name = 'activity_log' AND column_name = ?
                                """,
                rs -> rs.next() ? rs.getString("data_type") : null,
                columnName
        );

        if (sqlType == null) {
            return;
        }

        String normalizedType = sqlType.toLowerCase(Locale.ROOT);
        if ("bytea".equals(normalizedType)) {
            jdbcTemplate.execute(String.format(
                    "ALTER TABLE activity_log ALTER COLUMN %s TYPE %s USING convert_from(%s, 'UTF8')",
                    columnName,
                    targetType,
                    columnName
            ));
            return;
        }

        if (mysql) {
            jdbcTemplate.execute(String.format(
                    "ALTER TABLE activity_log MODIFY COLUMN %s %s",
                    columnName,
                    targetType
            ));
            return;
        }

        if (!normalizedType.contains("character") && !"text".equals(normalizedType)) {
            jdbcTemplate.execute(String.format(
                    "ALTER TABLE activity_log ALTER COLUMN %s TYPE %s USING %s::text",
                    columnName,
                    targetType,
                    columnName
            ));
            return;
        }

        jdbcTemplate.execute(String.format(
                "ALTER TABLE activity_log ALTER COLUMN %s TYPE %s",
                columnName,
                targetType
        ));
    }
}
