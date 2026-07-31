# 03 — Settings Modal & API Validation

**What to build:** A settings modal accessible from the UI. Allows users to enter API Keys, select AI Models (dropdown), and set AI URLs with defaults. When updating the `Sketch Engine Key`, perform a test request; on success, update a local `Until [Date]` to be 31 days in the future. Add "How to get this" help links next to fields.

**Blocked by:** 02-database-setup

**Status:** done

- [x] Create Settings UI Modal.
- [x] Implement Secure storage/DB storage for these settings.
- [x] Implement network fetch (Ping) for Sketch Engine to validate key.
- [x] Display `Until [Date]` validity dynamically.
- [x] Provide a [Test Connection] button for AI settings.
