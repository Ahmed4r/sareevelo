# Verification checklist

## Repository cleanup

- [x] Frontend and backend folders separated.
- [x] Test suites, mock fixtures and obsolete design files removed.
- [x] Runtime source reviewed for seed/dummy initializers; none found.
- [x] Existing local database data and secret configuration preserved.
- [x] README includes setup instructions and manual screenshot placeholders.
- [x] CI and dependency update paths target the new folders.

## Build validation

- [x] Frontend production build after restructuring (Leaflet CommonJS warning remains).
- [x] Clean backend package after restructuring.
- [x] Frontend runtime dependency audit: zero reported vulnerabilities.
- [x] Docker Compose configuration and image builds; all containers healthy (31 October 2026).
- [ ] Hosted CI run.

## Manual checks before publishing

- [x] All containers healthy; frontend HTTP 200 and proxied database health UP. Postman health assertion passed; orders returned an empty list.
- [ ] Create/edit/cancel orders and assign drivers with capacity constraints.
- [ ] Confirm Germany lookup, manual pins, switching orders and stale-save handling.
- [ ] Check map style, touchpad gestures, keyboard use and mobile layout.
- [ ] Check AI Markdown, unavailable-provider fallback and actual provider access.
- [ ] Confirm database persistence after stack restart.
- [ ] Verify HTTPS, authentication, role restrictions and CSRF in production.
- [ ] Complete migrations, backup/restore and rollback verification.

Automated behavioral suites were removed by request. Historical test results do not validate the restructured application; builds alone do not replace runtime verification.
