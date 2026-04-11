package com.cannery.warehouse.config;

import com.cannery.warehouse.model.Category;
import com.cannery.warehouse.model.Product;
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
import java.util.LinkedHashMap;
import java.util.Map;
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

                createProd(productRepository, "Шпроты в масле", inOil, 1000, "145.00", "https://bing.com/th?id=OSK.df5bb4e3cab142643a0fc35d55519b5c");
                createProd(productRepository, "Килька в томате", inTomato, 50, "85.00", "https://api.e-dostavka.by/UserFiles/images/catalog/Goods/1857/00511857/norm/00511857.n_1.png");
                createProd(productRepository, "Сайра натуральная", natural, 300, "185.50", "https://ir.ozone.ru/s3/multimedia-k/c1000/6854583164.jpg");
                createProd(productRepository, "Горбуша паштет", natural, 90, "215.00", "https://ir.ozone.ru/s3/multimedia-1-r/c1000/7085548503.jpg");
                createProd(productRepository, "Печень трески", natural, 45, "450.00", "https://ir.ozone.ru/s3/multimedia-1-8/c1000/7042638248.jpg");
                createProd(productRepository, "Скумбрия в масле", inOil, 1400, "165.00", "https://images.satu.kz/165531802_konservy-skumbriya-v.jpg");
                createProd(productRepository, "Тунец (куски)", natural, 110, "195.00", "https://api.e-dostavka.by/UserFiles/images/catalog/Goods/7428/01497428/norm/01497428.n_1.png");
                createProd(productRepository, "Сардины в масле", inOil, 200, "125.00", "https://tse4.mm.bing.net/th/id/OIP._cRPGWpfmn7YunKLcU1QRwHaEU?rs=1&pid=ImgDetMain&o=7&rm=3");
            }

            syncMissingPrices(productRepository);
        };
    }

    private void ensureDefaultUser(UserRepository repo, PasswordEncoder enc, String login, String name, Role role, Random random) {
        User user = repo.findByUsername(login).orElseGet(User::new);
        user.setUsername(login);
        user.setPassword(enc.encode("1234"));
        user.setFullName(name);
        user.setRole(role);
        if (user.getPhone() == null || user.getPhone().isBlank()) {
            user.setPhone("+7 (9" + (10 + random.nextInt(89)) + ") " + (100 + random.nextInt(899)) + "-" + (10 + random.nextInt(89)));
        }
        repo.save(user);
    }

    private Category saveCat(CategoryRepository repo, String name) {
        Category category = new Category();
        category.setName(name);
        return repo.save(category);
    }

    private void createProd(ProductRepository repo, String name, Category category, Integer quantity, String price, String img) {
        Product product = new Product();
        product.setName(name);
        product.setCategory(category);
        product.setQuantity(quantity);
        product.setPrice(new BigDecimal(price));
        product.setPhotoUrl(img);
        repo.save(product);
    }

    private void syncMissingPrices(ProductRepository repo) {
        Map<String, BigDecimal> defaultPrices = new LinkedHashMap<>();
        defaultPrices.put("Шпроты в масле", new BigDecimal("145.00"));
        defaultPrices.put("Килька в томате", new BigDecimal("85.00"));
        defaultPrices.put("Сайра натуральная", new BigDecimal("185.50"));
        defaultPrices.put("Горбуша паштет", new BigDecimal("215.00"));
        defaultPrices.put("Печень трески", new BigDecimal("450.00"));
        defaultPrices.put("Скумбрия в масле", new BigDecimal("165.00"));
        defaultPrices.put("Тунец (куски)", new BigDecimal("195.00"));
        defaultPrices.put("Сардины в масле", new BigDecimal("125.00"));

        defaultPrices.forEach((name, price) -> repo.findByNameIgnoreCase(name).ifPresent(product -> {
            if (product.getPrice() == null || product.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
                product.setPrice(price);
                repo.save(product);
            }
        }));
    }
}
