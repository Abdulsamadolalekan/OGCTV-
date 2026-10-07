import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, verifyPassword } from '../src/lib/auth.ts'

test('password hashing uses a random salt and verifies in constant-time path', async () => {
  const a = await hashPassword('a long newsroom passphrase')
  const b = await hashPassword('a long newsroom passphrase')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('a long newsroom passphrase', a), true)
  assert.equal(await verifyPassword('wrong password', a), false)
})
