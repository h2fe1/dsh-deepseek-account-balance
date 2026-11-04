/**
 * dsh-deepseek-account-balance — host half.
 *
 * The account service already exposes everything this plugin shows: the browser
 * half reads `account.getState`, `account.getBalance`, and `account.getProfile`
 * over the `account` Remote, and the Host derives the Platform request headers
 * from the caller's metadata. No host route is needed, so this half only keeps
 * the bundle loaded (a Loader row needs a host plugin to exist at all).
 */

export const name = 'dsh-deepseek-account-balance'

export function apply() {
  /* Nothing to mount: the browser half owns the `shell.bottom` status bar. */
}

export default { name, apply }
