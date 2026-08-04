# 04 - New Cards: Useful Expressions (常用表达)

**What to build:**
- **Context Input:** Textarea for full sentence context.
- **Strict Tagging:** Checkboxes for `informal`, `formal`, `general`. Rules: informal/formal are mutually exclusive. If neither checked -> defaults to general. If both checked -> activates general, clears others. Manual general -> clears others.
- **Front Side:** Input for target word.
- **AI Generation:** "Backside" button calls AI to analyze context and generate explanation.
- **Duplicate Check:** Search DB. Show up to 3 similar cards. If match, show `+1` button to increment that card's *Revision Count*.
- **Save:** Store tags, front word, AI explanation, init Repetitions and UseCount.

**Blocked by:** 03-dashboard-stats.md
**Status:** open
