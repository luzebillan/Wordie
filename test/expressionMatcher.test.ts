import { describe, it, expect } from 'vitest'
import {
  buildTermRegexes,
  isCardInText,
  findCardMatches,
  segmentTextWithCards
} from '../src/utils/expressionMatcher'

describe('expressionMatcher', () => {
  const sampleText = `Hello everyone. Today's talk is for parents and parents-to-be on how to ensure our children get their due respect—the right way.

Respect doesn't mean indulging every whim or letting kids call the shots as if their desires are the be-all and end-all, it means recognizing them as autonomous individuals. Today, I would like to share three approaches, illustrated by three stories.

First, be tuned in to their personal boundaries without overstepping. Kids shouldn't live under constant surveillance like they're in a 360-degree panopticon; home must be a safe haven where they can freely vent their emotions. They prop up each other and put ideas in the wild.`

  it('matches plain idiom with verb inflections ("call the shots" -> "call the shots")', () => {
    const card = { id: 1, front: 'call the shots' }
    expect(isCardInText(card, sampleText)).toBe(true)

    const matches = findCardMatches(sampleText, [card])
    expect(matches).toHaveLength(1)
    expect(matches[0].matchText).toBe('call the shots')
  })

  it('matches expression with placeholder ("be tuned in to sth." -> "be tuned in to")', () => {
    const card = { id: 400, front: 'be tuned in to sth.' }
    expect(isCardInText(card, sampleText)).toBe(true)

    const matches = findCardMatches(sampleText, [card])
    expect(matches).toHaveLength(1)
    expect(matches[0].matchText).toBe('be tuned in to')
  })

  it('matches hyphenated expression with optional leading article ("the be-all and end-all")', () => {
    const card1 = { id: 2, front: 'the be-all and end-all' }
    const card2 = { id: 3, front: 'be-all and end-all' }
    expect(isCardInText(card1, sampleText)).toBe(true)
    expect(isCardInText(card2, sampleText)).toBe(true)

    const matches = findCardMatches(sampleText, [card1])
    expect(matches).toHaveLength(1)
    expect(matches[0].matchText).toBe('the be-all and end-all')
  })

  it('matches pronoun placeholder ("get one\'s due" -> "get their due")', () => {
    const card = { id: 465, front: "get one's due" }
    expect(isCardInText(card, sampleText)).toBe(true)

    const matches = findCardMatches(sampleText, [card])
    expect(matches).toHaveLength(1)
    expect(matches[0].matchText).toBe('get their due')
  })

  it('matches middle placeholder ("prop sth. up" -> "prop up")', () => {
    const card = { id: 126, front: 'prop sth. up' }
    expect(isCardInText(card, sampleText)).toBe(true)
  })

  it('segments text accurately without dropping or corrupting characters', () => {
    const cards = [
      { id: 1, front: 'call the shots' },
      { id: 2, front: 'the be-all and end-all' },
      { id: 400, front: 'be tuned in to sth.' },
      { id: 465, front: "get one's due" }
    ]

    const segments = segmentTextWithCards(sampleText, cards)

    // Reconstructing segments should match original text exactly
    const reconstructed = segments.map(s => s.text).join('')
    expect(reconstructed).toBe(sampleText)

    // Verify all 4 cards matched in segments
    const matchedCardIds = segments.filter(s => s.card).map(s => s.card.id)
    expect(matchedCardIds).toContain(1)
    expect(matchedCardIds).toContain(2)
    expect(matchedCardIds).toContain(400)
    expect(matchedCardIds).toContain(465)
  })

  it('handles multiline glossary card with Chinese and English', () => {
    const card = { id: 50, front: '化疗\nChemo(therapy)' }
    const text = 'The patient responded well to chemotherapy treatment.'
    expect(isCardInText(card, text)).toBe(true)

    const matches = findCardMatches(text, [card])
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].matchText.toLowerCase()).toBe('chemotherapy')
  })

  it('handles acronyms in parentheses', () => {
    const card = { id: 60, front: '射频识别\nRadio Frequency Identification (RFID)' }
    const text1 = 'Tracking devices use RFID tags.'
    const text2 = 'The system uses Radio Frequency Identification.'
    expect(isCardInText(card, text1)).toBe(true)
    expect(isCardInText(card, text2)).toBe(true)
  })

  it('matches inflected verbs in cards', () => {
    const cardCall = { id: 1, front: 'call the shots' }
    expect(isCardInText(cardCall, 'She called the shots during the crisis.')).toBe(true)
    expect(isCardInText(cardCall, 'Who is calling the shots here?')).toBe(true)
    expect(isCardInText(cardCall, 'He always calls the shots.')).toBe(true)

    const cardTune = { id: 400, front: 'be tuned in to sth.' }
    expect(isCardInText(cardTune, 'She was tuned in to the room.')).toBe(true)
    expect(isCardInText(cardTune, 'They were tuned in to the changes.')).toBe(true)
    expect(isCardInText(cardTune, 'Always stay tuned in to user feedback.')).toBe(true)
  })

  it('matches reflexives and hyphens', () => {
    const cardFoot = { id: 254, front: 'shoot oneself in the foot' }
    expect(isCardInText(cardFoot, 'They shot themselves in the foot.')).toBe(true)
    expect(isCardInText(cardFoot, 'He is going to shoot himself in the foot.')).toBe(true)

    const cardOneSize = { id: 287, front: 'one-size-fits-all' }
    expect(isCardInText(cardOneSize, 'This is not a one size fits all solution.')).toBe(true)
    expect(isCardInText(cardOneSize, 'Avoid one-size-fits-all policies.')).toBe(true)
  })

  it('matches phrasal verbs with adverbial intensifiers ("barge in" -> "barged right in")', () => {
    const card = { id: 300, front: 'barge in' }
    expect(isCardInText(card, 'He barged right in without knocking.')).toBe(true)
    expect(isCardInText(card, 'She barged straight in.')).toBe(true)
    expect(isCardInText(card, 'They just barged in.')).toBe(true)
  })

  it('matches middle placeholders with intervening words ("prop sth. up" -> "propped each other up")', () => {
    const card = { id: 126, front: 'prop sth. up' }
    expect(isCardInText(card, 'They propped each other up in difficult times.')).toBe(true)
    expect(isCardInText(card, 'He props the door up.')).toBe(true)
  })

  it('matches regular verb conjugations ("rely on" -> "relied on", "relying on")', () => {
    const card = { id: 305, front: 'rely on sth.' }
    expect(isCardInText(card, 'He relied on their support.')).toBe(true)
    expect(isCardInText(card, 'They are relying on the outcome.')).toBe(true)
    expect(isCardInText(card, 'She relies on her team.')).toBe(true)
  })
})
