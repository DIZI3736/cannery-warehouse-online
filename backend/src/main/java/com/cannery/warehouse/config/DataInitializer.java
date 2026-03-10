package com.cannery.warehouse.config;

import com.cannery.warehouse.model.*;
import com.cannery.warehouse.repository.*;
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
            if (userRepository.count() == 0) {
                Random r = new Random();
                autoCreateUser(userRepository, passwordEncoder, "storekeeper", "Иван Кладовщик", Role.STOREKEEPER, r);
                autoCreateUser(userRepository, passwordEncoder, "manager", "Анна Менеджер сбыта", Role.SALES_MANAGER, r);
                autoCreateUser(userRepository, passwordEncoder, "accountant", "Петр Бухгалтер", Role.ACCOUNTANT, r);

                Category cat1 = saveCat(categoryRepository, "Натуральные");
                Category cat2 = saveCat(categoryRepository, "В масле");
                Category cat3 = saveCat(categoryRepository, "В томате");

                createProd(productRepository, "Шпроты в масле", cat2, 1000, "145.00", "https://bing.com/th?id=OSK.df5bb4e3cab142643a0fc35d55519b5c");
                createProd(productRepository, "Килька в томате", cat3, 50, "85.00", "https://cdn-irec.r-99.com/sites/default/files/product-images/10297/bP5uIVsUczg80radKJOOxQ.jpg");
                createProd(productRepository, "Сайра натуральная", cat1, 300, "185.50", "https://ir.ozone.ru/s3/multimedia-k/c1000/6854583164.jpg");
                createProd(productRepository, "Горбуша паштет", cat1, 90, "215.00", "https://ir.ozone.ru/s3/multimedia-1-r/c1000/7085548503.jpg");
                createProd(productRepository, "Печень трески", cat1, 45, "450.00", "https://ir.ozone.ru/s3/multimedia-1-8/c1000/7042638248.jpg");
                createProd(productRepository, "Скумбрия в масле", cat2, 1400, "165.00", "https://images.satu.kz/165531802_konservy-skumbriya-v.jpg");
                createProd(productRepository, "Тунец (куски)", cat1, 110, "195.00", "https://api.e-dostavka.by/UserFiles/images/catalog/Goods/7428/01497428/norm/01497428.n_1.png");
                createProd(productRepository, "Сардины в масле", cat2, 200, "125.00", "https://tse4.mm.bing.net/th/id/OIP._cRPGWpfmn7YunKLcU1QRwHaEU?rs=1&pid=ImgDetMain&o=7&rm=3");
            }
        };
    }

    private void autoCreateUser(UserRepository repo, PasswordEncoder enc, String login, String name, Role role, Random r) {
        User u = new User(); u.setUsername(login); u.setPassword(enc.encode("1234")); u.setFullName(name); u.setRole(role);
        u.setPhone("+7 (9" + (10 + r.nextInt(89)) + ") " + (100 + r.nextInt(899)) + "-" + (10 + r.nextInt(89)));
        repo.save(u);
    }

    private Category saveCat(CategoryRepository repo, String name) {
        Category c = new Category(); c.setName(name); return repo.save(c);
    }

    private void createProd(ProductRepository repo, String n, Category c, Integer q, String p, String img) {
        Product pr = new Product(); pr.setName(n); pr.setCategory(c); pr.setQuantity(q); pr.setPrice(new BigDecimal(p)); pr.setPhotoUrl(img);
        repo.save(pr);
    }
}
