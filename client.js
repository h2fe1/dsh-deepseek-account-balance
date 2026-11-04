/**
 * dsh-deepseek-account-balance — browser half.
 *
 * A small "余额 ¥x.xx" pill in the composer dock, immediately to the right of
 * the conversation's context meter. The Host account service already projects
 * the display-safe recharge and bonus wallets over the `account` Remote, so
 * this half only reads `account.getState` and `account.getBalance`; no token
 * ever reaches the page and no Host route is needed.
 */

window.__ModuleLoader__.load({
  id: 'dsh-deepseek-account-balance',
  factory(require) {
    const React = require('react')

    const NS = 'deepseek-account-balance'
    const SLOT = 'conversation.composer.dock'
    const POLL_INTERVAL_MS = 60_000

    const TERTIARY = 'var(--dsw-alias-label-tertiary, #8b949e)'
    const DANGER = 'var(--dsw-alias-state-error-primary, #e5534b)'
    const HOVER = 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.12))'

    const zh = {
      balance: '余额',
      bonus: '赠送',
      loading: '…',
      failed: '读取失败',
      signedOut: '未登录',
      updated: '更新于 {time}',
      clickToRefresh: '点击刷新',
      signInHint: '未登录 DeepSeek 账号，去「设置 → 账号」登录',
      refresh: '刷新 DeepSeek 账号余额'
    }

    const en = {
      balance: 'Balance',
      bonus: 'Bonus',
      loading: '…',
      failed: 'Unavailable',
      signedOut: 'Not signed in',
      updated: 'Updated {time}',
      clickToRefresh: 'Click to refresh',
      signInHint: 'Not signed in. Sign in from Settings → Account',
      refresh: 'Refresh DeepSeek account balance'
    }

    const h = (tag, props, ...children) => React.createElement(tag, props, ...children)

    /** Read the active UI language from the locale face, tolerating older shapes. */
    function activeLocale(locale) {
      try {
        const snapshot = locale?.getSnapshot?.()
        if (typeof snapshot?.active === 'string' && snapshot.active) return snapshot.active
        const legacy = locale?.getLocale?.()
        if (typeof legacy?.active === 'string' && legacy.active) return legacy.active
      } catch {
        /* fall through to the default */
      }
      return 'zh-CN'
    }

    /** The Host release identity the boot payload carries; used for the account client header. */
    function clientVersion() {
      try {
        const version = globalThis.__DSH_BOOT__?.release?.version
        if (typeof version === 'string' && version) return version
      } catch {
        /* keep the fallback */
      }
      return '0.0.0'
    }

    const currencySymbol = (currency) => (currency === 'USD' ? '$' : '¥')

    /**
     * Platform-style two-decimal display: amounts under one cent read as `<¥0.01`
     * so a tiny remaining balance never looks like zero.
     */
    function formatAmount(raw, currency) {
      const symbol = currencySymbol(currency)
      const value = Number(raw)
      if (!Number.isFinite(value)) return `${symbol}${String(raw ?? '')}`
      const absolute = Math.abs(value)
      if (absolute === 0) return `${symbol}0.00`
      if (absolute < 0.01) return value < 0 ? `-${symbol}0.01` : `<${symbol}0.01`
      const digits = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(absolute)
      return `${value < 0 ? '-' : ''}${symbol}${digits}`
    }

    function formatWallets(wallets) {
      if (!Array.isArray(wallets) || wallets.length === 0) return ''
      return wallets.map((wallet) => formatAmount(wallet?.balance, wallet?.currency)).join(' + ')
    }

    const hasPositive = (wallet) => Number(wallet?.balance) > 0

    function timeText(timestamp, locale) {
      try {
        return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      } catch {
        return ''
      }
    }

    /** Re-render the pill when the UI language or any other locale snapshot changes. */
    function useLocaleRevision(locale) {
      const [, bump] = React.useReducer((value) => value + 1, 0)
      React.useEffect(() => {
        let dispose
        try {
          dispose = locale?.subscribe?.(() => bump())
        } catch {
          dispose = undefined
        }
        return () => {
          try {
            dispose?.()
          } catch {
            /* ignore a disposer from an older locale face */
          }
        }
      }, [locale])
    }

    const INITIAL = {
      phase: 'loading',
      busy: true,
      signedIn: false,
      wallets: null,
      bonusWallets: null,
      error: null,
      updatedAt: null
    }

    /**
     * Read account state and balance together. A failed refresh keeps the last
     * good amount visible and marks it stale; a signed-out account drops it,
     * because it belongs to a credential that is gone.
     */
    function useBalance(ctx, t) {
      const [snap, setSnap] = React.useState(INITIAL)
      const generation = React.useRef(0)
      const inFlight = React.useRef(false)
      const alive = React.useRef(true)

      const load = React.useCallback(async () => {
        if (inFlight.current || !alive.current) return
        inFlight.current = true
        const current = ++generation.current
        setSnap((previous) => (previous.phase === 'loading' ? previous : { ...previous, busy: true }))
        try {
          const client = {
            version: clientVersion(),
            locale: activeLocale(ctx.locale),
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
          }
          const [state, balance] = await Promise.all([
            ctx.remote.account.getState(),
            ctx.remote.account.getBalance(client)
          ])
          if (!alive.current || current !== generation.current) return
          if (!state?.ok) throw state?.error ?? new Error('account state unavailable')

          if (state.value?.status !== 'credential-stored') {
            setSnap({ ...INITIAL, phase: 'signed-out', busy: false, updatedAt: Date.now() })
            return
          }

          if (!balance?.ok) throw balance?.error ?? new Error('balance unavailable')
          const value = balance.value
          if (value === null) {
            setSnap((previous) => ({
              ...previous,
              phase: 'signed-out',
              busy: false,
              signedIn: false,
              wallets: null,
              bonusWallets: null,
              error: null
            }))
            return
          }
          if (value.status !== 'ready') {
            setSnap((previous) => ({
              ...previous,
              phase: 'error',
              busy: false,
              signedIn: true,
              error: t('failed')
            }))
            return
          }

          setSnap({
            phase: 'ready',
            busy: false,
            signedIn: true,
            wallets: Array.isArray(value.value) ? value.value : [],
            bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
            error: null,
            updatedAt: Date.now()
          })
        } catch (error) {
          if (!alive.current || current !== generation.current) return
          setSnap((previous) => ({
            ...previous,
            phase: 'error',
            busy: false,
            error: String(error?.message ?? error)
          }))
        } finally {
          inFlight.current = false
        }
      }, [ctx, t])

      React.useEffect(() => {
        alive.current = true
        void load()
        const interval = window.setInterval(() => {
          if (!document.hidden) void load()
        }, POLL_INTERVAL_MS)
        const onVisibility = () => {
          if (!document.hidden) void load()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          alive.current = false
          window.clearInterval(interval)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [load])

      return [snap, load]
    }

    /**
     * Mount the plugin: register dictionaries, then add the balance pill to the
     * composer dock with `order: 1`, which places it after the context meter in
     * the dock's flex row.
     * @param ctx - client plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'deepseek-account-balance: dictionaries')
      const t = ctx.locale.bind(NS)

      function BalancePill() {
        useLocaleRevision(ctx.locale)
        const [snap, load] = useBalance(ctx, t)
        const locale = activeLocale(ctx.locale)

        const amount = formatWallets(snap.wallets)
        const bonus = formatWallets((snap.bonusWallets ?? []).filter(hasPositive))
        const failed = snap.phase === 'error'

        let reading = ''
        if (snap.phase === 'loading') reading = t('loading')
        else if (snap.phase === 'signed-out') reading = '—'
        else if (amount) reading = amount
        else reading = t('failed')

        const details = []
        if (failed) {
          details.push(snap.error || t('failed'))
        } else if (snap.phase === 'signed-out') {
          details.push(t('signInHint'))
        } else {
          if (amount) details.push(`${t('balance')} ${amount}`)
          if (bonus) details.push(`${t('bonus')} ${bonus}`)
          if (snap.updatedAt) details.push(t('updated', { time: timeText(snap.updatedAt, locale) }))
          details.push(t('clickToRefresh'))
        }
        const title = details.join('\n')

        return h(
          'button',
          {
            type: 'button',
            title,
            'aria-label': `${t('refresh')}${reading ? `：${reading}` : ''}`,
            onClick: () => void load(),
            onMouseEnter: (event) => {
              event.currentTarget.style.background = HOVER
            },
            onMouseLeave: (event) => {
              event.currentTarget.style.background = 'transparent'
            },
            style: {
              order: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '22px',
              boxSizing: 'border-box',
              padding: '1px 8px',
              border: 'none',
              borderRadius: 'var(--dsw-radius-sm, 6px)',
              background: 'transparent',
              color: TERTIARY,
              fontFamily: 'inherit',
              fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
              lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary, 0px))',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              cursor: snap.busy ? 'default' : 'pointer',
              opacity: snap.busy ? 0.6 : 1,
              transition: 'background 120ms ease, opacity 120ms ease'
            }
          },
          h('span', { key: 'label' }, t('balance')),
          h('span', { key: 'amount', style: failed ? { color: DANGER } : undefined }, reading)
        )
      }

      ctx.slots.inject(SLOT, () =>
        ctx.slots.register(
          { name: SLOT, id: 'deepseek-balance', order: 2, locale: NS },
          BalancePill
        )
      )
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.account'],
      apply,
      __test: { formatAmount, formatWallets, clientVersion, activeLocale }
    }
  }
})
