package com.cannery.warehouse.controller;

import com.cannery.warehouse.dto.ProductDTO;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import com.cannery.warehouse.service.ExcelService;
import com.cannery.warehouse.service.ProductService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final ExcelService excelService;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    @Value("${upload.path:uploads}")
    private String uploadPath;

    public ProductController(ProductService productService, ExcelService excelService, ProductRepository productRepository, CategoryRepository categoryRepository) {
        this.productService = productService;
        this.excelService = excelService;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
    public List<ProductDTO> getAll(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) Long categoryId) {
        
        List<Product> products = productService.getAllProducts(name, categoryId);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        boolean hidePrice = "STOREKEEPER".equals(role);

        return products.stream().map(p -> {
            ProductDTO dto = new ProductDTO();
            dto.setId(p.getId());
            dto.setName(p.getName());
            dto.setQuantity(p.getQuantity());
            dto.setPhotoUrl(p.getPhotoUrl());
            if (p.getCategory() != null) {
                dto.setCategoryName(p.getCategory().getName());
                dto.setCategoryId(p.getCategory().getId());
            }
            if (!hidePrice) {
                dto.setPrice(p.getPrice());
            }
            return dto;
        }).collect(Collectors.toList());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('STOREKEEPER')")
    public Product create(@RequestBody Product product) {
        return productService.saveProduct(product);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('STOREKEEPER')")
    public Product update(@PathVariable Long id, @RequestBody Product product) {
        product.setId(id);
        return productService.saveProduct(product);
    }

    @PutMapping("/{id}/price")
    @PreAuthorize("hasAuthority('ACCOUNTANT')")
    public Product updatePrice(@PathVariable Long id, @RequestBody java.util.Map<String, BigDecimal> body) {
        return productService.updatePrice(id, body.get("price"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('STOREKEEPER')")
    public void delete(@PathVariable Long id) {
        productService.deleteProduct(id);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAnyAuthority('ACCOUNTANT', 'SALES_MANAGER', 'STOREKEEPER')")
    public ResponseEntity<Resource> getFile() {
        String filename = "products.xlsx";
        InputStreamResource file = new InputStreamResource(excelService.productsToExcel(productService.getAllProducts(null, null)));

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(file);
    }

    @PostMapping("/import")
    @PreAuthorize("hasAnyAuthority('STOREKEEPER', 'ACCOUNTANT')")
    public ResponseEntity<String> importExcel(@RequestParam("file") MultipartFile file) {
        excelService.save(file, productRepository, categoryRepository);
        return ResponseEntity.ok("Import successful");
    }

    @PostMapping("/upload")
    @PreAuthorize("permitAll()")
    public ResponseEntity<String> uploadPhoto(@RequestParam("file") MultipartFile file) {
        System.out.println("Received upload request for file: " + file.getOriginalFilename());
        try {
            Files.createDirectories(Paths.get(uploadPath));
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path path = Paths.get(uploadPath, fileName);
            Files.write(path, file.getBytes());
            return ResponseEntity.ok("/api/products/photos/" + fileName);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error uploading file: " + e.getMessage());
        }
    }

    @GetMapping("/photos/{filename:.+}")
    public ResponseEntity<Resource> getPhoto(@PathVariable String filename) {
        try {
            Path path = Paths.get(uploadPath).resolve(filename).normalize();
            Resource resource = new org.springframework.core.io.UrlResource(path.toUri());
            if (resource.exists()) {
                return ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
