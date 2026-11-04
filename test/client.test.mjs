import assert from 'node:assert/strict'
import test from 'node:test'

/** Capture the bundle registration the client module system would receive. */
let registration
globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      registration = value
    }
  }
}

await import('../client.js')

/** Minimal React stand-in: the factory only needs to build, not render. */
const reactStub = {
  createElement() {},
  useReducer() {},
  useEffect() {},
  useState() {},
  useRef() {},
  useCallback() {}
}

const bundle = registration.factory((specifier) => {
  if (specifier === 'react') return reactStub
  throw new Error(`unexpected module request: ${specifier}`)
})

test('registers the account Remote services and the composer dock seat', () => {
  assert.equal(registration.id, 'dsh-deepseek-account-balance')
  assert.equal(typeof bundle.apply, 'function')
  assert.deepEqual(bundle.inject, ['slots', 'locale', 'remote', 'remote.account'])
})

test('formats wallets with the Platform two-decimal rules', () => {
  const { formatAmount } = bundle.__test
  assert.equal(formatAmount('0', 'CNY'), '¥0.00')
  assert.equal(formatAmount('0E-16', 'CNY'), '¥0.00')
  assert.equal(formatAmount('5.0000000000000000', 'CNY'), '¥5.00')
  assert.equal(formatAmount('0.004', 'CNY'), '<¥0.01')
  assert.equal(formatAmount('-0.004', 'CNY'), '-¥0.01')
  assert.equal(formatAmount('12.3456', 'CNY'), '¥12.35')
  assert.equal(formatAmount('1234.5', 'USD'), '$1,234.50')
  assert.equal(formatAmount('not-a-number', 'CNY'), '¥not-a-number')
})

test('joins multiple wallets and ignores an empty list', () => {
  const { formatWallets } = bundle.__test
  assert.equal(formatWallets([]), '')
  assert.equal(formatWallets(undefined), '')
  assert.equal(formatWallets([{ currency: 'CNY', balance: '5' }]), '¥5.00')
  assert.equal(
    formatWallets([
      { currency: 'CNY', balance: '5' },
      { currency: 'USD', balance: '3' }
    ]),
    '¥5.00 + $3.00'
  )
})

test('builds the account client metadata from the boot payload', () => {
  const { clientVersion, activeLocale } = bundle.__test
  assert.equal(clientVersion(), '0.0.0')
  globalThis.__DSH_BOOT__ = { release: { version: '0.2.1-rc.5' } }
  assert.equal(clientVersion(), '0.2.1-rc.5')
  delete globalThis.__DSH_BOOT__
  assert.equal(activeLocale({}), 'zh-CN')
  assert.equal(activeLocale({ getSnapshot: () => ({ active: 'en-US' }) }), 'en-US')
})

test('applies dictionaries and adds the balance pill to the composer dock', () => {
  const effects = []
  const registrations = []
  const injected = []
  const translations = {}
  const ctx = {
    effect(run, label) {
      effects.push(label)
      return run()
    },
    locale: {
      register(namespace, dictionaries) {
        translations[namespace] = dictionaries
      },
      bind: (namespace) => (key) => translations[namespace]?.zh?.[key] ?? key,
      subscribe: () => () => {}
    },
    slots: {
      inject(name, open) {
        injected.push(name)
        open()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      }
    },
    remote: { account: {} }
  }

  bundle.apply(ctx)

  assert.deepEqual(effects, ['deepseek-account-balance: dictionaries'])
  assert.deepEqual(injected, ['conversation.composer.dock'])
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].options.name, 'conversation.composer.dock')
  assert.equal(registrations[0].options.id, 'deepseek-balance')
  assert.equal(registrations[0].options.order, 2)
  assert.equal(typeof registrations[0].component, 'function')
  assert.ok(translations['deepseek-account-balance'].zh)
  assert.ok(translations['deepseek-account-balance'].en)
})
