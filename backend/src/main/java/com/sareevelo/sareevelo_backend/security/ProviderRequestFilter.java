package com.sareevelo.sareevelo_backend.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.concurrent.Semaphore;

/** Bounds expensive provider work per process. Multi-instance deployments need gateway limits too. */
@Component
public class ProviderRequestFilter extends OncePerRequestFilter {
    private final Semaphore permits = new Semaphore(2);
    private long windowStart = System.nanoTime(); private int requests;
    private synchronized boolean allowed() {
        long now = System.nanoTime();
        if (now - windowStart >= 60_000_000_000L) { windowStart = now; requests = 0; }
        if (requests >= 30) return false;
        requests++; return true;
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(path.equals("/api/v1/ai/run") || path.matches("/api/v1/orders/[0-9]+/driver-suggestions/explain") || path.matches("/api/v1/germany/orders/[0-9]+/lookup"));
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (!allowed()) { reject(response); return; }
        if (!permits.tryAcquire()) { reject(response); return; }
        try { chain.doFilter(request,response); } finally { permits.release(); }
    }
    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(429); response.setHeader("Retry-After", "60"); response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"PROVIDER_BUSY\",\"message\":\"AI or address lookup is busy. Wait a minute and retry.\",\"fieldErrors\":{}}");
    }
}
