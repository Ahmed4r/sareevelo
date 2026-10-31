package com.sareevelo.sareevelo_backend.germany;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class AddressLookupService {
    public record Candidate(String label, double lat, double lng, String state) {}
    public record Match(String status, List<Candidate> candidates) {}
    public record Lookup(String pickupAddress, String deliveryAddress, Match pickup, Match delivery) {}
    private record Cached(Match match, long expires) {}
    private final RestClient client;
    private final ReentrantLock lock = new ReentrantLock();
    private final Map<String, Cached> cache = new java.util.concurrent.ConcurrentHashMap<>();
    private long nextRequest;
    public AddressLookupService(@Value("${dispatch.maps.geocoder-url:https://photon.komoot.io}") String baseUrl) {
        var factory = new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(2000); factory.setReadTimeout(5000);
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    public Lookup lookup(GermanyService.MapResult map) {
        Match saved = new Match("SAVED", List.of());
        return new Lookup(map.pickupAddress(), map.deliveryAddress(),
            map.pickupLat() != null && map.pickupLng() != null ? saved : search(map.pickupAddress()),
            map.deliveryLat() != null && map.deliveryLng() != null ? saved : search(map.deliveryAddress()));
    }
    public Match search(String address) {
        if (address == null || address.isBlank()) return new Match("NO_MATCH", List.of());
        String query = address.trim().replaceAll("\\s+", " ");
        var hit = cache.get(query);
        if (hit != null && hit.expires() > System.currentTimeMillis()) return hit.match();
        // Bound concurrent work; no growing queue of outbound requests.
        if (!lock.tryLock()) return new Match("UNAVAILABLE", List.of());
        try {
            var cached = cache.get(query);
            if (cached != null && cached.expires() > System.currentTimeMillis()) return cached.match();
            Match result;
            try {
                long delay = nextRequest - System.currentTimeMillis();
                if (delay > 0) Thread.sleep(delay);
                nextRequest = System.currentTimeMillis() + 1100;
                var body = client.get().uri(builder -> builder.path("/api/").queryParam("q", "{query}")
                    .queryParam("lang", "de").queryParam("limit", 3).queryParam("countrycode", "DE")
                    .queryParam("bbox", "5.8,47.2,15.1,55.1").build(query))
                    .header("User-Agent", "Sareevelo-Logistics/1.0").retrieve().body(Map.class);
                result = parse(body);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt(); return new Match("UNAVAILABLE", List.of());
            } catch (RuntimeException exception) { result = new Match("UNAVAILABLE", List.of()); }
            if (cache.size() >= 512) cache.remove(cache.keySet().iterator().next());
            cache.put(query, new Cached(result, System.currentTimeMillis() + (result.status().equals("UNAVAILABLE") ? 15000 : 86400000)));
            return result;
        } finally { lock.unlock(); }
    }
    static Match parse(Map<?, ?> body) {
        if (body == null || !(body.get("features") instanceof List<?> features)) return new Match("UNAVAILABLE", List.of());
        var results = new ArrayList<Candidate>();
        for (Object raw : features) {
            if (!(raw instanceof Map<?, ?> feature) || !(feature.get("properties") instanceof Map<?, ?> properties)
                || !"DE".equalsIgnoreCase(Objects.toString(properties.get("countrycode"), ""))
                || !(feature.get("geometry") instanceof Map<?, ?> geometry) || !"Point".equals(geometry.get("type"))
                || !(geometry.get("coordinates") instanceof List<?> point) || point.size() < 2
                || !(point.get(0) instanceof Number lng) || !(point.get(1) instanceof Number lat)
                || !GermanyService.point(lat.doubleValue(), lng.doubleValue())) continue;
            String stateName = Objects.toString(properties.get("state"), "");
            if (stateName.isBlank()) {
                String city = Objects.toString(properties.get("city"), "");
                stateName = switch (city) { case "Berlin", "Hamburg", "Bremen" -> city; case "Bremerhaven" -> "Bremen"; default -> ""; };
            }
            final String resolvedState = stateName;
            String state = GermanyService.STATES.entrySet().stream().filter(entry -> entry.getValue().equalsIgnoreCase(resolvedState)).map(Map.Entry::getKey).findFirst().orElse("");
            var parts = new LinkedHashSet<String>();
            for (String key : List.of("name", "street", "housenumber", "postcode", "city", "state", "country")) {
                Object value = properties.get(key); if (value instanceof String text && !text.isBlank()) parts.add(text);
            }
            if (parts.isEmpty()) continue;
            results.add(new Candidate(String.join(", ", parts), lat.doubleValue(), lng.doubleValue(), state));
            if (results.size() == 3) break;
        }
        return new Match(results.isEmpty() ? "NO_MATCH" : "FOUND", List.copyOf(results));
    }
}
