import { db } from './connection'
import { initDB } from './init'
import { cardsRepo } from './cardsRepo'
import { reviewRepo } from './reviewRepo'
import { settingsRepo } from './settingsRepo'
import { searchService } from './searchService'

export const dbHandlers = {
  ...cardsRepo,
  ...reviewRepo,
  ...settingsRepo,
  ...searchService
}

export { db, initDB }
