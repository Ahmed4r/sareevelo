package com.sareevelo.sareevelo_backend.germany;

import com.sareevelo.sareevelo_backend.order.*;
import com.sareevelo.sareevelo_backend.driver.DriverRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;

@Service
public class GermanyService {
    public static final Map<String, String> STATES = Map.ofEntries(
            Map.entry("BW", "Baden-Württemberg"), Map.entry("BY", "Bayern"), Map.entry("BE", "Berlin"), Map.entry("BB", "Brandenburg"),
            Map.entry("HB", "Bremen"), Map.entry("HH", "Hamburg"), Map.entry("HE", "Hessen"), Map.entry("MV", "Mecklenburg-Vorpommern"),
            Map.entry("NI", "Niedersachsen"), Map.entry("NW", "Nordrhein-Westfalen"), Map.entry("RP", "Rheinland-Pfalz"), Map.entry("SL", "Saarland"),
            Map.entry("SN", "Sachsen"), Map.entry("ST", "Sachsen-Anhalt"), Map.entry("SH", "Schleswig-Holstein"), Map.entry("TH", "Thüringen"));
    private final OrderRepository orders;
    private final DriverRepository drivers;
    private final OrderGeographyRepository geography;
    private final DriverCoverageRepository coverage;
    public GermanyService(OrderRepository orders, DriverRepository drivers, OrderGeographyRepository geography, DriverCoverageRepository coverage) {
        this.orders = orders; this.drivers = drivers; this.geography = geography; this.coverage = coverage;
    }
    public record MapRequest(String pickupState, String deliveryState, Double pickupLat, Double pickupLng,
                             Double deliveryLat, Double deliveryLng, boolean germanyConfirmed, String pickupAddress, String deliveryAddress, Long version) {
        public MapRequest(String pickupState, String deliveryState, Double pickupLat, Double pickupLng, Double deliveryLat, Double deliveryLng, boolean germanyConfirmed, String pickupAddress, String deliveryAddress) {
            this(pickupState,deliveryState,pickupLat,pickupLng,deliveryLat,deliveryLng,germanyConfirmed,pickupAddress,deliveryAddress,null);
        }
    }
    public record MapResult(Long orderId, String countryCode, String pickupState, String deliveryState,
                            Double pickupLat, Double pickupLng, Double deliveryLat, Double deliveryLng, boolean stale, String pickupAddress, String deliveryAddress, Long version) {
        public MapResult(Long orderId, String countryCode, String pickupState, String deliveryState, Double pickupLat, Double pickupLng, Double deliveryLat, Double deliveryLng, boolean stale, String pickupAddress, String deliveryAddress) {
            this(orderId,countryCode,pickupState,deliveryState,pickupLat,pickupLng,deliveryLat,deliveryLng,stale,pickupAddress,deliveryAddress,null);
        }
    }
    private Order order(Long id) { return orders.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found")); }
    private boolean stale(Order order, OrderGeography geo) { return !Objects.equals(order.getPickupAddress(), geo.pickupAddress) || !Objects.equals(order.getDeliveryAddress(), geo.deliveryAddress); }
    public MapResult map(Long id) {
        Order order = order(id); var geo = geography.findById(id).orElse(null);
        boolean changed = geo != null && stale(order, geo);
        if (geo == null || changed) return new MapResult(id, "DE", "", "", null, null, null, null, changed, order.getPickupAddress(), order.getDeliveryAddress(), geo == null ? null : geo.version);
        return new MapResult(id, "DE", geo.pickupState, geo.deliveryState, geo.pickupLat, geo.pickupLng, geo.deliveryLat, geo.deliveryLng, false, geo.pickupAddress, geo.deliveryAddress, geo.version);
    }
    @Transactional
    public MapResult saveMap(Long id, MapRequest request) {
        Order order = orders.findForAssignment(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only pending orders can have their map pins edited.");
        if (!Objects.equals(order.getPickupAddress(), request.pickupAddress()) || !Objects.equals(order.getDeliveryAddress(), request.deliveryAddress()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Addresses changed. Reload the order before saving pins.");
        if (!request.germanyConfirmed() || !STATES.containsKey(Objects.toString(request.pickupState(), "")) || !STATES.containsKey(Objects.toString(request.deliveryState(), ""))
                || !point(request.pickupLat(), request.pickupLng()) || !point(request.deliveryLat(), request.deliveryLng()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose both German states, set both pins within Germany's map bounds, and confirm their locations.");
        if (order.getDriverId() != null) {
            drivers.findForAssignment(order.getDriverId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Assigned driver is missing"));
            var served = coverage(order.getDriverId());
            if (!served.contains(request.pickupState()) || !served.contains(request.deliveryState())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Assigned driver does not cover both states. Update their service areas first.");
        }
        var geo = geography.findById(id).orElseGet(OrderGeography::new);
        if (!Objects.equals(geo.version, request.version())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Locations were changed by another dispatcher. Reload the order before saving.");
        geo.orderId = id; geo.pickupState = request.pickupState(); geo.deliveryState = request.deliveryState();
        geo.pickupLat = request.pickupLat(); geo.pickupLng = request.pickupLng(); geo.deliveryLat = request.deliveryLat(); geo.deliveryLng = request.deliveryLng();
        geo.pickupAddress = order.getPickupAddress(); geo.deliveryAddress = order.getDeliveryAddress(); geography.saveAndFlush(geo);
        return map(id);
    }
    static boolean point(Double lat, Double lng) {
        return lat != null && lng != null && Double.isFinite(lat) && Double.isFinite(lng) && lat >= 47.2 && lat <= 55.1 && lng >= 5.8 && lng <= 15.1;
    }
    public Set<String> coverage(Long driverId) {
        if (!drivers.existsById(driverId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found");
        return coverage.findById(driverId).map(item -> Set.copyOf(item.states)).orElse(Set.of());
    }
    @Transactional
    public Set<String> saveCoverage(Long id, Set<String> states) {
        if (states == null || states.size() > 16 || states.stream().anyMatch(state -> state == null || !STATES.containsKey(state))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose valid German states.");
        drivers.findForAssignment(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        var item = coverage.findById(id).orElseGet(DriverCoverage::new); item.driverId = id; item.states = new HashSet<>(states); coverage.save(item);
        return Set.copyOf(states);
    }
    /** Null means no saved geography exists; legacy orders retain workload-only suggestions. */
    public Set<Long> eligibleDriverIds(Long orderId) {
        var geo = geography.findById(orderId).orElse(null);
        if (geo == null) return null;
        if (stale(order(orderId), geo)) return Set.of();
        return coverage.coveringBoth(geo.pickupState, geo.deliveryState);
    }
    public void validateCoverage(Long orderId, Long driverId) {
        var geo = geography.findById(orderId).orElse(null);
        if (geo == null) return;
        if (stale(order(orderId), geo)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Order addresses changed. Reconfirm the Germany map pins before assignment.");
        var served = coverage.findById(driverId).map(item -> item.states).orElse(Set.of());
        if (!served.contains(geo.pickupState) || !served.contains(geo.deliveryState)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver does not cover this order's pickup and delivery states.");
    }
}
