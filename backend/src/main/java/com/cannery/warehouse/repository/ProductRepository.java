package com.cannery.warehouse.repository;

import com.cannery.warehouse.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findAllByOrderByIdAsc();
    List<Product> findAllByNameIgnoreCaseOrderByIdAsc(String name);
    List<Product> findByNameContainingIgnoreCaseOrderByIdAsc(String name);
    List<Product> findByCategoryIdOrderByIdAsc(Long categoryId);
    List<Product> findByNameContainingIgnoreCaseAndCategoryIdOrderByIdAsc(String name, Long categoryId);
    Optional<Product> findByNameIgnoreCase(String name);
    
    // Новое правило уникальности: Название + Производитель
    Optional<Product> findByNameIgnoreCaseAndManufacturerIgnoreCase(String name, String manufacturer);
    
    // Случай когда производитель null
    Optional<Product> findByNameIgnoreCaseAndManufacturerIsNull(String name);
}
