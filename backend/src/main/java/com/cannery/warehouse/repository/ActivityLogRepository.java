package com.cannery.warehouse.repository;

import com.cannery.warehouse.model.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findTop100ByOrderByCreatedAtDesc();

    @Query("SELECT l FROM ActivityLog l WHERE " +
           "(:productName IS NULL OR LOWER(l.productName) LIKE LOWER(CONCAT('%', :productName, '%'))) AND " +
           "(:startDate IS NULL OR l.createdAt >= :startDate) AND " +
           "(:endDate IS NULL OR l.createdAt <= :endDate) " +
           "ORDER BY l.createdAt DESC")
    List<ActivityLog> findByFilters(
            @Param("productName") String productName,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );
}
