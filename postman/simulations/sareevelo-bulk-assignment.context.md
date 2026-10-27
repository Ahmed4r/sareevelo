# Simulation context — sareevelo-bulk-assignment

Created 2026-10-27 from the repository's OrderService assignment rules and public DTOs. No published owner mock was sought: this repository owns the API. The generated sample handler was replaced with the logistics contract fixture.

## Purpose

Run the actual Angular AppComponent, driver profile calls, BulkAssignmentService and HttpClient against an isolated HTTP stand-in for Spring Boot. The mock implements only the paths in `postman/mocks/sareevelo-assignment/default.js`, plus test reset/state controls. Profile fields follow `postman/specs/driver-profile.openapi.yaml`. Production proxy configuration is unchanged.

## Execution

1. Start `postman simulation run postman/simulations/sareevelo-bulk-assignment.sim.yaml --port 4900 --output ndjson --no-history` in a terminal. Wait for the `listening` event.
2. In another terminal run `npm run test:bulk-http`. The optional `SIMULATION_URL` environment variable overrides the local base URL. A timeout case intentionally takes about 20 seconds.
3. Read the first terminal's request events: expect numeric assignment URLs, GET reconciliation, 409 and 502 cases, and a delayed response. The test also verifies the mock's call ledger to detect duplicate or unintended requests.
4. Stop the simulation with Ctrl+C. Do not commit request logs.

## Assumptions

- Port 4900 must be free. Test controls reset shared state: run one test process at a time. (Observed 2026-10-27.)
- The timeout fixture saves before delaying the response, demonstrating why a timeout is not proof of rollback. Real delayed commits, Spring transaction locks and database behavior are not simulated. (Observed 2026-10-27.)
- Browser rendering and native dialog interaction are not exercised by the Node harness. No browser was available in the session. (Observed 2026-10-27.)
- Restart the simulation after changing its handler; mocks do not hot-reload.

## Observations

<!-- begin:observations -->
2026-10-27 (profile extension): All five flows passed. The sole member served profile POST, detail GET, profile PUT, and refreshed roster reads; clearing email preserved capacity. All four existing batch scenarios passed again. No members stayed silent. Persistence against real PostgreSQL was verified separately by DriverProfileTests, not by this mock.
2026-10-27: The sole member, sareevelo, served all four runs: success, partial conflict, post-commit HTML 502, and post-commit timeout. Application assertions passed; the log confirmed sequential assignment requests and reconciliation GETs. Uncertain runs did not send the remaining order or retry the uncertain request. No members stayed silent.
<!-- end:observations -->

## What didn't work

- 2026-10-27: restarting after Ctrl+C returned `EADDRINUSE` on port 4900; the Windows shell exited but its Postman child remained. Identify the listening process and verify its exact simulation command before stopping it, then restart to load changed handlers.
