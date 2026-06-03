/**
 * The authenticated principal attached to a request by JwtStrategy.
 * Lives in `common` (infra) so any feature module may depend on it without
 * importing the `auth` feature (enforced by the tsarch feature-isolation rule).
 */
export interface AuthUser {
  id: string
  isOpsAdmin: boolean
}
