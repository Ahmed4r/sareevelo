package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.order.dto.*;
import com.sareevelo.sareevelo_backend.driver.*;
import com.sareevelo.sareevelo_backend.driver.dto.CreateDriverRequest;
import com.sareevelo.sareevelo_backend.activity.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real concurrent PostgreSQL transactions; removes only records created by each test. */
@SpringBootTest
class DeliveryConcurrencyTests {
    @Autowired OrderService orders;
    @Autowired OrderRepository orderRepository;
    @Autowired DriverService drivers;
    @Autowired DriverRepository driverRepository;
    @Autowired ActivityRepository activity;
    @Autowired PlatformTransactionManager transactions;

    @Test void simultaneousCompletionsReleaseCapacityAndRecordActivityExactlyOnce() throws Exception {
        Long driverId = null, orderId = null;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            driverId = drivers.createDriver(new CreateDriverRequest("Concurrency test", "TEST-" + UUID.randomUUID(), 1, "+4915123456789", null, null, null, null)).id();
            orderId = orders.createOrder(new CreateOrderRequest("TEST-" + UUID.randomUUID(), "Concurrency test", "Pickup", "Delivery")).id();
            orders.assignDriver(orderId, new AssignDriverRequest(driverId));
            orders.updateStatus(orderId, new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
            Long id = orderId;
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            Callable<OrderStatus> complete = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                return orders.updateStatus(id, new UpdateOrderStatusRequest(OrderStatus.DELIVERED)).status();
            };
            Future<OrderStatus> first = executor.submit(complete), second = executor.submit(complete);
            assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
            assertEquals(OrderStatus.DELIVERED, first.get(15, TimeUnit.SECONDS));
            assertEquals(OrderStatus.DELIVERED, second.get(15, TimeUnit.SECONDS));
            assertEquals(1, drivers.getDriverById(driverId).availableSpaces());
            assertEquals(DriverStatus.AVAILABLE, drivers.getDriverById(driverId).status());
            assertEquals(1L, activity.findByOrderIdOrderByIdDesc(id).stream()
                    .filter(event -> event.getType() == ActivityEvent.Type.DELIVERY_COMPLETED).count());
        } finally {
            executor.shutdownNow(); executor.awaitTermination(20, TimeUnit.SECONDS);
            cleanup(orderId, driverId);
        }
    }

    @Test void failedTransactionRollsBackStatusCapacityAndActivityTogether() {
        Long driverId = null, orderId = null;
        try {
            driverId = drivers.createDriver(new CreateDriverRequest("Rollback test", "TEST-" + UUID.randomUUID(), 1, "+4915123456789", null, null, null, null)).id();
            orderId = orders.createOrder(new CreateOrderRequest("TEST-" + UUID.randomUUID(), "Rollback test", "Pickup", "Delivery")).id();
            orders.assignDriver(orderId, new AssignDriverRequest(driverId));
            orders.updateStatus(orderId, new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
            Long id = orderId;
            assertThrows(IllegalStateException.class, () -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                orders.updateStatus(id, new UpdateOrderStatusRequest(OrderStatus.DELIVERED));
                throw new IllegalStateException("Force rollback");
            }));
            assertEquals(OrderStatus.IN_TRANSIT, orders.getOrderById(id).status());
            assertEquals(0, drivers.getDriverById(driverId).availableSpaces());
            assertEquals(3, activity.findByOrderIdOrderByIdDesc(id).size());
        } finally { cleanup(orderId, driverId); }
    }

    @Test void concurrentCancellationAndCompletionReleaseOnlyOneSpace() throws Exception {
        for (OrderStatus secondTarget : new OrderStatus[]{OrderStatus.CANCELLED, OrderStatus.DELIVERED}) {
            Long driverId = null, orderId = null;
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                driverId = drivers.createDriver(new CreateDriverRequest("Cancellation race", "TEST-" + UUID.randomUUID(), 1, "+4915123456789", null, null, null, null)).id();
                orderId = orders.createOrder(new CreateOrderRequest(null, "Cancellation race", "Pickup", "Delivery")).id();
                orders.assignDriver(orderId, new AssignDriverRequest(driverId)); orders.updateStatus(orderId, new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
                Long id = orderId; CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
                java.util.function.Function<OrderStatus, Callable<Integer>> task = target -> () -> {
                    ready.countDown(); if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    try { orders.updateStatus(id, new UpdateOrderStatusRequest(target)); return 200; }
                    catch (org.springframework.web.server.ResponseStatusException error) { return error.getStatusCode().value(); }
                };
                Future<Integer> first = executor.submit(task.apply(OrderStatus.CANCELLED)), second = executor.submit(task.apply(secondTarget));
                assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
                int one = first.get(15, TimeUnit.SECONDS), two = second.get(15, TimeUnit.SECONDS);
                if (secondTarget == OrderStatus.CANCELLED) { assertEquals(200, one); assertEquals(200, two); }
                else assertTrue((one == 200 && two == 409) || (one == 409 && two == 200));
                assertEquals(1, drivers.getDriverById(driverId).availableSpaces());
                assertEquals(1L, activity.findByOrderIdOrderByIdDesc(id).stream().filter(event -> event.getType() == ActivityEvent.Type.ORDER_CANCELLED || event.getType() == ActivityEvent.Type.DELIVERY_COMPLETED).count());
            } finally { executor.shutdownNow(); executor.awaitTermination(20, TimeUnit.SECONDS); cleanup(orderId, driverId); }
        }
    }

    private void cleanup(Long orderId, Long driverId) {
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            if (orderId != null) { activity.deleteByOrderId(orderId); orderRepository.deleteById(orderId); }
            if (driverId != null) driverRepository.deleteById(driverId);
        });
    }
}
