# Engineering review

The project is suitable as a portfolio application demonstrating Angular, Spring Boot, PostgreSQL, transactional assignment, versioned map edits and optional AI integration. Describe it as a local application until deployment and runtime checks are complete.

Implemented safeguards include database locking for assignment, stale geography write rejection, server-side capacity/coverage checks, provider timeouts and limits, Markdown sanitization, and a production security profile with authorization and CSRF protection. The Groq key stays on the backend.

Known limits: workload ranking does not estimate routes or travel times; public providers have quotas; caches and request limits are per process; large collections need pagination/aggregate queries; production needs a complete migration baseline, backups, HTTPS and verified authentication. A dedicated login interface is not implemented.

Backend workflow regression tests now cover assignment races, capacity release, rollback, lifecycle transitions and coverage using a disposable PostgreSQL database in CI. Frontend tests and provider simulations remain absent. Docker images build successfully and all three containers pass health checks. Frontend HTTP and proxied database health were verified; browser workflows and restart persistence remain unverified. Browser and accessibility checks, clean hosted CI and measured performance remain outstanding.

Suggested CV wording after confirming the build: “Built a Germany-focused logistics application using Angular, Spring Boot and PostgreSQL, with transactional driver assignment, versioned map updates and Groq-assisted operational drafts.” Add deployment claims only after successful deployment; do not claim measured business impact or scale without evidence.
