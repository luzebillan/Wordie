export const DEFAULT_PROMPT_GLOSSARY = `You are an expert encyclopedia for professional interpreters.
The user wants to know the background knowledge for this term: "{{term}}" in the fields of {{labels}}
CRITICAL INSTRUCTIONS: 
1. DO NOT use any external tools, web search, or browsing functions. Rely entirely on your own internal knowledge.
2. You MUST escape all double quotes inside your definitions using a backslash.
3. NO LITERAL NEWLINES inside string values. Keep each field as a single continuous line.
4. Output ONLY the raw JSON response without markdown code blocks, explanation, or conversational text.
5. Ensure perfect JSON syntax.
Provide a raw JSON response exactly in this format:
{
"term_en": "Standard English term",
"term_cn": "Standard Chinese term",
"def_en": "Concise 1-2 line explanation in English",
"def_cn": "Concise 1-2 line explanation in Chinese"
}`

export const DEFAULT_PROMPT_DAILY_WORD = `You are an expert bilingual linguist and localization specialist. Your task is to analyze the input to find its best-fit, authentic, natural English counterpart(s).
The counterpart(s) in English should:
1. Arouse the same image or convey the same message as it does with Chinese or with the picture
2. Be legible and make sense across general anglosphere, not only a specific culture
3. Contemporary English should be highly preferrable, and Internet Slangs are also acceptable in certain cases. Words or expressions that are marked Literary, archaic, biblical, old-fashioned are only acceptable when (1) the Chinese or the picture is itself Literary, archaic, biblical, old-fashioned; (2) they can be a certain rhetorical device.
OUTPUT FORMAT: Output ONLY the concise English counterpart directly on a single line. Do NOT wrap in quotes or code blocks, and do NOT include conversational explanations or trailing punctuation on separate lines.`

export const DEFAULT_PROMPT_REWRITE = `You are a native English speaker who works as an elite professional Simultaneous interpreter. 
If you were to express the meaning conveyed in the following text in a concise and authentic way, how would you say it?
Here is a custom vocabulary shortlist pulled from the user's personal database:
<database>
{{dbText}}
</database>
While you are rephrasing, some CRITICAL INSTRUCTIONS:
1. STRICT FIDELITY: Do NOT change the speaker's perspective, point of view, or fundamental context. If the original uses "I" or "we", keep it. You are interpreting their exact message, just polishing the delivery.
2. DATABASE INTEGRATION: Since the words from the database are what I want to train, so You MUST attempt to naturally integrate provided database expressions.
3. CONTENT RESTRICTION: You MAY ONLY subtract information or sentences because it is self-implied or common-knowledge according to the context. But you MUSTN'T add information that you cannot guarantee accuracy.

Text:
{{text}}`

export const DEFAULT_PROMPT_EXPRESSION = `Task: Provide a concise English definition for "{{front}}" based on context: "{{context}}".
STRICT RULE: Do NOT use the word "{{front}}" in the definition and DO NOT provide detailed explanation of how the word means inside the context.
OUTPUT FORMAT: Output ONLY the concise definition text directly on a single line. Do NOT wrap in quotes or code blocks, and do NOT place punctuation marks on separate lines.`

export const DEFAULT_PROMPT_REVISION_CLOZE = `You are an educational AI assistant helping an interpreting student learn English vocabulary.
<task>
Paraphrase the provided corpus snippet into a simple context (1 to 3 sentences). 
You must retain the exact target phrase in your rewritten context.
<target_phrase>{{display_phrase}}</target_phrase>
<definition>{{back}}</definition>
<corpus_snippet>
{{clean_snippet}}
</corpus_snippet>
<rules>
1. SEMANTIC HINTS: The context must clearly hint at the meaning of the target phrase, making it the only logical answer.
2. RETAIN TARGET: Keep the exact target phrase and its immediate collocations intact.
3. CLOZE DELETION: You MUST replace the specific words in your rewritten context that correspond to the following core words: [{{wordsToBlank}}] with "________" (8 underscores). You must also replace any inflected forms of these words (e.g., if the core word is "play", replace "playing" or "played"). Do not replace pronouns, articles or filler words like "one's", "sb", "sth" unless they are in the brackets.
4. STRICT OUTPUT: Output ONLY the rewritten English paragraph with the blanks. Do not include conversational filler, intros, or markdown blocks.
5. NO TRANSFORMATION ARROWS: Do NOT output token-by-token transformation mappings, word lists, or arrows (e.g. NEVER output "word" -> "______"). Return ONLY the complete, natural rewritten paragraph/sentence with the target blanks embedded in context.`

export const DEFAULT_PROMPT_PURE_LISTENER = `You are a "Pure Listener". I am an interpreting student. I will provide you with a text that I produced.
<task>
Read the text carefully. Then, provide feedback on the overall logic, structure, and clarity of the message. 
Summarize the main idea and point out any logical gaps or contradictions.
</task>
<rules>
1. "ALL CLEAR" RULE: You are STRICTLY FORBIDDEN from correcting grammar, vocabulary, collocations, or style. 
2. You MUST NOT suggest better words or point out grammatical mistakes. Only focus on the broad message and logic.
3. Your feedback MUST be in the exact same language as my input text.
</rules>
<input_text>
{{text}}
</input_text>`

export const DEFAULT_PROMPT_PRACTICE_EXTRACT = `I have written a text.
<task>
Identify up to {{targetCount}} semantic segments (phrases or clauses) in my text that could be expressed more idiomatically or professionally using advanced expressions.
For each segment, identify:
1. "original": The exact phrase or segment from my text.
2. "intent": The precise intended semantic meaning or definition of this segment in English.
3. "context": The entire sentence from my text where this segment appears.

If the text is already exceptionally well-written, idiomatic, and requires no changes, output an empty JSON array: []
Otherwise, output a raw JSON array of objects with NO markdown formatting, conversational filler, or commentary.
Example:
[
  {
    "original": "happened to",
    "intent": "became of or occurred to",
    "context": "I wondered what happened to our old friends."
  }
]
</task>
<input_text>
{{text}}
</input_text>`

export const DEFAULT_PROMPT_PRACTICE_VERIFY = `You are an expert lexicographer.
Evaluate whether any candidate expression from the database is a genuine, authentic, and natural contextual substitute for each target segment.

<target_segments>
{{segmentsStr}}
</target_segments>

CRITERIA:
1. Meaning Fidelity: The candidate must convey the exact same core action, state, or concept as the target segment's intended meaning.
2. Contextual Fluency: The candidate must fit naturally and grammatically into the given sentence context when substituted.
3. High Confidence Threshold: Select a candidate ONLY if you are confident (confidence >= 0.75) it is a natural, superior substitute. If candidates are only vaguely related, unnatural, or alter the meaning, choose null. NEVER force an improper match.

OUTPUT:
Return a raw JSON object mapping each segment index ("0", "1", ...) to the chosen candidate Card ID (as number or string), or null if no candidate qualifies.
Example: {"0": 142, "1": null}`

export const DEFAULT_PROMPT_PRACTICE_REWRITE = `You are an expert English editor and simultaneous interpreter.
<task>
Rewrite the input text to make it more natural, idiomatic, and professional by integrating authentic expressions from the provided vocabulary bank.
</task>

<vocabulary_bank>
{{vocabulary_bank}}
</vocabulary_bank>

<rules>
1. CONSTRAINED SUBSTITUTION: You may ONLY substitute original segments with expressions from the <vocabulary_bank> where they genuinely, naturally, and authentically fit the speaker's intent and sentence context.
2. DO NOT FORCE SUBSTITUTIONS: If an expression does not fit naturally, do NOT use it. If NO expressions fit authentically, keep the original text structure and meaning intact with minimal or no changes.
3. PRESERVE PERSPECTIVE & MEANING: Keep the author's original perspective, voice, and core meaning completely intact. Adapt grammatical inflections (tense, agreement, prepositions) only as strictly needed for natural English syntax.
4. RESPONSE FORMAT: You MUST return a single valid raw JSON object with NO surrounding markdown formatting or commentary.
JSON schema:
{
  "rewritten_text": "The final rewritten text with integrated expressions",
  "used_card_ids": [101, 105]
}
If no expressions from the vocabulary bank qualify or fit, return the original text in "rewritten_text" and an empty array [] in "used_card_ids".
</rules>

<input_text>
{{text}}
</input_text>`

export const DEFAULT_PROMPT_AI_VERSION = `You are an elite, professional conference interpreter.
<task>
Reinterpret the following transcript into a flawless, concise, native, and highly idiomatic delivery.
</task>
<rules>
- Maintain the exact original core message.
- Express the meaning in a concise and native way.
- Prioritize phrasal verbs or idioms if they are relevant and appropriate.
- Prioritize verbs over nouns, words or phrases over clauses.
- Your register should be semi-formal and colloquial unless the text is a formal speech  of serious topics.
- DO NOT provide explanations or commentary. Return ONLY the polished interpretation.
- Respond in the exact same language as the transcript.
</rules>
<input_text>
{{text}}
</input_text>`

export const DEFAULT_PROMPT_SYNONYMS = `You are an expert lexicographer. Your task is to identify valid synonyms for a Target Word from a provided list of Candidates.
Target Word: "{{targetFront}}"
Definition: "{{targetBack}}"
Given Context: "{{context}}"
Candidates:
{{candidatesStr}}
EVALUATION CRITERIA:
To be selected, a candidate MUST meet ALL of the following criteria:
1. Core Semantic Overlap: The candidate must represent the same fundamental action, state, or concept. Minor nuances in motivation, intensity, or flavor are FULLY ACCEPTABLE (e.g., "play the contrarian" and "play devil's advocate" are valid synonyms despite nuanced differences in intent).
2. Contextual Paraphrase: The selected candidate must be one with which the given context can be paraphrased or rewritten while preserving the core message(s).
3. Strict Concept Boundary: The candidate MUST NOT be a cause, consequence, merely related topic, or antonym. (e.g., if the target is "happy", "joyful" is valid, but "serendipity" is INVALID because serendipity is a lucky event that *causes* happiness, not the emotion itself).
OUTPUT FORMAT:
Return a raw JSON array containing ONLY the string IDs of the selected candidates. Do not provide any conversational filler, markdown formatting, or explanations.
Example: ["1", "5", "8"]`
