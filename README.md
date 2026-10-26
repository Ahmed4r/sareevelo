# FlowOps — Logistics Control Center (Frontend)

Angular standalone UI for a logistics operations portfolio project. Includes a dashboard, illustrated **simulation map** (not real GPS), deliveries with filters/search, driver roster, activity log, new shipment modal, dispatch action, and start/pause simulation. All state is in memory; refreshing resets the demo.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run
```bash
npm install
npm start
```
Open `http://localhost:4200`.

## Backend integration
See `API_CONTRACT.md`. The current implementation is a **frontend demo**; it does not call your API yet. Once your backend is ready, introduce Angular HttpClient service(s) and replace the mock state with backend responses. For real GPS mapping use Leaflet / MapLibre with a licensed map tile provider, not the SVG demo artwork.

## Development notes
- No auth, persistency, or real dispatch logic in this frontend prototype.
- `assignNextPending` is an intentionally simplistic local mock; **backend owns dispatch rules**.
- Keep API DTO names and enums identical to `src/app/models.ts`.
- Prioritize building a robust modular Spring Boot monolith before adding Kafka or splitting services.
