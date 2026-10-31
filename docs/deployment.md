# Deployment

## Local development

Run Maven from `backend/` and npm from `frontend/`; see the root README. Backend configuration loads `.env` from its working directory or `backend/.env` when started from the repository root. Never commit credentials.

## Docker local demo

Root `.env` supplies Compose configuration independently of `backend/.env`. Set POSTGRES_PASSWORD and optionally GROQ_API_KEY. Compose builds the Angular/Nginx frontend and Java API, with PostgreSQL 16 in a persistent named volume. The database starts empty without seed data.

Only 127.0.0.1:3000 is exposed. Nginx shares the backend network namespace and forwards API requests to 127.0.0.1:9090, preserving the API's local-only security guard. PostgreSQL uses an internal network; the backend also has outbound connectivity for providers. Application containers run without root, with read-only filesystems and temporary /tmp storage.

Run `docker compose config --quiet`, then `docker compose up --build -d`. Confirm all services are healthy and manually verify creating an order, assigning a driver, saving pins and AI fallback. Restart the stack and confirm persistence. On 31 October 2026, both images built successfully and all three containers became healthy. HTTP checks confirmed the frontend, proxied database health and empty orders response. Browser workflows and restart persistence still require verification.

## Before public deployment

The supplied Compose file is not a production deployment. Do not expose the local unauthenticated profile by changing the published address.

1. Configure a domain and TLS reverse proxy, then activate the Spring `production` profile.
2. Configure distinct dispatcher/viewer users and BCrypt password hashes using the backend environment template. Verify login, authorization and CSRF cookie/header handling through HTTPS; a dedicated login UI remains future work.
3. Create a complete versioned database migration baseline. Production uses schema validation; existing `backend/db` SQL scripts are incremental changes, not a complete bootstrap. Validate upgrades and backup/restore before launch.
4. Configure deployment-specific private networking and proxy trust. The local shared namespace arrangement is a demo configuration.
5. Use managed secrets, backups, monitoring and a rollback procedure. Check Groq/geocoding/tile provider quotas and privacy requirements for real customer data.
6. Verify the application in a browser and perform security and concurrency checks. Current build-only CI is not regression coverage.
