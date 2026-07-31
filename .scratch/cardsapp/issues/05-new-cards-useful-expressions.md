# 05 — New Cards: Useful Expressions

**What to build:** The first sub-tab under "New Cards". A UI to input context, choose style, and input target word. Clicking generate queries the AI API (using the settings) to create the explanation. Duplicate check queries the DB for similar expressions and displays up to 3 matches on the side, allowing the user to +1 use count instead of creating duplicates.

**Blocked by:** 04-splash-and-dashboard

**Status:** ready-for-agent

- [ ] Build Useful Expressions form UI.
- [ ] Implement AI generation logic via IPC/frontend service.
- [ ] Implement duplicate checking SQL query (string/semantic match).
- [ ] Save new card to database with initial SRS state.
