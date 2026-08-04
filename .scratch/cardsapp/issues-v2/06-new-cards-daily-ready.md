# 06 - New Cards: Daily Words & Ready Version

**What to build:**
- **Daily Words (日常用语):** 
  - Input: Chinese text OR Image (upload or paste link). Mutually exclusive.
  - "Generate" (AI translates to English) or manual input + "Check".
  - String match dup check -> `+1` Revision Count or Save.
  - *Image Caching:* Background process downloads pasted URL image to local storage, saves local path to DB.
- **Ready Version (固定表达):**
  - 4 fixed, uneditable tags (radio selection).
  - Front (Chinese), Back (English).
  - String match dup check -> `+1` Revision Count or Save.

**Blocked by:** 05-new-cards-glossary.md
**Status:** open
