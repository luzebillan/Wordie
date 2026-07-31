---
labels: ready-for-agent
---

# CardsApp Engineering Specification

## Problem Statement

The user needs a highly customized desktop English learning application (CardsApp) based on a personal corpus (Sketch Engine). It must support creating, reviewing (via SM-2 spaced repetition), and practicing (using AI to embed words) flashcards across four categories: Useful Expressions, Glossary, Daily Words, and Ready Versions. The client requires a standalone Windows desktop executable experience (not just a website), but is non-technical, meaning API setup must be heavily guided.

## Solution

An Electron-based desktop application using Vite + React for the frontend. It connects to OpenAI for generation/practice logic and Sketch Engine for contexts. It tracks card usage and review state using the SM-2 algorithm. The user interface emphasizes three core functions (New Cards, Revision, Practice) with settings available via a user-friendly modal.

## User Stories

1. As a language learner, I want to create a new "Useful Expression" card by pasting a context sentence and a target word, so that AI can generate the explanation for me.
2. As a language learner, I want to select a style (Informal, Formal, General) for my expressions, so that I can practice them in the correct tone.
3. As a language learner, I want to see up to 3 similar expressions when creating a new card, so that I avoid creating duplicates and can just increase their "Use Count".
4. As a language learner, I want to create bilingual "Glossary" cards with subject labels, so that I can master technical terms in specific domains.
5. As a language learner, I want to create "Daily Words" cards either by text or by pasting an image link, so that I can visually associate words with real-world objects.
6. As a language learner, I want the system to automatically download and cache image links locally, so that I don't lose the image if the original link expires.
7. As a language learner, I want to upload local images for my Daily Words, so that I have a fallback if links are unavailable.
8. As a language learner, I want to create "Ready Versions" (phrases/sentences), so that I can practice fixed grammatical structures.
9. As a language learner, I want to review cards using a Spaced Repetition System (SM-2), so that my learning is optimized for long-term retention.
10. As a language learner, I want to do cloze tests on Useful Expressions during revision, so that I can practice recalling words in context.
11. As a language learner, I want to edit card text during revision without resetting the card's SRS interval, so that I can fix typos without being penalized.
12. As a language learner, I want to write a paragraph in the Practice module and have AI rewrite it, so that I can learn native-like phrasing.
13. As a language learner, I want AI to insert words from my database into my practice writing, so that I actively use what I've learned.
14. As a language learner, I want the AI to dynamically reduce the number of inserted words if my text is too short, so that the resulting text sounds natural.
15. As a language learner, I want to see my daily retention rate and total cards reviewed, so that I can track my daily progress.
16. As a language learner, I want my settings (AI URL, API Key, Model, Sketch Engine Key) to be accessible via a settings modal, so that the main UI is kept clean.
17. As a non-technical user, I want clear links and default values in the settings, so that I can easily set up the required APIs.
18. As a non-technical user, I want to test my API connections in the settings, so that I know my keys are working before I start studying.

## Implementation Decisions

- **Framework**: Electron (for the mandatory desktop requirement) using `electron-vite` (Vite + React) to avoid complex npm permission issues on Windows.
- **Data Storage**: A local SQLite database (via `better-sqlite3` in the main process) to store cards, review histories, and local image paths.
- **SRS Algorithm**: Implement the SuperMemo-2 (SM-2) algorithm. Repetitions, Interval, and Ease Factor are tracked per card. Editing card content does not mutate these fields.
- **Use Count**: Implemented as a generic property on the base Card schema (not just for Useful Expressions) to allow future expansion of the Practice module across all card types.
- **Image Handling**: An IPC handler in the main process will download images from provided URLs, store them locally in the app's `userData` directory, and save the local path in the database.
- **Loading Sequence**: The splash screen transitions dynamically as soon as local data and API checks (Ping) are resolved, with a minimum 1s display.
- **Settings UI**: Kept in a dedicated Modal instead of a persistent left panel.
- **Client Configuration**: `AI Model` is a dropdown; `AI URL` has a sensible default; `Sketch Engine Key` update pings the server and only extends the validity by 31 days upon a 200 OK. Links to tutorial pages are provided inline.

## Testing Decisions

- **Algorithm Logic**: Unit test the SM-2 algorithm pure logic (given state X and action Y, expect state Z) without touching the DB.
- **Image Caching**: Unit test the image caching utility by mocking network requests and verifying file system writes.
- **Prompt Generation**: Test the Practice module's prompt builder ensuring it properly requests dynamic word insertion based on input length.

## Out of Scope

- Cloud syncing across multiple devices.
- Collaborative decks or social features.
- Advanced statistical charts (beyond the Today dashboard).

## Further Notes

- The database schema should be designed carefully early on since migrations in Electron apps can be tricky. All card types should ideally share a generic table with type-specific payloads (or a single flexible table) to simplify the Use Count and SM-2 implementations.
