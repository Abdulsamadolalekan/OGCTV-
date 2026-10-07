#!/usr/bin/env node
// Offline recovery for a lost newsroom password.
//
//   npm run db:recover-password                 # asks for the account email, then the new password twice
//   npm run db:recover-password -- --email a@b.c
//
// Why this exists instead of a "forgot password" link: OGCTV has no mail transport, and a reset
// link handed over by any other channel (SMS, WhatsApp, a helpdesk ticket) is weaker than the
// credential it replaces. So recovery is a server-side, human-attended operation:
//
//   * it only runs on a real terminal — no piping, no CI, no heredoc, nothing to log;
//   * the new password is never an argument, so it never enters shell history or `ps`;
//   * input is masked, and nothing it types is ever echoed or written out;
//   * every session for the account is destroyed, so a stolen cookie dies with the old password;
//   * it refuses to run when the database is missing or has no accounts (use /admin/setup for that).
//
// Run it as the user that owns the data directory, on the machine that holds it.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as tty from 'node:tty'
import { resetPasswordForEmail, userCount } from '../src/lib/auth.ts'
import { DB_PATH, MEDIA_DIR } from '../src/lib/db.ts'

const CONFIRM_WORD = 'RESET'
const ALLOWED_FLAGS = new Set(['--email'])

const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i]
  if (token.startsWith('-')) {
    const flag = token.split('=')[0]
    if (!ALLOWED_FLAGS.has(flag)) {
      console.error(
        `\n  ✗ Unknown or disallowed option "${flag}".\n` +
          '    The only accepted option is --email <address>. A password can never be passed in.\n',
      )
      process.exit(1)
    }
    if (!token.includes('=') && i + 1 >= argv.length) {
      console.error('\n  ✗ --email needs a value.\n')
      process.exit(1)
    }
  }
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    '\n  ✗ Password recovery only runs on an interactive terminal.\n' +
      '    It cannot read a passphrase from a pipe, a file or an argument — that is the point.\n',
  )
  process.exit(1)
}

function flagValue(name) {
  const inline = argv.find((token) => token.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

const input = new tty.ReadStream(0)
input.setEncoding('utf8')
let masking = false
let typed = ''
let waiting = null
const queued = []

input.on('data', (chunk) => {
  for (const char of chunk) {
    const code = char.codePointAt(0)
    if (code === 3) {
      process.stdout.write('\n')
      console.error('  Cancelled — nothing was changed.')
      process.exit(130)
    }
    if (code === 13 || code === 10) {
      const answer = typed
      typed = ''
      process.stdout.write('\n')
      masking = false
      // A pasted pair of lines, or a terminal that hands us a whole block at once,
      // must not lose an answer: serve the waiting prompt, otherwise queue it.
      if (waiting) {
        const settle = waiting
        waiting = null
        settle(answer.trim())
      } else {
        queued.push(answer.trim())
      }
      continue
    }
    if (code === 127 || code === 8) {
      if (typed.length > 0) {
        typed = typed.slice(0, -1)
        process.stdout.write('\b \b')
      }
      continue
    }
    if (code < 32) continue
    typed += char
    process.stdout.write(masking ? '•' : char)
  }
})

input.on('end', () => {
  if (typed) queued.push(typed.trim())
  typed = ''
  const settle = waiting
  waiting = null
  if (settle) settle('')
})

function ask(label, { hidden = false } = {}) {
  if (queued.length > 0) return Promise.resolve(queued.shift())
  masking = hidden
  typed = ''
  process.stdout.write(label)
  return new Promise((done) => {
    waiting = done
  })
}

async function main() {
  const dataDir = resolve(DB_PATH, '..')
  console.log('\n  OGCTV newsroom password recovery\n')
  console.log(`  database:  ${DB_PATH}`)
  console.log(`  media dir: ${MEDIA_DIR}`)
  if (!existsSync(DB_PATH)) {
    console.error(
      `\n  ✗ There is no database at ${DB_PATH}.\n` +
        `    Check OGCTV_DATA_DIR (currently "${process.env.OGCTV_DATA_DIR || 'unset'}"); the app must have started once from ${dataDir}.\n`,
    )
    process.exit(1)
  }
  if (userCount() === 0) {
    console.error(
      '\n  ✗ This newsroom has no accounts yet, so there is nothing to recover.\n' +
        '    Open /admin/setup once and create the first administrator there.\n',
    )
    process.exit(1)
  }

  const email = flagValue('--email') || (await ask('  Account email: '))
  if (!email) {
    console.error('\n  ✗ No email address supplied. Nothing was changed.\n')
    process.exit(1)
  }

  const first = await ask('  New password (masked, at least 12 characters): ', { hidden: true })
  if (!first) {
    console.error('\n  ✗ An empty password was entered. Nothing was changed.\n')
    process.exit(1)
  }
  const second = await ask('  Repeat it: ', { hidden: true })
  if (first !== second) {
    console.error('\n  ✗ The two entries did not match. Nothing was changed.\n')
    process.exit(1)
  }

  console.log(
    `\n  This replaces the passphrase for ${email} and signs out every device holding a session for it.\n`,
  )
  const confirmation = await ask(`  Type ${CONFIRM_WORD} to continue: `)
  if (confirmation !== CONFIRM_WORD) {
    console.error('\n  ✗ Confirmation was not typed exactly. Nothing was changed.\n')
    process.exit(1)
  }

  const result = await resetPasswordForEmail(email, first)
  if (!result.ok) {
    console.error(`\n  ✗ ${result.error} Nothing was changed.\n`)
    process.exit(1)
  }
  console.log(
    `\n  ✓ Password updated for ${email} (${result.name}). ${result.signedOut} active session(s) signed out.\n` +
      '    Sign in at /admin/login to confirm, then store the passphrase in your password manager.\n',
  )
}

main().catch((error) => {
  console.error(`\n  ✗ ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
