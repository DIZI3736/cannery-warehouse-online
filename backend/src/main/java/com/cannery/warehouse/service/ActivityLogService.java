package com.cannery.warehouse.service;

import com.cannery.warehouse.model.ActivityLog;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.User;
import com.cannery.warehouse.repository.ActivityLogRepository;
import com.cannery.warehouse.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository, UserRepository userRepository) {
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
    }

    public List<ActivityLog> getRecentLogs(String productName, LocalDate startDate, LocalDate endDate) {
        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime endDateTime = endDate != null ? endDate.plusDays(1).atStartOfDay().minusNanos(1) : null;

        return activityLogRepository.findByFilters(productName, startDateTime, endDateTime).stream()
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

}
