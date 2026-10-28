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

The supported API includes order and driver list/detail/create endpoints and `POST /api/v1/orders/{id}/assign`. See the implemented section of `API_CONTRACT.md` for exact DTOs. Restart the backend after these changes to expose `driverId` in order responses.

POST accepts `trackingNumber`, `customerName`, `pickupAddress`, and `deliveryAddress`. All are required. Length limits are 50, 150, 255, and 255 characters respectively. The server generates a numeric ID and returns these fields plus `status`, initially `PENDING`.

Tracking numbers are currently entered manually. Duplicate values return `409`; validation failures return `400`; missing resources return `404`. The backend retains its unique database constraints and now includes nullable numeric `driverId` in order responses. Driver input lengths and structured errors match the frontend forms.

## Workspace and API coverage

All application mock data and demo models have been removed. The workspace shows persisted orders and drivers only. Activity, simulation, unsupported ETA displays and fictional metrics have been removed from the interface.

The responsive workspace uses a sidebar, searchable tables, status filters, sortable order columns and a persistent details inspector. Dispatch workload counts are computed from fetched records. Native dialogs provide creation forms with keyboard focus containment.

| Backend operation | Frontend flow |
| --- | --- |
| GET /orders | Dispatch manifest and Orders page |
| GET /orders/{id} | Select an order to load its route and assignment |
| POST /orders | New delivery form |
| GET /drivers | Searchable Drivers roster and assignment choices |
| GET /drivers/{id} | Select a driver to load details and capacity |
| POST /drivers | Add driver form |
| POST /orders/{id}/assign | Assign driver in the order inspector |
| PATCH /orders/{id}/status | Start, delay, resume and complete delivery |
| GET /orders/{id}/activity | Persistent activity timeline in order details |

Assignment refreshes orders, selected details and driver capacity. Drivers on delivery can accept more orders while they have capacity, matching the Java service. Assignment preserves the existing order status; pending orders with a driver are correctly excluded from the unassigned queue. Driver details link to their assigned orders.

## Delivery lifecycle

`PATCH /api/v1/orders/{id}/status` accepts `{ "status": "IN_TRANSIT" }`, `DELAYED`, or `DELIVERED` and returns the updated order DTO. Valid transitions are assigned `PENDING → IN_TRANSIT`, `IN_TRANSIT → DELAYED`, `DELAYED → IN_TRANSIT`, and `IN_TRANSIT/DELAYED → DELIVERED`. An offline driver cannot start/resume. Completed orders cannot reopen. Repeating the current status returns the order unchanged.

Completion releases exactly one space, preserves the assigned driver reference, and makes the driver available when capacity is fully free. Offline drivers stay offline. Order and driver rows are locked in a consistent order; status, capacity and activity commit together.

`GET /api/v1/orders/{id}/activity` returns newest-first events with numeric `id`, numeric `orderId`, `type`, `message`, and UTC ISO `timestamp`. Events cover creation, assignment, start, delay, resume and completion. Repeated status requests do not create duplicate events. Existing records have no fabricated historical events; history starts with changes recorded by this implementation.

The existing development Hibernate `ddl-auto=update` setting creates `activity_events` on backend startup. Restart the backend to load new endpoints. This repository still uses its existing schema-management approach; no production migration rollout is included.

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

Frontend tests exercise mapping, numeric URLs, request cancellation, order/driver creation, retries, duplicate submissions, form preservation, assignment capacity refresh, 404/409 recovery, and proxy errors. They test state and HTTP handling rather than browser rendering.

Backend tests require the configured local PostgreSQL instance:

```powershell
cd sareevelo-backend/sareevelo-backend
./mvnw.cmd test
./mvnw.cmd package -DskipTests
```

Transactional API tests cover order and driver creation/retrieval, validation, duplicates, assignment, exhausted capacity, missing resources and offline drivers. API test writes roll back. The database sequence may advance during tests.

Current verification: 21 frontend HTTP/state tests, 16 backend tests against PostgreSQL, and the production build pass. Coverage includes the full lifecycle, activity retrieval, invalid transitions, repeated and simultaneous completion, offline drivers, and atomic rollback of status/capacity/activity. Transactional tests roll back; concurrency tests commit their own fixtures and delete only those fixtures afterward. Browser rendering remains unverified because the browser tool is unavailable.

Browser automation was unavailable in this session; rendering and click-through workflows remain unverified.

Production browser output is `dist/sareevelo-frontend/browser/`.

## Operational alerts and bulk assignment

Dispatch now highlights delayed deliveries, pending unassigned orders, and exhausted or insufficient online driver capacity. Alert actions open the relevant order filter or driver roster. Failed or loading data sources never produce a false all-clear message.

In Dispatch or Orders, select pending unassigned orders individually or select all visible eligible orders. Selections can span filters; the toolbar reports hidden selections and the review dialog lists the complete batch. Choose one online driver with enough free spaces and confirm. Availability is refreshed when the dialog opens; the backend remains authoritative for concurrent assignments.

Bulk assignment reuses `POST /api/v1/orders/{id}/assign` with `{ "driverId": number }`, sequentially. Each order is an independent transaction. A 400, 404 or 409 produces an individual failure and processing continues. Other errors or a 20-second timeout produce an uncertain result and skip the remaining requests. There are no automatic POST retries. Results distinguish assigned, failed, needs-review and not-attempted orders; the app refreshes orders and drivers after processing and clears the selection before another batch.

Verification for this feature: 28 frontend regression tests and the production build pass. Four local Postman HTTP simulation runs exercise the actual Angular component and HttpClient: full success, partial 409, a 502 after saving, and a timeout after saving. The request logs confirm sequential calls, no duplicate submissions, skipped remaining work after uncertain responses, and refreshed capacity. These checks do not establish browser rendering or live Spring Boot/database behavior; backend code and API contracts were unchanged in this feature.

Run the isolated HTTP checks in two terminals:

```powershell
postman simulation run postman/simulations/sareevelo-bulk-assignment.sim.yaml --port 4900 --output ndjson --no-history
```

```powershell
npm run test:bulk-http
```

Stop the simulation with Ctrl+C. Fixtures and test-only controls live under `postman/`; production API configuration is untouched. See `postman/simulations/sareevelo-bulk-assignment.context.md` for the verified assumptions and limits.

## Automatic order tracking

The New delivery form accepts customer, pickup address, delivery address and an optional delivery window. Its tracking-number notice explains that the server generates the number on save. The generated number appears in the success notification, manifest and selected order details.

`POST /api/v1/orders` now permits omitted, null or blank `trackingNumber`; Spring generates a `SAR-XXXX-XXXX-XXXX-XXXX` reference using 16 secure random symbols. Existing tracking numbers and optional manual numbers from older API clients remain supported. The database's unique constraint remains the final safeguard across simultaneous requests; existing candidates are regenerated before insertion. Creation has no automatic retries on uncertain network failures.

The frontend creation payload is `{ "customerName": "...", "pickupAddress": "...", "deliveryAddress": "..." }`. The response still includes `trackingNumber`. Restart an already-running backend for the updated request validation and generator.

## Driver profiles and themes

Drivers now store a full name, mobile number, optional email, vehicle type, registration and operational notes. New drivers require a mobile number; existing records retain nullable contact fields and remain assignable. Formatting characters are removed from mobile numbers before checking for 7–15 digits and an optional leading `+`. This validates format, not ownership. Optional blank values are stored as null.

Select a driver and choose **Edit profile** to update these details. The roster shows phone links, while the detail panel includes phone/email links and vehicle details. Search includes phone, email and registration. `PUT /api/v1/drivers/{id}/profile` replaces profile fields only; it never changes employee code, capacity, available spaces or status. The same driver lock used by assignment prevents profile updates from overwriting operational changes. The contract is in `postman/specs/driver-profile.openapi.yaml`.

The database extension is additive. The configured development `ddl-auto=update` adds nullable columns; deployments using schema validation can apply `sareevelo-backend/sareevelo-backend/db/driver-profile.sql`. Restart an already-running backend to load the new endpoints and DTOs.

Light mode is the default. The header toggle switches to dark mode and saves the preference locally; the preference is applied before Angular starts to avoid a theme flash. Shared tokens cover forms, dialogs, alerts, status indicators, activity history, and the application shell. The toggle also works when browser storage is disabled.

Verification for this change: 32 frontend tests, 20 backend tests against the configured PostgreSQL database, the production build, and five HTTP simulation flows pass. Profile tests cover normalized persistence, legacy records, validation failures, optional-field clearing and unchanged operational state. Browser rendering and click-through checks remain unverified because no browser connection was available.

## Workspace views and controls

Use the manifest's Table, Cards and Board controls to change presentation without losing filters or bulk selections. The board groups the filtered orders by status; open an order to use the existing lifecycle controls. It does not change statuses by dragging cards. Sorting and direction apply across all order views. Driver cards show real capacity and contact links. Table density and the collapsible dispatch welcome provide more working space. View preferences last for the current session.

The transparent route illustration in `public/brand/dispatch-route.svg` uses a 720 × 480 viewBox and responsive containment. Shared SVG icons stay sharp at any pixel density. Both themes use the existing semantic colors; board columns stack on narrow screens. Forty frontend tests and the production build pass. Browser visual verification remains unavailable in this session.

## Delivery scheduling, editing and cancellation

Orders accept an optional delivery window. Both endpoints must be provided together, with the end after the start. The form displays the browser timezone; the API stores instants. Due today uses the window end in that timezone. Overdue indicators refresh every 30 seconds and exclude delivered and cancelled orders. These filters remain separate from the manually recorded delayed status.

Pending orders can be edited without changing their tracking number, assigned driver or reserved capacity. Clearing the window removes scheduling. Unfinished orders can be cancelled through a confirmation dialog. Cancellation retains the order and activity history and releases reserved capacity exactly once, including concurrent cancellation/completion requests. Delivered and cancelled orders cannot reopen.

For existing databases, apply `sareevelo-backend/sareevelo-backend/db/order-scheduling.sql` before restarting the updated backend. It adds nullable window columns and extends status/activity constraints without deleting records. This migration has been applied to the configured local database. The scoped API contract is `postman/specs/order-workflows.openapi.yaml`.

Verification: 38 frontend tests, 28 backend tests against PostgreSQL, seven local HTTP simulation flows, and the production Angular build pass. Tests cover schedule validation, persistence, filters, edit conflicts, cancellation, capacity release and concurrent terminal transitions. Browser rendering and click-through checks remain unverified because no browser connection was available.
