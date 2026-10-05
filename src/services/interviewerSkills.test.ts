import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }

const fake = vi.hoisted(() => {
  const calls: Call[] = []
  let next: { data: unknown; error: unknown } = { data: null, error: null }
  const supabase = {
    from(table: string) {
      const call: Call = { table, op: 'select', filters: [] }
      calls.push(call)
      const builder = {
        insert(payload: unknown) {
          call.op = 'insert'
          call.payload = payload
          return builder
        },
        update(payload: unknown) {
          call.op = 'update'
          call.payload = payload
          return builder
        },
        delete() {
          call.op = 'delete'
          return builder
        },
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value])
          return builder
        },
        order() {
          return builder
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(next).then(resolve, reject)
        },
      }
      return builder
    },
  }
  return {
    calls,
    supabase,
    respond(value: { data: unknown; error: unknown }) {
      next = value
    },
  }
})

vi.mock('../lib/supabase.ts', () => ({ supabase: fake.supabase }))

const {
  SKILL_DUPLICATE,
  SKILL_REQUIRED,
  SKILL_TOO_LONG,
  addInterviewerSkill,
  cleanSkillInput,
  deleteInterviewerSkill,
  renameInterviewerSkill,
  skillErrorMessage,
} = await import('./interviewerProfile.ts')

const MY_PROFILE = 'ip-mine'

beforeEach(() => {
  fake.calls.length = 0
  fake.respond({ data: null, error: null })
})

describe('skill input', () => {
  it('trims and collapses whitespace and leaves canonical naming to the database', () => {
    expect(cleanSkillInput('  Power   BI ')).toBe('Power BI')
    expect(cleanSkillInput('python3')).toBe('python3')
    expect(() => cleanSkillInput('   ')).toThrow(SKILL_REQUIRED)
    expect(() => cleanSkillInput('x'.repeat(61))).toThrow(SKILL_TOO_LONG)
  })

  it('maps database errors to friendly messages without exposing raw errors', () => {
    expect(skillErrorMessage({ code: '23505', message: 'duplicate_skill' })).toBe(SKILL_DUPLICATE)
    expect(skillErrorMessage({ code: '22023', message: 'invalid_skill' })).toBe(SKILL_REQUIRED)
    expect(skillErrorMessage({ code: '42501', message: 'new row violates row-level security policy' })).toBe(
      'Could not save the skill. Try again.',
    )
  })
})

describe('skill CRUD', () => {
  it('creates a skill for the signed-in interviewer and returns the canonical label', async () => {
    fake.respond({ data: [{ id: 's1', skill: 'Python' }], error: null })
    await expect(addInterviewerSkill(MY_PROFILE, ' python3 ')).resolves.toEqual({ id: 's1', skill: 'Python' })
    expect(fake.calls[0]).toMatchObject({
      table: 'interviewer_skills',
      op: 'insert',
      payload: { interviewer_profile_id: MY_PROFILE, skill: 'python3' },
    })
  })

  it('reports a canonical duplicate when the database skips the insert', async () => {
    fake.respond({ data: [], error: null })
    await expect(addInterviewerSkill(MY_PROFILE, 'Python 3')).rejects.toThrow(SKILL_DUPLICATE)
  })

  it('edits a skill scoped to the owning interviewer', async () => {
    fake.respond({ data: [{ id: 's2', skill: 'Machine Learning' }], error: null })
    await expect(renameInterviewerSkill(MY_PROFILE, 's2', 'ml')).resolves.toEqual({ id: 's2', skill: 'Machine Learning' })
    expect(fake.calls[0]).toMatchObject({ op: 'update', payload: { skill: 'ml' } })
    expect(fake.calls[0].filters).toEqual([
      ['id', 's2'],
      ['interviewer_profile_id', MY_PROFILE],
    ])
  })

  it('rejects renaming onto a skill the interviewer already has', async () => {
    fake.respond({ data: null, error: { code: '23505', message: 'duplicate_skill' } })
    await expect(renameInterviewerSkill(MY_PROFILE, 's2', 'Python')).rejects.toThrow(SKILL_DUPLICATE)
  })

  it('deletes only the given skill of the owning interviewer', async () => {
    await deleteInterviewerSkill(MY_PROFILE, 's3')
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ table: 'interviewer_skills', op: 'delete' })
    expect(fake.calls[0].filters).toEqual([
      ['id', 's3'],
      ['interviewer_profile_id', MY_PROFILE],
    ])
  })
})
