package com.cannery.warehouse.controller;

import com.cannery.warehouse.model.ActivityLog;
import com.cannery.warehouse.service.ActivityLogService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    public ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SALES_MANAGER')")
    public List<ActivityLog> getRecentLogs(
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return activityLogService.getRecentLogs(productName, startDate, endDate);
    }

    @DeleteMapping
    @PreAuthorize("hasAuthority('STOREKEEPER')")
    public void clearLogs() {
        activityLogService.clearAllLogs();
    }
}
