import { assassinTemplate } from './assassin'
import { carryTemplate } from './carry'
import { emptyTemplate } from './empty'
import { frontlineTemplate } from './frontline'
import { pickTemplate } from './pick'
import { supportTemplate } from './support'
import { tankTemplate } from './tank'

export type { HeroTemplateDefinition, HeroTemplateId } from './types'

export const HERO_TEMPLATES = [
  assassinTemplate,
  carryTemplate,
  frontlineTemplate,
  pickTemplate,
  supportTemplate,
  tankTemplate,
  emptyTemplate,
]
