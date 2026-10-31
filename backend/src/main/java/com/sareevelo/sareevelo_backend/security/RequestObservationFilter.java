package com.sareevelo.sareevelo_backend.security;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.UUID;
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestObservationFilter extends OncePerRequestFilter {
 private static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(RequestObservationFilter.class);
 @Override protected boolean shouldNotFilter(HttpServletRequest request){return !request.getRequestURI().startsWith("/api/");}
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
  String id=UUID.randomUUID().toString();response.setHeader("X-Request-ID",id);long start=System.nanoTime();
  boolean failed=false;
  try {chain.doFilter(request,response);} catch (IOException | ServletException | RuntimeException exception) { failed=true; throw exception; } finally {
   // Deliberately omit URL/query, body, credentials, names and addresses.
   LOG.info("request_id={} method={} status={} duration_ms={}",id,request.getMethod(),failed ? 500 : response.getStatus(),(System.nanoTime()-start)/1_000_000);
  }
 }
}
