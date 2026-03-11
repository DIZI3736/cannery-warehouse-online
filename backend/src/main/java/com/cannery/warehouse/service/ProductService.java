package com.cannery.warehouse.service;

import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.Category;
import com.cannery.warehouse.model.Role;
import com.cannery.warehouse.repository.ProductRepository;
import com.cannery.warehouse.repository.CategoryRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public ProductService(ProductRepository productRepository, CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    public List<Product> getAllProducts(String name, Long categoryId) {
        boolean hasName = (name != null && !name.isEmpty());
        boolean hasCategory = (categoryId != null && categoryId > 0);

        if (hasName && hasCategory) {
            return productRepository.findByNameContainingIgnoreCaseAndCategoryIdOrderByIdAsc(name, categoryId);
        } else if (hasName) {
            return productRepository.findByNameContainingIgnoreCaseOrderByIdAsc(name);
        } else if (hasCategory) {
            return productRepository.findByCategoryIdOrderByIdAsc(categoryId);
        } else {
            return productRepository.findAllByOrderByIdAsc();
        }
    }

    public Product saveProduct(Product product) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();

        if (product.getQuantity() == null) {
            throw new IllegalArgumentException("Quantity is required");
        }
        if (product.getQuantity() < 0) {
            throw new IllegalArgumentException("Quantity cannot be negative");
        }

        if (product.getId() != null) {
            Product existing = productRepository.findById(product.getId()).orElseThrow();
            
            // Update fields allowed for the current role
            existing.setName(product.getName());
            existing.setQuantity(product.getQuantity());
            existing.setPhotoUrl(product.getPhotoUrl());
            
            // Carefully update category
            if (product.getCategory() != null && product.getCategory().getId() != null) {
                Category category = categoryRepository.findById(product.getCategory().getId()).orElse(null);
                if (category != null) existing.setCategory(category);
            }
            
            // Only update price if NOT a storekeeper
            if (!"STOREKEEPER".equals(role)) {
                existing.setPrice(product.getPrice());
            }
            
            return productRepository.save(existing);
        } else {
            // New product logic
            if (product.getCategory() != null && product.getCategory().getId() != null) {
                Category category = categoryRepository.findById(product.getCategory().getId()).orElse(null);
                product.setCategory(category);
            }
            if ("STOREKEEPER".equals(role) && product.getPrice() == null) {
                product.setPrice(BigDecimal.ZERO);
            }
            return productRepository.save(product);
        }
    }
    
    public Product updatePrice(Long id, BigDecimal price) {
         if (price != null && price.compareTo(BigDecimal.ZERO) < 0) {
             throw new IllegalArgumentException("Price cannot be negative");
         }
         Product product = productRepository.findById(id).orElseThrow();
         product.setPrice(price);
         return productRepository.save(product);
    }
    
    public void deleteProduct(Long id) {
        productRepository.deleteById(id);
    }

    public Product getProductById(Long id) {
        Product product = productRepository.findById(id).orElseThrow();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        if (Role.STOREKEEPER.name().equals(role)) {
            product.setPrice(null);
        }
        return product;
    }
}
