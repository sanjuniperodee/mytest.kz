/**
 * One-time script to check for missing profile subject pairs in the database.
 * Run with: npx ts-node --transpile-only prisma/check-missing-profiles.ts
 *
 * Compares profileSubjects values in EntEducationalProgram against the allowed
 * pairs from @bilimland/shared constants.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Allowed pairs from shared constants
  const ALLOWED_PAIRS = new Set([
    'math:physics',
    'math:geography',
    'math:informatics',
  ])

  const programs = await prisma.entEducationalProgram.findMany({
    select: { profileSubjects: true, code: true, name: true },
    distinct: ['profileSubjects'],
  })

  console.log('\n=== Profile Subject Pairs in Database ===\n')
  console.log(`Total unique pairs: ${programs.length}\n`)

  const unknown: typeof programs = []
  const known: typeof programs = []

  for (const p of programs) {
    if (p.profileSubjects && ALLOWED_PAIRS.has(p.profileSubjects)) {
      known.push(p)
    } else {
      unknown.push(p)
    }
  }

  console.log(`Known pairs (have cutoff data): ${known.length}`)
  for (const p of known) {
    console.log(`  ${p.profileSubjects} — ${p.code}: ${p.name}`)
  }

  console.log(`\nUnknown/missing pairs: ${unknown.length}`)
  for (const p of unknown) {
    console.log(`  "${p.profileSubjects}" — ${p.code}: ${p.name}`)
  }

  if (unknown.length === 0) {
    console.log('\nAll DB pairs are covered by allowed pairs.')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
