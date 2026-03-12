package com.cannery.warehouse.repository;

import com.cannery.warehouse.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findAllByOrderByIdAsc();
    List<Product> findByNameContainingIgnoreCaseOrderByIdAsc(String name);
    List<Product> findByCategoryIdOrderByIdAsc(Long categoryId);
    List<Product> findByNameContainingIgnoreCaseAndCategoryIdOrderByIdAsc(String name, Long categoryId);
    java.util.Optional<Product> findByNameIgnoreCase(String name);
}
