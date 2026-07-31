# 09 — Practice Module (Writing & Highlighting)

**What to build:** The Practice tab. Contains an input area for writing. A submit button sends the text to the AI, asking it to rewrite and embed 6-8 words randomly selected from the user's DB. AI dynamically reduces count if input is too short. Render the rewritten text with embedded words highlighted. Clicking a highlight opens a tooltip/modal showing the word's back side and increments its `Use Count` in the DB.

**Blocked by:** 08-revision-engine

**Status:** ready-for-agent

- [ ] Build Practice Tab UI (input area and result area).
- [ ] Query DB for random words and feed them to the AI Prompt.
- [ ] Implement AI prompt with dynamic downgrade instructions.
- [ ] Parse AI output and render highlighted clickable words.
- [ ] Implement `+1 Use Count` database update upon clicking.
