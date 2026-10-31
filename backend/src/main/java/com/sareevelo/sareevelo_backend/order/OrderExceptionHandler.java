package com.sareevelo.sareevelo_backend.order;

import java.sql.SQLException;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Errors for the order API only; no database or stack-trace details reach the client. */
@RestControllerAdvice(assignableTypes = {OrderController.class, com.sareevelo.sareevelo_backend.driver.DriverController.class,
        DriverExplanationController.class, com.sareevelo.sareevelo_backend.germany.GermanyController.class,
        com.sareevelo.sareevelo_backend.ai.LogisticsAiController.class})
public class OrderExceptionHandler {
    public record ApiError(String code, String message, Map<String, String> fieldErrors) {}

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new TreeMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        String message = fields.entrySet().stream()
                .map(entry -> label(entry.getKey()) + " " + entry.getValue())
                .reduce((a, b) -> a + "; " + b).orElse("Check the delivery fields.");
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", message, fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> malformedRequest() {
        return ResponseEntity.badRequest().body(new ApiError(
                "INVALID_REQUEST", "Send a valid JSON delivery request.", Map.of()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> status(ResponseStatusException exception) {
        String message = exception.getReason() == null ? "The request could not be completed." : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(new ApiError(
                switch (exception.getStatusCode().value()) {
                    case 400 -> "INVALID_REQUEST";
                    case 404 -> "ORDER_NOT_FOUND";
                    case 409 -> "ORDER_CONFLICT";
                    default -> "REQUEST_FAILED";
                }, message, Map.of()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> constraint(DataIntegrityViolationException exception, jakarta.servlet.http.HttpServletRequest request) {
        // The unique database constraint also protects simultaneous creates.
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())) {
                if (request.getRequestURI().startsWith("/api/v1/drivers")) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                            "DUPLICATE_EMPLOYEE_CODE", "This employee code is already in use. Choose another.", Map.of()));
                }
                return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                        "DUPLICATE_TRACKING_NUMBER",
                        "This tracking number is already in use. Enter a different tracking number.", Map.of()));
            }
        }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(
                "ORDER_CONFLICT", "The delivery could not be saved. Check the fields and try again.", Map.of()));
    }

    private static String label(String field) {
        return switch (field) {
            case "trackingNumber" -> "Tracking number";
            case "customerName" -> "Customer name";
            case "pickupAddress" -> "Pickup address";
            case "deliveryAddress" -> "Delivery address";
            default -> field;
        };
    }
}
