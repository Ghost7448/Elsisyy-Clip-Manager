# Elsisyy Clip Manager

A multi-channel Kick clips management dashboard.

## Current status

This repository starts with the dashboard foundation. The current UI uses clearly labeled demo data; it does not connect to Kick or delete real clips yet.

## Important integration note

Before enabling real bulk deletion, the project must use a documented, authorized Kick capability that supports the required clip listing and deletion permissions. Do not collect Kick passwords, scrape private endpoints, or bypass role restrictions. A moderator's visible Delete button in the website does not automatically grant an external application permission to invoke that action.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.
