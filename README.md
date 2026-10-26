# Sareevelo

Angular 20 logistics frontend connected to a Java 17 / Spring Boot 4.1.2 order API and PostgreSQL.

## Run

Start PostgreSQL with the existing backend configuration for `sareevelo_db`.

Backend (from the repository root, with JDK 17 configured):

```powershell
cd sareevelo-backend/sareevelo-backend
./mvnw.cmd spring-boot:run
```

Frontend (in a second terminal at the repository root):

```powershell
npm ci
npm start -- --host 127.0.0.1 --port 4200
```

Open http://127.0.0.1:4200. The attached backend above was updated; the separate sibling backend copy was not modified.

`proxy.conf.json` forwards `/api/**` to `http://localhost:8080`. Restart Angular after proxy configuration changes. Production hosting must provide equivalent same-origin forwarding; the development proxy is not shipped in the browser build. Database configuration stays on the backend.

## Connected features

- Retrieve saved orders, search/filter locally, and open details by numeric database ID.
- Create orders and show the result immediately without refreshing.
- Show tracking numbers separately from internal IDs.
- Show loading, empty, retry, validation, and duplicate-error states.
- Derive shipment-stage counts from real order data.

The supported API is `GET /api/v1/orders`, `GET /api/v1/orders/{id}`, and `POST /api/v1/orders`.

POST accepts `trackingNumber`, `customerName`, `pickupAddress`, and `deliveryAddress`. All are required. Length limits are 50, 150, 255, and 255 characters respectively. The server generates a numeric ID and returns these fields plus `status`, initially `PENDING`.

Tracking numbers are currently entered manually. Duplicate values return `409`; validation failures return `400`; missing orders return `404`. The backend retains its unique database constraint and unchanged entity/response structure. Targeted additions provide input length validation and structured errors.

## Demo and unavailable features

Driver roster and activity history remain explicitly labeled, display-only demos. Assignment and simulation are disabled for real orders. Priority, driver details, ETA, and timestamps are not returned by the current order DTO and are not invented by the UI. No driver, assignment, status-update, tracking, or authentication endpoints were added.

## Implementation

- `src/app/orders/order-api.models.ts`: exact API DTOs and presentation mapping.
- `src/app/orders/order-api.service.ts`: Angular HttpClient calls.
- `src/app/orders/orders.store.ts`: list/detail state and request cancellation.
- `src/app/orders/order-errors.ts`: understandable request errors.
- `src/app/app.component.*`: existing UI integration and creation form.
- `proxy.conf.json` and `angular.json`: local API forwarding.
- `tests/orders.test.mjs`: HTTP/state integration checks.

## Verification

```powershell
npm test
npm run build -- --configuration production
```

Eight frontend tests exercise mapping, numeric detail URLs, request cancellation, creation, retries, duplicate submissions, form preservation, and proxy errors. They test state and HTTP handling rather than browser rendering.

Backend tests require the configured local PostgreSQL instance:

```powershell
cd sareevelo-backend/sareevelo-backend
./mvnw.cmd test
./mvnw.cmd package -DskipTests
```

Six transactional API tests and the existing context test pass. API test writes roll back. The database sequence may advance during tests.

Live GET, POST, detail retrieval, duplicate conflict, validation failure, and fresh-list retrieval were verified through port 4200. One labeled `Integration verification` order was created for this check. User orders are preserved.

Browser automation was unavailable; browser console/network checks were not automated. The user confirmed successful creation through the UI.

Production browser output is `dist/sareevelo-frontend/browser/`.
