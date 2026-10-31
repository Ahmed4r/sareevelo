package com.sareevelo.sareevelo_backend.germany;

import jakarta.persistence.*;

@Entity
@Table(name = "order_geography")
public class OrderGeography {
    @Id public Long orderId;
    @Version @Column(nullable = false, columnDefinition = "bigint default 0") public Long version;
    public String pickupState;
    public String deliveryState;
    public double pickupLat;
    public double pickupLng;
    public double deliveryLat;
    public double deliveryLng;
    public String pickupAddress;
    public String deliveryAddress;
    protected OrderGeography() {}
}
