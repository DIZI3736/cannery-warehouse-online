package com.cannery.warehouse.service;

import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

@Service
public class ExcelService {

    private final CategoryRepository categoryRepository;

    public ExcelService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public ByteArrayInputStream productsToExcel(List<Product> products) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        boolean hidePrice = "STOREKEEPER".equals(role);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Products");

            Row headerRow = sheet.createRow(0);
            String[] columns = hidePrice
                    ? new String[]{"ID", "Name", "Category", "Quantity"}
                    : new String[]{"ID", "Name", "Category", "Quantity", "Price"};

            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
            }

            int rowIdx = 1;
            for (Product product : products) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(product.getId() != null ? product.getId() : 0);
                row.createCell(1).setCellValue(product.getName());
                row.createCell(2).setCellValue(product.getCategory() != null ? product.getCategory().getName() : "");
                row.createCell(3).setCellValue(product.getQuantity() != null ? product.getQuantity() : 0);

                if (!hidePrice) {
                    Cell priceCell = row.createCell(4);
                    if (product.getPrice() != null) {
                        priceCell.setCellValue(product.getPrice().doubleValue());
                    } else {
                        priceCell.setCellValue(0);
                    }
                }
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to export Excel file: " + e.getMessage());
        }
    }

    public void save(MultipartFile file, ProductRepository repository, CategoryRepository categoryRepo) {
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row currentRow = sheet.getRow(rowIndex);
                if (currentRow == null) {
                    continue;
                }
                String name = getCellValueAsString(currentRow.getCell(1)).trim();

                if (isRowEmpty(currentRow)) {
                    continue;
                }

                if (rowIndex == 0 && isHeaderRow(currentRow)) {
                    continue;
                }

                if (name.isEmpty()) {
                    throw new IllegalArgumentException(
                            "Строка " + (currentRow.getRowNum() + 1) + ": поле 'Название' обязательно для заполнения."
                    );
                }

                Integer quantity = null;
                Cell qtyCell = currentRow.getCell(3);
                if (qtyCell != null) {
                    if (qtyCell.getCellType() == CellType.NUMERIC) {
                        quantity = (int) qtyCell.getNumericCellValue();
                    } else if (qtyCell.getCellType() != CellType.BLANK) {
                        try {
                            quantity = Integer.parseInt(getCellValueAsString(qtyCell).trim());
                        } catch (NumberFormatException e) {
                            throw new RuntimeException("Invalid quantity for product: " + name);
                        }
                    }
                }

                if (quantity != null && quantity < 0) {
                    throw new RuntimeException("Quantity cannot be negative for product: " + name);
                }

                BigDecimal price = null;
                Cell priceCell = currentRow.getCell(4);
                if (priceCell != null) {
                    if (priceCell.getCellType() == CellType.NUMERIC) {
                        price = BigDecimal.valueOf(priceCell.getNumericCellValue());
                    } else if (priceCell.getCellType() != CellType.BLANK) {
                        try {
                            String priceStr = getCellValueAsString(priceCell).trim().replace(",", ".");
                            price = new BigDecimal(priceStr);
                        } catch (Exception e) {
                            throw new RuntimeException("Invalid price for product: " + name);
                        }
                    }
                }

                if (price != null && price.compareTo(BigDecimal.ZERO) < 0) {
                    throw new RuntimeException("Price cannot be negative for product: " + name);
                }

                Product product = repository.findByNameIgnoreCase(name).orElse(new Product());

                if (product.getId() == null) {
                    product.setName(name);
                    if (quantity == null) {
                        quantity = 0;
                    }
                    if (price == null) {
                        price = BigDecimal.ZERO;
                    }
                }

                if (quantity != null) {
                    product.setQuantity(quantity);
                } else if (product.getQuantity() == null) {
                    product.setQuantity(0);
                }
                if (price != null) {
                    product.setPrice(price);
                } else if (product.getPrice() == null) {
                    product.setPrice(BigDecimal.ZERO);
                }

                String catName = getCellValueAsString(currentRow.getCell(2)).trim();
                if (!catName.isEmpty()) {
                    product.setCategory(categoryRepo.findByNameIgnoreCase(catName).orElseGet(() -> {
                        com.cannery.warehouse.model.Category newCat = new com.cannery.warehouse.model.Category();
                        newCat.setName(catName);
                        return categoryRepo.save(newCat);
                    }));
                } else if (product.getId() == null) {
                    product.setCategory(null);
                }

                repository.save(product);
            }
        } catch (Exception e) {
            e.printStackTrace();
            if (e instanceof IllegalArgumentException) {
                throw (IllegalArgumentException) e;
            }
            throw new RuntimeException(
                    "Ошибка чтения файла Excel: "
                            + (e.getMessage() != null ? e.getMessage() : "Проверьте формат файла (.xlsx или .xls)")
            );
        }
    }

    private boolean isRowEmpty(Row row) {
        for (int i = 0; i <= 4; i++) {
            String value = getCellValueAsString(row.getCell(i)).trim();
            if (!value.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private boolean isHeaderRow(Row row) {
        String firstCell = getCellValueAsString(row.getCell(0)).trim();
        String secondCell = getCellValueAsString(row.getCell(1)).trim();
        return "ID".equalsIgnoreCase(firstCell)
                || "Name".equalsIgnoreCase(secondCell)
                || "Название".equalsIgnoreCase(secondCell);
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
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }
}
