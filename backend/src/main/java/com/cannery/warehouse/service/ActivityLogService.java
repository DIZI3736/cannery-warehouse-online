package com.cannery.warehouse.service;

import com.cannery.warehouse.model.ActivityLog;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.User;
import com.cannery.warehouse.repository.ActivityLogRepository;
import com.cannery.warehouse.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public ActivityLogService(ActivityLogRepository activityLogRepository,
                              UserRepository userRepository,
                              JdbcTemplate jdbcTemplate) {
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ActivityLog> getRecentLogs(String productName, LocalDate startDate, LocalDate endDate) {
        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime endDateTime = endDate != null ? endDate.plusDays(1).atStartOfDay().minusNanos(1) : null;
        String trimmedProductName = productName != null && !productName.isBlank() ? productName.trim() : null;

        boolean isMysql = Boolean.TRUE.equals(jdbcTemplate.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>) connection ->
                connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("mysql")
        ));

        String actorNameExpr = textColumnExpression("al", "actor_name", isMysql);
        String actorRoleExpr = textColumnExpression("al", "actor_role", isMysql);
        String productNameExpr = textColumnExpression("al", "product_name", isMysql);
        String actionTypeExpr = textColumnExpression("al", "action_type", isMysql);
        String fieldNameExpr = textColumnExpression("al", "field_name", isMysql);
        String oldValueExpr = textColumnExpression("al", "old_value", isMysql);
        String newValueExpr = textColumnExpression("al", "new_value", isMysql);
        String descriptionExpr = textColumnExpression("al", "description", isMysql);

        StringBuilder sql = new StringBuilder("""
                SELECT
                    al.id,
                    al.created_at,
                    %s AS actor_name,
                    %s AS actor_role,
                    al.product_id,
                    %s AS product_name,
                    %s AS action_type,
                    %s AS field_name,
                    %s AS old_value,
                    %s AS new_value,
                    %s AS description
                FROM activity_log al
                LEFT JOIN product p ON al.product_id = p.id
                WHERE 1=1
                """.formatted(
                actorNameExpr,
                actorRoleExpr,
                productNameExpr,
                actionTypeExpr,
                fieldNameExpr,
                oldValueExpr,
                newValueExpr,
                descriptionExpr
        ));

        List<Object> params = new ArrayList<>();
        if (trimmedProductName != null) {
            sql.append(" AND (LOWER(COALESCE(").append(productNameExpr).append(", '')) LIKE LOWER(?)");
            sql.append(" OR LOWER(COALESCE(p.name, '')) LIKE LOWER(?))");
            params.add("%" + trimmedProductName + "%");
            params.add("%" + trimmedProductName + "%");
        }
        if (startDateTime != null) {
            sql.append(" AND al.created_at >= ?");
            params.add(startDateTime);
        }
        if (endDateTime != null) {
            sql.append(" AND al.created_at <= ?");
            params.add(endDateTime);
        }
        sql.append(" ORDER BY al.created_at DESC LIMIT 100");

        return jdbcTemplate.query(
                        sql.toString(),
                        (rs, rowNum) -> {
                            ActivityLog log = new ActivityLog();
                            log.setId(rs.getLong("id"));

                            Timestamp createdAt = rs.getTimestamp("created_at");
                            log.setCreatedAt(createdAt != null ? createdAt.toLocalDateTime() : null);

                            log.setActorName(rs.getString("actor_name"));
                            log.setActorRole(rs.getString("actor_role"));

                            long productId = rs.getLong("product_id");
                            log.setProductId(rs.wasNull() ? null : productId);

                            log.setProductName(rs.getString("product_name"));
                            log.setActionType(rs.getString("action_type"));
                            log.setFieldName(rs.getString("field_name"));
                            log.setOldValue(rs.getString("old_value"));
                            log.setNewValue(rs.getString("new_value"));
                            log.setDescription(rs.getString("description"));
                            return log;
                        },
                        params.toArray()
                ).stream()
                .filter(log -> !"WRITE_OFF".equalsIgnoreCase(log.getActionType()))
                .toList();
    }

    public void clearAllLogs() {
        activityLogRepository.deleteAllInBatch();
    }

    public void logProductCreated(Product product) {
        ActivityLog log = createBaseLog(product, "CREATE");
        log.setDescription("Добавлен новый товар \"" + safeProductName(product) + "\".");
        activityLogRepository.save(log);
    }

    public void logProductDeleted(Product product) {
        ActivityLog log = createBaseLog(product, "DELETE");
        log.setDescription("Удален товар \"" + safeProductName(product) + "\".");
        activityLogRepository.save(log);
    }

    public void logFieldChange(Product product, String fieldName, String fieldLabel, Object oldValue, Object newValue) {
        String oldText = normalizeValue(oldValue);
        String newText = normalizeValue(newValue);
        if (Objects.equals(oldText, newText)) {
            return;
        }

        ActivityLog log = createBaseLog(product, "UPDATE");
        log.setFieldName(fieldName);
        log.setOldValue(oldText);
        log.setNewValue(newText);
        log.setDescription(
                "Изменено поле \"" + fieldLabel + "\" у товара \"" + safeProductName(product)
                        + "\": \"" + oldText + "\" -> \"" + newText + "\"."
        );
        activityLogRepository.save(log);
    }

    private ActivityLog createBaseLog(Product product, String actionType) {
        ActivityLog log = new ActivityLog();
        log.setCreatedAt(LocalDateTime.now());
        log.setActionType(actionType);
        log.setProductId(product != null ? product.getId() : null);
        log.setProductName(safeProductName(product));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            log.setActorName("Система");
            log.setActorRole("SYSTEM");
            return log;
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username).orElse(null);
        log.setActorName(user != null && user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName()
                : username);
        log.setActorRole(user != null && user.getRole() != null ? user.getRole().name() : "UNKNOWN");
        return log;
    }

    private String safeProductName(Product product) {
        return product != null && product.getName() != null && !product.getName().isBlank()
                ? product.getName()
                : "Без названия";
    }

    private String normalizeValue(Object value) {
        if (value == null) {
            return "не указано";
        }

        String text = String.valueOf(value).trim();
        return text.isEmpty() ? "не указано" : text;
    }

    private String textColumnExpression(String alias, String columnName, boolean isMysql) {
        String fullColumn = alias != null && !alias.isEmpty() ? alias + "." + columnName : columnName;
        if (isMysql) {
            return fullColumn;
        }

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
            return fullColumn;
        }

        String normalizedType = sqlType.toLowerCase(Locale.ROOT);
        if ("bytea".equals(normalizedType)) {
            return "convert_from(" + fullColumn + ", 'UTF8')";
        }

        if (!normalizedType.contains("character") && !normalizedType.contains("char") && !"text".equals(normalizedType)) {
            return fullColumn + "::text";
        }

        return fullColumn;
    }
}
