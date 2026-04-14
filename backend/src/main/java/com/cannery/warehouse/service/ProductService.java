package com.cannery.warehouse.service;

import com.cannery.warehouse.model.Category;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.Role;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class ProductService {
    private static final String NAME_REQUIRED_MESSAGE = "Название товара обязательно";

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ActivityLogService activityLogService;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository,
                          ActivityLogService activityLogService) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.activityLogService = activityLogService;
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

    public List<Product> getAllProducts(String name, Long categoryId) {
        boolean hasName = name != null && !name.isEmpty();
        boolean hasCategory = categoryId != null && categoryId > 0;

        if (hasName && hasCategory) {
            return productRepository.findByNameContainingIgnoreCaseAndCategoryIdOrderByIdAsc(name, categoryId);
        }
        if (hasName) {
            return productRepository.findByNameContainingIgnoreCaseOrderByIdAsc(name);
        }
        if (hasCategory) {
            return productRepository.findByCategoryIdOrderByIdAsc(categoryId);
        }
        return productRepository.findAllByOrderByIdAsc();
    }

    @Transactional
    public Product saveProduct(Product product) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String role = auth.getAuthorities().iterator().next().getAuthority();
        String normalizedName = normalizeProductName(product.getName());
        String normalizedManufacturer = normalizeOptionalText(product.getManufacturer());

        if (normalizedName.isEmpty()) {
            throw new IllegalArgumentException(NAME_REQUIRED_MESSAGE);
        }
        if (product.getQuantity() == null) {
            throw new IllegalArgumentException("Количество товара обязательно");
        }
        if (product.getQuantity() < 0) {
            throw new IllegalArgumentException("Количество не может быть отрицательным");
        }

        if (product.getId() != null) {
            Product existing = productRepository.findById(product.getId()).orElseThrow();
            validateDuplicateForUpdate(normalizedName, normalizedManufacturer, product.getId());

            Product previousState = copyProduct(existing);
            existing.setName(normalizedName);
            existing.setQuantity(product.getQuantity());
            existing.setPhotoUrl(normalizeOptionalText(product.getPhotoUrl()));
            existing.setNotes(normalizeOptionalText(product.getNotes()));
            existing.setQualityStatus(product.getQualityStatus());
            existing.setPackagingType(product.getPackagingType());
            existing.setManufacturer(normalizedManufacturer);
            existing.setBrand(normalizeOptionalText(product.getBrand()));

            if (product.getCategory() != null) {
                if (product.getCategory().getId() != null) {
                    Category category = categoryRepository.findById(product.getCategory().getId()).orElse(null);
                    existing.setCategory(category);
                } else {
                    existing.setCategory(null);
                }
            }

            if (!Role.STOREKEEPER.name().equals(role)) {
                existing.setPrice(product.getPrice());
            }

            Product saved = productRepository.save(existing);
            logFieldChanges(previousState, saved, !Role.STOREKEEPER.name().equals(role));
            return saved;
        }

        List<Product> sameNameProducts = productRepository.findAllByNameIgnoreCaseOrderByIdAsc(normalizedName);
        Product duplicate = sameNameProducts.stream()
                .filter(existing -> sameManufacturer(existing.getManufacturer(), normalizedManufacturer))
                .findFirst()
                .orElse(null);

        if (duplicate != null) {
            Product previousState = copyProduct(duplicate);
            duplicate.setQuantity((duplicate.getQuantity() != null ? duplicate.getQuantity() : 0) + product.getQuantity());
            Product saved = productRepository.save(duplicate);
            activityLogService.logFieldChange(saved, "quantity", "Количество (приход)", previousState.getQuantity(), saved.getQuantity());
            return saved;
        }

        if (normalizedManufacturer == null
                && sameNameProducts.stream().anyMatch(existing -> sameManufacturer(existing.getManufacturer(), normalizedManufacturer))) {
            throw new IllegalArgumentException("Товар с таким названием уже существует. Укажите производителя, если это другая позиция.");
        }

        product.setName(normalizedName);
        product.setManufacturer(normalizedManufacturer);
        product.setPhotoUrl(normalizeOptionalText(product.getPhotoUrl()));
        product.setNotes(normalizeOptionalText(product.getNotes()));
        product.setBrand(normalizeOptionalText(product.getBrand()));

        if (product.getCategory() != null && product.getCategory().getId() != null) {
            Category category = categoryRepository.findById(product.getCategory().getId()).orElse(null);
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }

        if (Role.STOREKEEPER.name().equals(role) && product.getPrice() == null) {
            product.setPrice(BigDecimal.ZERO);
        }

        Product saved = productRepository.save(product);
        activityLogService.logProductCreated(saved);
        return saved;
    }

    private void validateDuplicateForUpdate(String name, String manufacturer, Long currentId) {
        List<Product> conflicts = productRepository.findAllByNameIgnoreCaseOrderByIdAsc(name).stream()
                .filter(product -> !product.getId().equals(currentId))
                .toList();

        boolean exactConflict = conflicts.stream()
                .anyMatch(product -> sameManufacturer(product.getManufacturer(), manufacturer));

        if (exactConflict) {
            throw new IllegalArgumentException("Товар с таким названием и производителем уже существует.");
        }

        if (manufacturer == null
                && conflicts.stream().anyMatch(product -> sameManufacturer(product.getManufacturer(), manufacturer))) {
            throw new IllegalArgumentException("Товар с таким названием уже есть. Укажите производителя, чтобы различать позиции.");
        }
    }

    public Product updatePrice(Long id, BigDecimal price) {
        if (price != null && price.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Цена не может быть отрицательной");
        }
        Product product = productRepository.findById(id).orElseThrow();
        BigDecimal oldPrice = product.getPrice();
        product.setPrice(price);
        Product saved = productRepository.save(product);
        activityLogService.logFieldChange(saved, "price", "Цена", oldPrice, saved.getPrice());
        return saved;
    }

    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id).orElseThrow();
        activityLogService.logProductDeleted(product);
        productRepository.delete(product);
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
        activityLogService.logFieldChange(current, "name", "Название", previous.getName(), current.getName());
        activityLogService.logFieldChange(current, "quantity", "Количество", previous.getQuantity(), current.getQuantity());
        activityLogService.logFieldChange(current, "category", "Категория", getCategoryName(previous), getCategoryName(current));
        activityLogService.logFieldChange(current, "photoUrl", "Фото", previous.getPhotoUrl(), current.getPhotoUrl());
        activityLogService.logFieldChange(current, "notes", "Комментарий", previous.getNotes(), current.getNotes());
        activityLogService.logFieldChange(current, "qualityStatus", "Статус качества", enumValue(previous.getQualityStatus()), enumValue(current.getQualityStatus()));
        activityLogService.logFieldChange(current, "packagingType", "Упаковка", enumValue(previous.getPackagingType()), enumValue(current.getPackagingType()));
        activityLogService.logFieldChange(current, "manufacturer", "Производитель", previous.getManufacturer(), current.getManufacturer());
        activityLogService.logFieldChange(current, "brand", "Бренд", previous.getBrand(), current.getBrand());
        if (includePrice) {
            activityLogService.logFieldChange(current, "price", "Цена", previous.getPrice(), current.getPrice());
        }
    }

    private String getCategoryName(Product product) {
        return product != null && product.getCategory() != null ? product.getCategory().getName() : null;
    }

    private String enumValue(Enum<?> value) {
        return value != null ? value.name() : null;
    }

    private boolean sameManufacturer(String left, String right) {
        String normalizedLeft = normalizeOptionalText(left);
        String normalizedRight = normalizeOptionalText(right);
        if (normalizedLeft == null || normalizedRight == null) {
            return normalizedLeft == null && normalizedRight == null;
        }
        return normalizedLeft.equalsIgnoreCase(normalizedRight);
    }
}
