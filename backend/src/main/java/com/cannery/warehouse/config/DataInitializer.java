package com.cannery.warehouse.config;

import com.cannery.warehouse.model.Category;
import com.cannery.warehouse.model.PackagingType;
import com.cannery.warehouse.model.Product;
import com.cannery.warehouse.model.QualityStatus;
import com.cannery.warehouse.model.Role;
import com.cannery.warehouse.model.User;
import com.cannery.warehouse.repository.CategoryRepository;
import com.cannery.warehouse.repository.ProductRepository;
import com.cannery.warehouse.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.Random;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initData(
            UserRepository userRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            PasswordEncoder passwordEncoder) {
        return args -> {
            Random random = new Random();

            ensureDefaultUser(userRepository, passwordEncoder, "storekeeper", "Иван Кладовщик", Role.STOREKEEPER, random);
            ensureDefaultUser(userRepository, passwordEncoder, "manager", "Анна Менеджер сбыта", Role.SALES_MANAGER, random);
            ensureDefaultUser(userRepository, passwordEncoder, "accountant", "Петр Бухгалтер", Role.ACCOUNTANT, random);

            if (productRepository.count() == 0) {
                Category natural = saveCat(categoryRepository, "Натуральные");
                Category inOil = saveCat(categoryRepository, "В масле");
                Category inTomato = saveCat(categoryRepository, "В томате");

                createProd(productRepository, "Шпроты в масле", inOil, 72, "79.90",
                        "/api/products/photos/d9880dd1-130f-4c69-a628-d57fcf9da050_шпроты в масле.jpg",
                        "Популярная позиция для витрины.", QualityStatus.NORMAL, PackagingType.CANS,
                        "Беринг", "Рыбное меню");
                createProd(productRepository, "Килька в томате", null, 145, "96.50",
                        "https://irecommend.ru/sites/default/files/product-images/10297/bP5uIVsUczg80radKJOOxQ.jpg",
                        null, null, PackagingType.CANS, "белдруг", "злой");
                createProd(productRepository, "Сайра натуральная", natural, 228, "112.00",
                        "https://cdn.27.ua/799/a2/2e/1548846_1.jpeg",
                        null, null, PackagingType.CANS, "Морской берег", null);
                createProd(productRepository, "Горбуша паштет", natural, 317, "138.40",
                        "https://ir.ozone.ru/s3/multimedia-1-r/c1000/7085548503.jpg",
                        "Нежная консистенция, держать отдельно от деформированной тары.\nп\nп\nп",
                        QualityStatus.REVIEW, PackagingType.PACKAGES, "Северный улов", "Домашний паштет");
                createProd(productRepository, "Печень трески", natural, 486, "164.90",
                        "https://ir.ozone.ru/s3/multimedia-1-8/c1000/7042638248.jpg",
                        "Используется и для розницы, и для внутренней кухни.",
                        null, PackagingType.CANS, "Белрыба", "Традиция моря");
                createProd(productRepository, "Скумбрия в масле", inOil, 624, "189.30",
                        "https://images.satu.kz/165531802_konservy-skumbriya-v.jpg",
                        null, QualityStatus.NORMAL, PackagingType.CANS, "Беринг", null);
                createProd(productRepository, "Тунец (куски)", natural, 810, "215.00",
                        "https://api.e-dostavka.by/UserFiles/images/catalog/Goods/7428/01497428/norm/01497428.n_1.png",
                        null, QualityStatus.NORMAL, PackagingType.CANS, null, "Океан Лайн");
                createProd(productRepository, "Сардины в масле", inOil, 1035, "249.90",
                        "https://tse4.mm.bing.net/th/id/OIP._cRPGWpfmn7YunKLcU1QRwHaEU?rs=1&pid=ImgDetMain&o=7&rm=3",
                        "Стабильный спрос в рознице.",
                        null, PackagingType.CANS, "Балтийский берег", "Морской стандарт");
                createProd(productRepository, "Горбуша натуральная", natural, 1278, "284.50",
                        null, null, QualityStatus.NORMAL, PackagingType.CANS, "Белрыба", "Морской улов");
                createProd(productRepository, "Скумбрия в томатном соусе", inTomato, 1496, "329.00",
                        null, null, QualityStatus.NORMAL, PackagingType.CANS, "Белрыба", "Добрая рыба");
                createProd(productRepository, "Горбуша паштет", null, 72, "79.90",
                        null, null, null, null, "Белдруг", null);
            }

        };
    }

    private void ensureDefaultUser(UserRepository repo, PasswordEncoder enc, String login, String name, Role role, Random random) {
        User user = repo.findByUsername(login).orElseGet(User::new);
        boolean changed = false;

        if (user.getUsername() == null || !user.getUsername().equals(login)) {
            user.setUsername(login);
            changed = true;
        }
        if (user.getPassword() == null || user.getPassword().isBlank() || !enc.matches("1234", user.getPassword())) {
            user.setPassword(enc.encode("1234"));
            changed = true;
        }
        if (user.getFullName() == null || !user.getFullName().equals(name)) {
            user.setFullName(name);
            changed = true;
        }
        if (user.getRole() != role) {
            user.setRole(role);
            changed = true;
        }
        if (user.getPhone() == null || user.getPhone().isBlank()) {
            user.setPhone("+7 (9" + (10 + random.nextInt(89)) + ") " + (100 + random.nextInt(899)) + "-" + (10 + random.nextInt(89)));
            changed = true;
        }
        if (changed) {
            repo.save(user);
        }
    }

    private Category saveCat(CategoryRepository repo, String name) {
        return repo.findByNameIgnoreCase(name).orElseGet(() -> {
            Category category = new Category();
            category.setName(name);
            return repo.save(category);
        });
    }

    private void createProd(ProductRepository repo,
                            String name,
                            Category category,
                            Integer quantity,
                            String price,
                            String img,
                            String notes,
                            QualityStatus qualityStatus,
                            PackagingType packagingType,
                            String manufacturer,
                            String brand) {
        Product product = new Product();
        product.setName(name);
        product.setCategory(category);
        product.setQuantity(quantity);
        product.setPrice(new BigDecimal(price));
        product.setPhotoUrl(img);
        product.setNotes(notes);
        product.setQualityStatus(qualityStatus);
        product.setPackagingType(packagingType);
        product.setManufacturer(manufacturer);
        product.setBrand(brand);
        repo.save(product);
    }
}
