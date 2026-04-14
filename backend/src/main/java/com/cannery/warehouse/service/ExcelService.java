package com.cannery.warehouse.service;

import com.cannery.warehouse.model.Category;
import com.cannery.warehouse.model.PackagingType;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.QualityStatus;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ExcelService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ActivityLogService activityLogService;

    public ExcelService(CategoryRepository categoryRepository,
                        ProductRepository productRepository,
                        ActivityLogService activityLogService) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.activityLogService = activityLogService;
    }

    public ByteArrayInputStream productsToExcel(List<Product> products) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        boolean hidePrice = "STOREKEEPER".equals(role);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // "\u0422\u043e\u0432\u0430\u0440\u044b" = Товары
            Sheet sheet = workbook.createSheet("\u0422\u043e\u0432\u0430\u0440\u044b");

            String[] columns = hidePrice
                    ? new String[]{
                        "id", 
                        "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", // Название
                        "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f", // Категория
                        "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e", // Количество
                        "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", // Комментарий
                        "\u0421\u0442\u0430\u0442\u0443\u0441 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430", // Статус качества
                        "\u0423\u043f\u0430\u043a\u043e\u0432\u043a\u0430", // Упаковка
                        "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c", // Производитель
                        "\u0411\u0440\u0435\u043d\u0434" // Бренд
                    }
                    : new String[]{
                        "id", 
                        "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", // Название
                        "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f", // Категория
                        "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e", // Количество
                        "\u0426\u0435\u043d\u0430", // Цена
                        "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", // Комментарий
                        "\u0421\u0442\u0430\u0442\u0443\u0441 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430", // Статус качества
                        "\u0423\u043f\u0430\u043a\u043e\u0432\u043a\u0430", // Упаковка
                        "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c", // Производитель
                        "\u0411\u0440\u0435\u043d\u0434" // Бренд
                    };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < columns.length; i++) {
                headerRow.createCell(i).setCellValue(columns[i]);
            }

            int rowIdx = 1;
            for (Product product : products) {
                Row row = sheet.createRow(rowIdx++);
                int cellIndex = 0;
                row.createCell(cellIndex++).setCellValue(product.getId() != null ? product.getId() : 0);
                row.createCell(cellIndex++).setCellValue(safe(product.getName()));
                row.createCell(cellIndex++).setCellValue(product.getCategory() != null ? safe(product.getCategory().getName()) : "");
                row.createCell(cellIndex++).setCellValue(product.getQuantity() != null ? product.getQuantity() : 0);

                if (!hidePrice) {
                    Cell priceCell = row.createCell(cellIndex++);
                    priceCell.setCellValue(product.getPrice() != null ? product.getPrice().doubleValue() : 0);
                }

                row.createCell(cellIndex++).setCellValue(safe(product.getNotes()));
                row.createCell(cellIndex++).setCellValue(formatQualityStatus(product.getQualityStatus()));
                row.createCell(cellIndex++).setCellValue(formatPackagingType(product.getPackagingType()));
                row.createCell(cellIndex++).setCellValue(safe(product.getManufacturer()));
                row.createCell(cellIndex).setCellValue(safe(product.getBrand()));
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to export Excel file: " + e.getMessage());
        }
    }

    public void save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("\u0424\u0430\u0439\u043b \u0434\u043b\u044f \u0438\u043c\u043f\u043e\u0440\u0442\u0430 \u043f\u0443\u0441\u0442");
        }

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row firstRow = sheet.getRow(sheet.getFirstRowNum());
            Map<String, Integer> columns = resolveColumnIndexes(firstRow);
            boolean headerPresent = isHeaderRow(firstRow);
            if (!headerPresent) {
                columns.putIfAbsent("name", 1);
                columns.putIfAbsent("category", 2);
                columns.putIfAbsent("quantity", 3);
                columns.putIfAbsent("price", 4);
            }

            int startRowIndex = headerPresent ? firstRow.getRowNum() + 1 : sheet.getFirstRowNum();
            int maxColumnIndex = firstRow != null ? firstRow.getLastCellNum() : 0;
            Map<String, Product> processedProducts = new HashMap<>();

            for (int rowIndex = startRowIndex; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isRowEmpty(row, maxColumnIndex)) {
                    continue;
                }

                String rawName = getCellValueAsString(getCell(row, columns, "name", 1)).trim();
                String normalizedName = normalizeProductName(rawName);
                if (normalizedName.isEmpty()) {
                    throw new IllegalArgumentException("\u0421\u0442\u0440\u043e\u043a\u0430 " + (rowIndex + 1) + ": \u043f\u043e\u043b\u0435 '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435' \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e");
                }

                Long importId = hasColumn(columns, "id")
                        ? parseLong(getCell(row, columns, "id", 0))
                        : null;
                String manufacturer = hasColumn(columns, "manufacturer")
                        ? normalizeOptionalText(getCellValueAsString(getCell(row, columns, "manufacturer", 8)))
                        : null;
                String duplicateKey = buildImportKey(normalizedName, manufacturer);
                Product product = processedProducts.get(duplicateKey);
                if (product == null) {
                    if (importId != null && importId > 0) {
                        product = productRepository.findById(importId).orElse(null);
                    }
                    List<Product> sameNameProducts = productRepository.findAllByNameIgnoreCaseOrderByIdAsc(normalizedName);
                    if (product == null) {
                        product = sameNameProducts.stream()
                                .filter(existing -> sameManufacturer(existing.getManufacturer(), manufacturer))
                                .findFirst()
                                .orElse(null);
                    }

                    if (product == null && manufacturer == null && !sameNameProducts.isEmpty()) {
                        throw new IllegalArgumentException(
                                "Строка " + (rowIndex + 1) + ": товар \"" + normalizedName
                                        + "\" уже существует. Укажите производителя, чтобы отличить новую позицию."
                        );
                    }

                    if (product == null) {
                        product = new Product();
                    }
                }

                boolean isNew = product.getId() == null;
                Product previousState = isNew ? null : copyProduct(product);
                int importedQuantity = parseInteger(
                        getCell(row, columns, "quantity", 3),
                        "\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e",
                        rowIndex,
                        normalizedName,
                        0
                );

                product.setName(normalizedName);
                product.setQuantity(importedQuantity);

                if (hasColumn(columns, "price")) {
                    product.setPrice(parseDecimal(
                            getCell(row, columns, "price", 4),
                            "\u0446\u0435\u043d\u0430",
                            rowIndex,
                            normalizedName,
                            isNew ? BigDecimal.ZERO : product.getPrice()
                    ));
                } else if (isNew && product.getPrice() == null) {
                    product.setPrice(BigDecimal.ZERO);
                }

                String categoryName = getCellValueAsString(getCell(row, columns, "category", 2)).trim();
                if (hasColumn(columns, "category")) {
                    product.setCategory(resolveCategory(categoryName));
                }

                if (hasColumn(columns, "notes")) {
                    product.setNotes(normalizeOptionalText(getCellValueAsString(getCell(row, columns, "notes", 5))));
                }
                if (hasColumn(columns, "qualityStatus")) {
                    product.setQualityStatus(parseQualityStatus(getCellValueAsString(getCell(row, columns, "qualityStatus", 6)), rowIndex));
                }
                if (hasColumn(columns, "packagingType")) {
                    product.setPackagingType(parsePackagingType(getCellValueAsString(getCell(row, columns, "packagingType", 7)), rowIndex));
                }
                if (hasColumn(columns, "manufacturer")) {
                    product.setManufacturer(manufacturer);
                }
                if (hasColumn(columns, "brand")) {
                    product.setBrand(normalizeOptionalText(getCellValueAsString(getCell(row, columns, "brand", 9))));
                }

                Product saved = productRepository.save(product);
                processedProducts.put(duplicateKey, saved);
                if (isNew) {
                    activityLogService.logProductCreated(saved);
                } else {
                    logFieldChanges(previousState, saved, hasColumn(columns, "price"));
                }
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("\u041e\u0448\u0438\u0431\u043a\u0430 \u0447\u0442\u0435\u043d\u0438\u044f \u0444\u0430\u0439\u043b\u0430 Excel: " + (e.getMessage() != null ? e.getMessage() : ""));
        }
    }
    private Map<String, Integer> resolveColumnIndexes(Row row) {
        Map<String, Integer> indexes = new HashMap<>();
        if (row == null) {
            indexes.put("name", 1);
            indexes.put("category", 2);
            indexes.put("quantity", 3);
            indexes.put("price", 4);
            return indexes;
        }

        for (int i = 0; i < row.getLastCellNum(); i++) {
            String header = normalizeHeader(getCellValueAsString(row.getCell(i)));
            if (header.isEmpty()) {
                continue;
            }
            switch (header) {
                case "id":
                    indexes.put("id", i);
                    break;
                case "name":
                case "\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435":
                    indexes.put("name", i);
                    break;
                case "category":
                case "\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f":
                    indexes.put("category", i);
                    break;
                case "quantity":
                case "\u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e":
                    indexes.put("quantity", i);
                    break;
                case "price":
                case "\u0446\u0435\u043d\u0430":
                    indexes.put("price", i);
                    break;
                case "notes":
                case "comment":
                case "\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439":
                    indexes.put("notes", i);
                    break;
                case "qualitystatus":
                case "quality":
                case "\u0441\u0442\u0430\u0442\u0443\u0441\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430":
                case "\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e":
                    indexes.put("qualityStatus", i);
                    break;
                case "packagingtype":
                case "packaging":
                case "\u0444\u0430\u0441\u043e\u0432\u043a\u0430":
                case "\u0435\u0434\u0438\u043d\u0438\u0446\u0430\u0438\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u044f":
                    indexes.put("packagingType", i);
                    break;
                case "manufacturer":
                case "\u043f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c":
                    indexes.put("manufacturer", i);
                    break;
                case "brand":
                case "\u0431\u0440\u0435\u043d\u0434":
                    indexes.put("brand", i);
                    break;
                default:
                    break;
            }
        }

        return indexes;
    }

    private boolean isHeaderRow(Row row) {
        if (row == null) {
            return false;
        }
        String first = normalizeHeader(getCellValueAsString(row.getCell(0)));
        String second = normalizeHeader(getCellValueAsString(row.getCell(1)));
        return "id".equals(first)
                || "name".equals(second)
                || "\u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435".equals(second);
    }

    private boolean isRowEmpty(Row row, int maxColumnIndex) {
        int cellsToCheck = Math.max(maxColumnIndex, 10);
        for (int i = 0; i < cellsToCheck; i++) {
            if (!getCellValueAsString(row.getCell(i)).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private Cell getCell(Row row, Map<String, Integer> columns, String key, int fallbackIndex) {
        Integer index = columns.get(key);
        return row.getCell(index != null ? index : fallbackIndex);
    }

    private boolean hasColumn(Map<String, Integer> columns, String key) {
        return columns.containsKey(key);
    }

    private Integer parseInteger(Cell cell, String fieldLabel, int rowIndex, String productName, Integer defaultValue) {
        String raw = getCellValueAsString(cell).trim();
        if (raw.isEmpty()) {
            return defaultValue;
        }
        try {
            int value = Integer.parseInt(raw.replace(".0", ""));
            if (value < 0) {
                throw new IllegalArgumentException("\u0421\u0442\u0440\u043e\u043a\u0430 " + (rowIndex + 1) + ": \u043f\u043e\u043b\u0435 '" + fieldLabel + "' \u0434\u043b\u044f \u0442\u043e\u0432\u0430\u0440\u0430 \"" + productName + "\" \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u043c");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("\u0421\u0442\u0440\u043e\u043a\u0430 " + (rowIndex + 1) + ": \u043d\u0435\u0432\u0435\u0440\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u0435 '" + fieldLabel + "' \u0434\u043b\u044f \u0442\u043e\u0432\u0430\u0440\u0430 \"" + productName + "\"");
        }
    }

    private BigDecimal parseDecimal(Cell cell, String fieldLabel, int rowIndex, String productName, BigDecimal defaultValue) {
        String raw = getCellValueAsString(cell).trim();
        if (raw.isEmpty()) {
            return defaultValue;
        }
        try {
            BigDecimal value = new BigDecimal(raw.replace(",", "."));
            if (value.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("\u0421\u0442\u0440\u043e\u043a\u0430 " + (rowIndex + 1) + ": \u043f\u043e\u043b\u0435 '" + fieldLabel + "' \u0434\u043b\u044f \u0442\u043e\u0432\u0430\u0440\u0430 \"" + productName + "\" \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u043c");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("\u0421\u0442\u0440\u043e\u043a\u0430 " + (rowIndex + 1) + ": \u043d\u0435\u0432\u0435\u0440\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u0435 '" + fieldLabel + "' \u0434\u043b\u044f \u0442\u043e\u0432\u0430\u0440\u0430 \"" + productName + "\"");
        }
    }

    private Category resolveCategory(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return categoryRepository.findByNameIgnoreCase(name.trim()).orElseGet(() -> {
            Category category = new Category();
            category.setName(name.trim());
            return categoryRepository.save(category);
        });
    }

    private QualityStatus parseQualityStatus(String raw, int rowIndex) {
        String normalized = normalizeOptionalText(raw);
        if (normalized == null) {
            return null;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.equals("normal") || lower.equals("\u043d\u043e\u0440\u043c\u0430")) return QualityStatus.NORMAL;
        if (lower.equals("review") || lower.contains("\u0432\u043e\u043f\u0440\u043e\u0441")) return QualityStatus.REVIEW;
        if (lower.equals("defect") || lower.equals("\u0431\u0440\u0430\u043a")) return QualityStatus.DEFECT;
        return null;
    }

    private PackagingType parsePackagingType(String raw, int rowIndex) {
        String normalized = normalizeOptionalText(raw);
        if (normalized == null) {
            return null;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.equals("cans") || lower.contains("\u0431\u0430\u043d\u043a")) return PackagingType.CANS;
        if (lower.equals("boxes") || lower.contains("\u043a\u043e\u0440\u043e\u0431")) return PackagingType.BOXES;
        if (lower.equals("packages") || lower.contains("\u043f\u0430\u043a\u0435\u0442") || lower.contains("\u0443\u043f\u0430\u043a\u043e\u0432")) return PackagingType.PACKAGES;
        if (lower.equals("pieces") || lower.contains("\u0448\u0442\u0443\u043a")) return PackagingType.PIECES;
        return null;
    }

    private Product copyProduct(Product source) {
        Product snapshot = new Product();
        snapshot.setId(source.getId());
        snapshot.setName(source.getName());
        snapshot.setCategory(source.getCategory());
        snapshot.setQuantity(source.getQuantity());
        snapshot.setPhotoUrl(source.getPhotoUrl());
        snapshot.setPrice(source.getPrice());
        snapshot.setNotes(source.getNotes());
        snapshot.setQualityStatus(source.getQualityStatus());
        snapshot.setPackagingType(source.getPackagingType());
        snapshot.setManufacturer(source.getManufacturer());
        snapshot.setBrand(source.getBrand());
        return snapshot;
    }

    private void logFieldChanges(Product previous, Product current, boolean includePrice) {
        activityLogService.logFieldChange(current, "name", "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435", previous.getName(), current.getName());
        activityLogService.logFieldChange(current, "quantity", "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e", previous.getQuantity(), current.getQuantity());
        activityLogService.logFieldChange(current, "category", "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f", previous.getCategory() != null ? previous.getCategory().getName() : null, current.getCategory() != null ? current.getCategory().getName() : null);
        activityLogService.logFieldChange(current, "notes", "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439", previous.getNotes(), current.getNotes());
        activityLogService.logFieldChange(current, "qualityStatus", "\u0421\u0442\u0430\u0442\u0443\u0441 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0430", previous.getQualityStatus(), current.getQualityStatus());
        activityLogService.logFieldChange(current, "packagingType", "\u0424\u0430\u0441\u043e\u0432\u043a\u0430", previous.getPackagingType(), current.getPackagingType());
        activityLogService.logFieldChange(current, "manufacturer", "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c", previous.getManufacturer(), current.getManufacturer());
        activityLogService.logFieldChange(current, "brand", "\u0411\u0440\u0435\u043d\u0434", previous.getBrand(), current.getBrand());
        if (includePrice) {
            activityLogService.logFieldChange(current, "price", "\u0426\u0435\u043d\u0430", previous.getPrice(), current.getPrice());
        }
    }

    private String normalizeProductName(String name) {
        String trimmedName = name != null ? name.trim() : "";
        if (trimmedName.isEmpty()) {
            return trimmedName;
        }
        return trimmedName.substring(0, 1).toUpperCase(Locale.forLanguageTag("ru-RU")) + trimmedName.substring(1);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.replace(" ", "").toLowerCase(Locale.ROOT);
    }

    private Long parseLong(Cell cell) {
        String raw = getCellValueAsString(cell).trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(raw.replace(".0", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String buildImportKey(String productName, String manufacturer) {
        String normalizedManufacturer = normalizeOptionalText(manufacturer);
        return productName.toLowerCase(Locale.ROOT) + "::"
                + (normalizedManufacturer == null ? "__none__" : normalizedManufacturer.toLowerCase(Locale.ROOT));
    }

    private boolean sameManufacturer(String left, String right) {
        String normalizedLeft = normalizeOptionalText(left);
        String normalizedRight = normalizeOptionalText(right);
        if (normalizedLeft == null || normalizedRight == null) {
            return normalizedLeft == null && normalizedRight == null;
        }
        return normalizedLeft.equalsIgnoreCase(normalizedRight);
    }

    private String formatQualityStatus(QualityStatus qualityStatus) {
        if (qualityStatus == null) return "";
        switch (qualityStatus) {
            case NORMAL: return "\u041d\u043e\u0440\u043c\u0430"; // Норма
            case REVIEW: return "\u041f\u043e\u0434 \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u043c"; // Под вопросом
            case DEFECT: return "\u0411\u0440\u0430\u043a"; // Брак
            default: return "";
        }
    }

    private String formatPackagingType(PackagingType packagingType) {
        if (packagingType == null) return "";
        switch (packagingType) {
            case CANS: return "\u0411\u0430\u043d\u043a\u0438"; // Банки
            case BOXES: return "\u041a\u043e\u0440\u043e\u0431\u043a\u0438"; // Коробки
            case PACKAGES: return "\u0423\u043f\u0430\u043a\u043e\u0432\u043a\u0438"; // Упаковки
            case PIECES: return "\u0428\u0442\u0443\u043a\u0438"; // Штуки
            default: return "";
        }
    }

    private String safe(String value) {
        return value != null ? value : "";
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return "";
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getDateCellValue().toString();
                }
                double numericValue = cell.getNumericCellValue();
                if (Math.floor(numericValue) == numericValue) {
                    return String.valueOf((long) numericValue);
                }
                return String.valueOf(numericValue);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            case BLANK:
            default:
                return "";
        }
    }
}
