# Cline Rules for arsenal-matchday-pulse

This file defines operational rules and preferences for Cline when working in this repository.

## Dev Server Port Policy

- Always run the local dev server on port 5173.
- Do not allow automatic fallback to another port (e.g., 5174).
- Use Vite with strict port: `vite dev --port 5173 --strictPort`.
- When port 5173 is occupied:
  - Prefer failing fast and prompting to free the port rather than switching ports.
  - If needed, find and terminate the process after explicit approval:
    - macOS: `lsof -i :5173` to find PID(s), then `kill -9 <PID>` (requires approval).
  - Alternatively, advise the user to close whatever is using 5173 and re-run the dev server.

## Commands

- Start dev server:
  - `npm run dev` (configured to `vite dev --port 5173 --strictPort`)
- Build: `npm run build`
- Preview: `npm run preview`

## Additional Guidelines

- When starting the dev server, if 5173 is in use, report the conflict and follow the steps above rather than changing the port.
- Do not modify the dev server port in scripts or commands unless explicitly instructed to change this policy.
