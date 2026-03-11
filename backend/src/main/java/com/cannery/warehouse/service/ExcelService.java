package com.cannery.warehouse.service;

import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Iterator;
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
            String[] columns = hidePrice ? new String[]{"ID", "Name", "Category", "Quantity"} 
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
            Iterator<Row> rows = sheet.iterator();
            
            if (rows.hasNext()) rows.next(); // Skip header

            while (rows.hasNext()) {
                Row currentRow = rows.next();
                if (currentRow.getCell(1) == null || currentRow.getCell(1).getCellType() == CellType.BLANK) continue;

                String name = currentRow.getCell(1).getStringCellValue();
                // Ищем существующий товар по имени
                Product product = repository.findByNameContainingIgnoreCaseOrderByIdAsc(name).stream()
                        .filter(p -> p.getName().equalsIgnoreCase(name))
                        .findFirst()
                        .orElse(new Product());
                
                if (product.getId() == null) {
                    product.setName(name);
                }
                
                if (currentRow.getCell(2) != null && !currentRow.getCell(2).getStringCellValue().trim().isEmpty()) {
                    String catName = currentRow.getCell(2).getStringCellValue().trim();
                    product.setCategory(categoryRepo.findByName(catName).orElseGet(() -> {
                        com.cannery.warehouse.model.Category newCat = new com.cannery.warehouse.model.Category();
                        newCat.setName(catName);
                        return categoryRepo.save(newCat);
                    }));
                } else if (product.getCategory() == null) {
                    // Default category if missing
                    String defCat = "Прочее";
                    product.setCategory(categoryRepo.findByName(defCat).orElseGet(() -> {
                        com.cannery.warehouse.model.Category newCat = new com.cannery.warehouse.model.Category();
                        newCat.setName(defCat);
                        return categoryRepo.save(newCat);
                    }));
                }
                
                if (currentRow.getCell(3) != null && currentRow.getCell(3).getCellType() == CellType.NUMERIC) {
                    product.setQuantity((int) currentRow.getCell(3).getNumericCellValue());
                } else if (product.getQuantity() == null) {
                    product.setQuantity(0);
                }
                
                if (currentRow.getLastCellNum() > 4 && currentRow.getCell(4) != null && currentRow.getCell(4).getCellType() == CellType.NUMERIC) {
                    product.setPrice(BigDecimal.valueOf(currentRow.getCell(4).getNumericCellValue()));
                } else if (product.getPrice() == null) {
                    product.setPrice(BigDecimal.ZERO);
                }

                repository.save(product);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Excel file: " + e.getMessage());
        }
    }
}
