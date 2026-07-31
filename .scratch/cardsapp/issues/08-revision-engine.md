# 08 — Revision Engine & SM-2 Algorithm

**What to build:** The Revision Tab. Query DB for cards due today. Present cards one by one. For Useful expressions, render a cloze test using AI or regex. Show `Show Answer` button. Once flipped, show `Got it` and `Forget` buttons. Implement the SM-2 math to update the card's interval, repetitions, and ease factor upon clicking these buttons. Also, provide inline editing for the card text that updates the DB without resetting the SRS interval.

**Blocked by:** 07-image-caching-system

**Status:** ready-for-agent

- [ ] Query for due cards based on Interval and Last Review Date.
- [ ] Implement SM-2 mathematical logic for state transitions.
- [ ] Build Revision UI rendering different templates per card type.
- [ ] Implement inline text editing and save functionality.
- [ ] Add Forget / Got it buttons and database update logic.
