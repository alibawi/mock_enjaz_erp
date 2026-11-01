import { checkFoundation } from '../../src/modules/contracts/data/integrity'
import { seed } from '../../src/modules/contracts/data/seed'

const errs = [...checkFoundation(seed())]
if (errs.length) {
  console.error(`integrity: ${errs.length} problem(s)`)
  errs.forEach((e) => console.error(' -', e))
  process.exit(1)
}
console.log('integrity: OK')
