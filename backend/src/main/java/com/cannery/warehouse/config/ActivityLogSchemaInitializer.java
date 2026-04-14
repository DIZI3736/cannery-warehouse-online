package com.cannery.warehouse.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Locale;

@Configuration
public class ActivityLogSchemaInitializer {

    @Bean
    public ApplicationRunner ensureActivityLogSchema(JdbcTemplate jdbcTemplate) {
        return args -> {
            jdbcTemplate.execute("""
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

            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255)");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS product_id BIGINT");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS action_type VARCHAR(50)");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS field_name VARCHAR(255)");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS old_value TEXT");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS new_value TEXT");
            jdbcTemplate.execute("ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS description TEXT");

            ensureTextColumn(jdbcTemplate, "actor_name", "VARCHAR(255)");
            ensureTextColumn(jdbcTemplate, "actor_role", "VARCHAR(50)");
            ensureTextColumn(jdbcTemplate, "product_name", "VARCHAR(255)");
            ensureTextColumn(jdbcTemplate, "action_type", "VARCHAR(50)");
            ensureTextColumn(jdbcTemplate, "field_name", "VARCHAR(255)");
            ensureTextColumn(jdbcTemplate, "old_value", "TEXT");
            ensureTextColumn(jdbcTemplate, "new_value", "TEXT");
            ensureTextColumn(jdbcTemplate, "description", "TEXT");
        };
    }

    private void ensureTextColumn(JdbcTemplate jdbcTemplate, String columnName, String targetType) {
        String sqlType = jdbcTemplate.query(
                """
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
