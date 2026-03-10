package com.cannery.warehouse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "orders")
@com.fasterxml.jackson.annotation.JsonIdentityInfo(generator = com.fasterxml.jackson.annotation.ObjectIdGenerators.PropertyGenerator.class, property = "id")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "VARCHAR(50)")
    private OrderStatus status;

    @ManyToOne
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"password", "addresses", "role", "companyName"})
    private User storeDirector;

    @ManyToOne
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"password", "addresses", "role", "companyName"})
    private User driver;

    @ManyToOne
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties("user")
    private Address deliveryAddress;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    @com.fasterxml.jackson.annotation.JsonManagedReference
    private List<OrderItem> items;

    public enum OrderStatus {
        PENDING,    // Ожидает одобрения менеджером
        APPROVED,   // Одобрен менеджером, ожидает назначения водителя
        ASSIGNED,   // В процессе доставки
        DELIVERED,  // Доставлено
        CANCELLED   // Отменено
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public User getStoreDirector() {
        return storeDirector;
    }

    public void setStoreDirector(User storeDirector) {
        this.storeDirector = storeDirector;
    }

    public User getDriver() {
        return driver;
    }

    public void setDriver(User driver) {
        this.driver = driver;
    }

    public Address getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(Address deliveryAddress) {
        this.deliveryAddress = deliveryAddress;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> items) {
        this.items = items;
    }
}
