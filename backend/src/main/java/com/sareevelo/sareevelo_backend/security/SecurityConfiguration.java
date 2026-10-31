package com.sareevelo.sareevelo_backend.security;

import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.Customizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

@Configuration @EnableWebSecurity
public class SecurityConfiguration {
    @Bean @Profile("production")
    UserDetailsService productionUsers(Environment env) {
        String dispatcher = env.getRequiredProperty("dispatch.security.dispatcher-user");
        String viewer = env.getRequiredProperty("dispatch.security.viewer-user");
        if (dispatcher.isBlank() || viewer.isBlank() || dispatcher.equals(viewer)) throw new IllegalStateException("Configure distinct non-empty dispatcher and viewer accounts");
        return new InMemoryUserDetailsManager(
            User.withUsername(dispatcher).password(hash(env, "dispatch.security.dispatcher-password-hash")).roles("DISPATCHER").build(),
            User.withUsername(viewer).password(hash(env, "dispatch.security.viewer-password-hash")).roles("VIEWER").build());
    }
    private static String hash(Environment env, String key) {
        String value = env.getRequiredProperty(key);
        if (!value.matches("\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}")) throw new IllegalStateException("Configure a BCrypt hash for " + key);
        int cost = Integer.parseInt(value.substring(4,6));
        if (cost < 10 || cost > 16) throw new IllegalStateException("BCrypt cost must be between 10 and 16");
        return "{bcrypt}" + value;
    }
    @Bean @Profile("production")
    SecurityFilterChain productionSecurity(HttpSecurity http) throws Exception {
        var csrfCookies = org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfCookies.setCookieCustomizer(cookie -> cookie.secure(true).sameSite("Strict"));
        return http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/**").hasAnyRole("VIEWER", "DISPATCHER")
                .requestMatchers("/api/**").hasRole("DISPATCHER")
                .anyRequest().denyAll())
            .httpBasic(Customizer.withDefaults())
            .csrf(csrf -> csrf.spa().csrfTokenRepository(csrfCookies))
            .requestCache(cache -> cache.disable())
            .headers(headers -> headers.contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
            .build();
    }
    @Bean @Profile("!production") UserDetailsService localUsers() { return new InMemoryUserDetailsManager(); }
    @Bean @Profile("!production")
    SecurityFilterChain localSecurity(HttpSecurity http, Environment env) throws Exception {
        String address = env.getProperty("server.address", "127.0.0.1");
        if (!java.util.Set.of("127.0.0.1", "::1", "localhost").contains(address)) throw new IllegalStateException("Unauthenticated demo must bind to loopback. Enable production profile for network access.");
        return http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).csrf(csrf -> csrf.disable()).build();
    }
}
