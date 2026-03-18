package com.cannery.warehouse.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class ProductStatsDTO {
    private List<DeficitItemDTO> deficitItems = new ArrayList<>();
    private BigDecimal totalValue = BigDecimal.ZERO;
    private List<CategoryStatDTO> categoryStats = new ArrayList<>();

    public List<DeficitItemDTO> getDeficitItems() {
        return deficitItems;
    }

    public void setDeficitItems(List<DeficitItemDTO> deficitItems) {
        this.deficitItems = deficitItems;
    }

    public BigDecimal getTotalValue() {
        return totalValue;
    }

    public void setTotalValue(BigDecimal totalValue) {
        this.totalValue = totalValue;
    }

    public List<CategoryStatDTO> getCategoryStats() {
        return categoryStats;
    }

    public void setCategoryStats(List<CategoryStatDTO> categoryStats) {
        this.categoryStats = categoryStats;
    }
}
