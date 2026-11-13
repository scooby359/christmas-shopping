import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { HttpError } from './validate'

/*
 * Cloudflare Access sends a signed JWT with every request it lets through
 * (header: Cf-Access-Jwt-Assertion). We verify its signature against the team's
 * public keys and check it was issued by OUR team for OUR Access application (AUD),
 * so a token minted for any other app or team is rejected.
 *
 * Docs: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */

export interface AccessConfig {
  /** Team domain, e.g. "myteam", "myteam.cloudflareaccess.com" or "https://myteam.cloudflareaccess.com" */
  teamDomain: string
  /** The Access application's Audience (AUD) tag */
  aud: string
}

export function issuerFor(teamDomain: string): string {
  let host = teamDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!host.includes('.')) host += '.cloudflareaccess.com'
  return `https://${host}`
}

const keySets = new Map<string, JWTVerifyGetKey>()
let keySetOverride: JWTVerifyGetKey | undefined

/** Tests only: verify against local keys instead of fetching the team's certs. */
export function setKeySetForTests(keys: JWTVerifyGetKey | undefined) {
  keySetOverride = keys
}

function keySetFor(issuer: string): JWTVerifyGetKey {
  if (keySetOverride) return keySetOverride
  let ks = keySets.get(issuer)
  if (!ks) {
    // jose caches the fetched keys and re-fetches when Cloudflare rotates them.
    ks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    keySets.set(issuer, ks)
  }
  return ks
}

/** Verify an Access JWT and return the signed-in email (lower-cased). Throws 401 if invalid. */
export async function emailFromAccessJwt(token: string, cfg: AccessConfig): Promise<string> {
  const issuer = issuerFor(cfg.teamDomain)
  let payload
  try {
    ;({ payload } = await jwtVerify(token, keySetFor(issuer), {
      issuer,
      audience: cfg.aud.trim(),
      algorithms: ['RS256'],
    }))
  } catch (e) {
    const reason =
      e instanceof errors.JWTExpired
        ? 'token expired'
        : e instanceof errors.JWTClaimValidationFailed
          ? `token ${e.claim} does not match this app's configuration`
          : e instanceof errors.JWSSignatureVerificationFailed || e instanceof errors.JWKSNoMatchingKey
            ? 'token signature is not valid'
            : 'token could not be verified'
    console.warn('auth 401: Access JWT rejected:', reason, e instanceof Error ? e.message : e)
    throw new HttpError(401, `Sign-in required: ${reason}`)
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!email) throw new HttpError(401, 'Sign-in required: Access token has no email')
  return email
}
