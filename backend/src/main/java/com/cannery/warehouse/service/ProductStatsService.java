package com.cannery.warehouse.service;

import com.cannery.warehouse.dto.CategoryStatDTO;
import com.cannery.warehouse.dto.DeficitItemDTO;
import com.cannery.warehouse.dto.ProductStatsDTO;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.Role;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProductStatsService {

    public ProductStatsDTO buildStats(List<Product> products, Role role) {
        ProductStatsDTO stats = new ProductStatsDTO();

        if (role == Role.STOREKEEPER) {
            stats.setDeficitItems(buildDeficitItems(products));
            return stats;
        }

        if (role == Role.ACCOUNTANT) {
            stats.setTotalValue(calculateTotalValue(products));
            return stats;
        }

        if (role == Role.SALES_MANAGER) {
            stats.setCategoryStats(buildCategoryStats(products));
        }

        return stats;
    }

    private List<DeficitItemDTO> buildDeficitItems(List<Product> products) {
        List<DeficitItemDTO> deficitItems = new ArrayList<>();

        for (Product product : products) {
            int quantity = product.getQuantity() != null ? product.getQuantity() : 0;
            if (quantity < 200) {
                deficitItems.add(new DeficitItemDTO(product.getId(), product.getName(), quantity));
            }
        }

        return deficitItems;
    }

    private BigDecimal calculateTotalValue(List<Product> products) {
        BigDecimal totalValue = BigDecimal.ZERO;

        for (Product product : products) {
            if (product.getPrice() == null || product.getQuantity() == null) {
                continue;
            }

            totalValue = totalValue.add(product.getPrice().multiply(BigDecimal.valueOf(product.getQuantity())));
        }

        return totalValue;
    }

    private List<CategoryStatDTO> buildCategoryStats(List<Product> products) {
        Map<String, Integer> categoryTotals = new LinkedHashMap<>();
        int totalQuantity = 0;

        for (Product product : products) {
            int quantity = product.getQuantity() != null ? product.getQuantity() : 0;
            String categoryName = product.getCategory() != null ? product.getCategory().getName() : "Без категории";

            categoryTotals.merge(categoryName, quantity, Integer::sum);
            totalQuantity += quantity;
        }

        List<CategoryStatDTO> categoryStats = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : categoryTotals.entrySet()) {
            int percent = totalQuantity == 0
                    ? 0
                    : (int) Math.round((entry.getValue() * 100.0) / totalQuantity);
            categoryStats.add(new CategoryStatDTO(entry.getKey(), percent));
        }

        return categoryStats;
    }
}
