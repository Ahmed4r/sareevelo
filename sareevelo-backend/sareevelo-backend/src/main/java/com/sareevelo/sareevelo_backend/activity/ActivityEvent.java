package com.sareevelo.sareevelo_backend.activity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "activity_events", indexes = @Index(name = "idx_activity_order", columnList = "order_id,id"))
public class ActivityEvent {
    public enum Type { ORDER_CREATED, DRIVER_ASSIGNED, DELIVERY_STARTED, DELIVERY_DELAYED, DELIVERY_RESUMED, DELIVERY_COMPLETED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "order_id", nullable = false, updatable = false)
    private Long orderId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 40)
    private Type type;
    @Column(nullable = false, updatable = false, length = 300)
    private String message;
    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    protected ActivityEvent() {}
    public ActivityEvent(Long orderId, Type type, String message) {
        this.orderId = orderId;
        this.type = type;
        this.message = message;
        this.timestamp = Instant.now();
    }

    public Long getId() { return id; }
    public Long getOrderId() { return orderId; }
    public Type getType() { return type; }
    public String getMessage() { return message; }
    public Instant getTimestamp() { return timestamp; }
}
