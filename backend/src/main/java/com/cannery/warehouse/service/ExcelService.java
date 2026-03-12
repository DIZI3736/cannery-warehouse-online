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
                String name = getCellValueAsString(currentRow.getCell(1)).trim();
                if (name.isEmpty()) continue;

                // Ищем существующий товар по точному имени (без учета регистра)
                Product product = repository.findByNameIgnoreCase(name)
                        .orElse(new Product());
                
                if (product.getId() == null) {
                    product.setName(name);
                }
                
                String catName = getCellValueAsString(currentRow.getCell(2)).trim();
                if (!catName.isEmpty()) {
                    product.setCategory(categoryRepo.findByNameIgnoreCase(catName).orElseGet(() -> {
                        com.cannery.warehouse.model.Category newCat = new com.cannery.warehouse.model.Category();
                        newCat.setName(catName);
                        return categoryRepo.save(newCat);
                    }));
                } else {
                    // Если категория пустая в Excel, мы её не зануляем, если она уже есть у товара,
                    // либо ставим null для нового товара. 
                    // Хотя если пользователь хочет УДАЛИТЬ категорию через эксель, это сложнее.
                    // Для простоты: если пусто в ячейке, не трогаем категорию существующего товара.
                    if (product.getId() == null) product.setCategory(null);
                }
                
                Cell qtyCell = currentRow.getCell(3);
                if (qtyCell != null) {
                    if (qtyCell.getCellType() == CellType.NUMERIC) {
                        product.setQuantity((int) qtyCell.getNumericCellValue());
                    } else {
                        try {
                            product.setQuantity(Integer.parseInt(getCellValueAsString(qtyCell).trim()));
                        } catch (NumberFormatException e) {
                            if (product.getQuantity() == null) product.setQuantity(0);
                        }
                    }
                } else if (product.getQuantity() == null) {
                    product.setQuantity(0);
                }
                
                Cell priceCell = currentRow.getCell(4);
                if (priceCell != null) {
                    if (priceCell.getCellType() == CellType.NUMERIC) {
                        product.setPrice(BigDecimal.valueOf(priceCell.getNumericCellValue()));
                    } else {
                        try {
                            String priceStr = getCellValueAsString(priceCell).trim().replace(",", ".");
                            product.setPrice(new BigDecimal(priceStr));
                        } catch (Exception e) {
                            if (product.getPrice() == null) product.setPrice(BigDecimal.ZERO);
                        }
                    }
                } else if (product.getPrice() == null) {
                    product.setPrice(BigDecimal.ZERO);
                }

                repository.save(product);
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to parse Excel file: " + e.getMessage());
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) return cell.getDateCellValue().toString();
                return String.valueOf((long)cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA: return cell.getCellFormula();
            default: return "";
        }
    }
}
