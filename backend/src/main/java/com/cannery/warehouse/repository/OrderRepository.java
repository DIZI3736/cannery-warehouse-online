package com.cannery.warehouse.repository;

import com.cannery.warehouse.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStoreDirectorId(Long directorId);
    List<Order> findByDriverId(Long driverId);
    List<Order> findByStatus(Order.OrderStatus status);
}
