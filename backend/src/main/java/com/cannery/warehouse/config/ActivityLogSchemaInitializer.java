package com.cannery.warehouse.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

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

            jdbcTemplate.execute("ALTER TABLE activity_log ALTER COLUMN old_value TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE activity_log ALTER COLUMN new_value TYPE TEXT");
            jdbcTemplate.execute("ALTER TABLE activity_log ALTER COLUMN description TYPE TEXT");
        };
    }
}
