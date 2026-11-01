package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.activity.*;
import com.sareevelo.sareevelo_backend.driver.*;
import com.sareevelo.sareevelo_backend.germany.GermanyService;
import com.sareevelo.sareevelo_backend.order.dto.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real PostgreSQL transactions: no outer test transaction hides commits or row locks. */
@SpringBootTest
@ActiveProfiles("test")
class OrderWorkflowTests {
    @Autowired OrderService orders;
    @Autowired OrderRepository orderRepository;
    @Autowired DriverRepository drivers;
    @Autowired ActivityRepository activity;
    @Autowired GermanyService germany;
    @Autowired PlatformTransactionManager transactionManager;

    private Long driver() {
        Driver driver = new Driver();
        driver.setName("Workflow test");
        driver.setEmployeeCode("TEST-" + UUID.randomUUID());
        driver.setCapacity(1);
        driver.setAvailableSpaces(1);
        return drivers.saveAndFlush(driver).getId();
    }

    private Long order() {
        return orders.createOrder(new CreateOrderRequest(null, "Test customer", "Berlin pickup", "Berlin delivery")).id();
    }

    private void status(Long id, OrderStatus status) {
        orders.updateStatus(id, new UpdateOrderStatusRequest(status));
    }

    private int attempt(Callable<?> action) throws Exception {
        try { action.call(); return 200; }
        catch (ResponseStatusException error) { return error.getStatusCode().value(); }
    }

    private void conflict(Runnable action) {
        assertEquals(409, assertThrows(ResponseStatusException.class, action::run).getStatusCode().value());
    }

    /** Barriers and deadlines make worker failures visible without hanging the build. */
    private List<Integer> race(Callable<?> first, Callable<?> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<?> action : List.of(first, second)) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new TimeoutException("Start barrier");
                    return attempt(action);
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS), "Workers did not become ready");
            start.countDown();
            List<Integer> results = new ArrayList<>();
            for (Future<Integer> future : futures) results.add(future.get(20, TimeUnit.SECONDS));
            Collections.sort(results);
            return results;
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "Workers did not stop");
        }
    }

    private long events(Long id, ActivityEvent.Type type) {
        return activity.findByOrderIdOrderByIdDesc(id).stream().filter(event -> event.getType() == type).count();
    }

    @Test void competingOrdersCannotConsumeTheSameLastSpace() throws Exception {
        Long driver = driver(), first = order(), second = order();
        assertEquals(List.of(200, 409), race(
            () -> orders.assignDriver(first, new AssignDriverRequest(driver)),
            () -> orders.assignDriver(second, new AssignDriverRequest(driver))));
        assertEquals(0, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertEquals(1, List.of(first, second).stream()
            .filter(id -> orders.getOrderById(id).driverId() != null).count());
        assertEquals(1, events(first, ActivityEvent.Type.DRIVER_ASSIGNED) + events(second, ActivityEvent.Type.DRIVER_ASSIGNED));
    }

    @Test void competingDriversCannotBothBeAssignedToOneOrder() throws Exception {
        Long first = driver(), second = driver(), order = order();
        assertEquals(List.of(200, 409), race(
            () -> orders.assignDriver(order, new AssignDriverRequest(first)),
            () -> orders.assignDriver(order, new AssignDriverRequest(second))));
        assertEquals(1, drivers.findById(first).orElseThrow().getAvailableSpaces()
            + drivers.findById(second).orElseThrow().getAvailableSpaces());
        assertEquals(1, events(order, ActivityEvent.Type.DRIVER_ASSIGNED));
    }

    @Test void repeatedConcurrentCancellationReleasesCapacityOnce() throws Exception {
        Long driver = driver(), order = order();
        orders.assignDriver(order, new AssignDriverRequest(driver));
        assertEquals(List.of(200, 200), race(
            () -> orders.updateStatus(order, new UpdateOrderStatusRequest(OrderStatus.CANCELLED)),
            () -> orders.updateStatus(order, new UpdateOrderStatusRequest(OrderStatus.CANCELLED))));
        assertEquals(1, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertEquals(DriverStatus.AVAILABLE, drivers.findById(driver).orElseThrow().getStatus());
        assertEquals(1, events(order, ActivityEvent.Type.ORDER_CANCELLED));
    }

    @Test void completionAndCancellationRaceHasOneTerminalEvent() throws Exception {
        Long driver = driver(), order = order();
        orders.assignDriver(order, new AssignDriverRequest(driver));
        status(order, OrderStatus.IN_TRANSIT);
        assertEquals(List.of(200, 409), race(
            () -> orders.updateStatus(order, new UpdateOrderStatusRequest(OrderStatus.DELIVERED)),
            () -> orders.updateStatus(order, new UpdateOrderStatusRequest(OrderStatus.CANCELLED))));
        assertEquals(1, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertEquals(1, events(order, ActivityEvent.Type.DELIVERY_COMPLETED) + events(order, ActivityEvent.Type.ORDER_CANCELLED));
    }

    @Test void rollbackRestoresOrderCapacityAndActivityTogether() {
        Long driver = driver(), order = order();
        orders.assignDriver(order, new AssignDriverRequest(driver));
        status(order, OrderStatus.IN_TRANSIT);
        assertThrows(IllegalStateException.class, () -> new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            status(order, OrderStatus.DELIVERED);
            throw new IllegalStateException("Deliberate rollback");
        }));
        assertEquals(OrderStatus.IN_TRANSIT, orders.getOrderById(order).status());
        assertEquals(0, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertEquals(0, events(order, ActivityEvent.Type.DELIVERY_COMPLETED));
    }

    @Test void lifecycleRejectsSkippingStepsAndCompletionIsIdempotent() {
        Long driver = driver(), order = order();
        conflict(() -> status(order, OrderStatus.IN_TRANSIT));
        orders.assignDriver(order, new AssignDriverRequest(driver));
        conflict(() -> status(order, OrderStatus.DELIVERED));
        status(order, OrderStatus.IN_TRANSIT);
        status(order, OrderStatus.DELAYED);
        status(order, OrderStatus.IN_TRANSIT);
        status(order, OrderStatus.DELIVERED);
        status(order, OrderStatus.DELIVERED);
        conflict(() -> status(order, OrderStatus.CANCELLED));
        assertEquals(1, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertEquals(1, events(order, ActivityEvent.Type.DELIVERY_COMPLETED));
    }

    @Test void uncoveredDriverIsRejectedWithoutConsumingCapacity() {
        Long driver = driver(), order = order();
        germany.saveMap(order, new GermanyService.MapRequest("BE", "BE", 52.52, 13.405,
            52.51, 13.40, true, "Berlin pickup", "Berlin delivery", null));
        conflict(() -> orders.assignDriver(order, new AssignDriverRequest(driver)));
        assertEquals(1, drivers.findById(driver).orElseThrow().getAvailableSpaces());
        assertNull(orders.getOrderById(order).driverId());
        assertEquals(0, events(order, ActivityEvent.Type.DRIVER_ASSIGNED));
        germany.saveCoverage(driver, Set.of("BE"));
        orders.assignDriver(order, new AssignDriverRequest(driver));
        assertEquals(driver, orders.getOrderById(order).driverId());
    }
}
