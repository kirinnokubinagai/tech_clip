# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (main) | Yes |

## Reporting a Vulnerability

**Do NOT create a public GitHub Issue for security vulnerabilities.**

### Reporting Process

1. Use [GitHub Security Advisories](https://github.com/kirinnokubinagai/tech_clip/security/advisories/new) to privately report the vulnerability
2. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Stage | Target |
|-------|--------|
| Initial acknowledgment | 48 hours |
| Triage and assessment | 5 business days |
| Fix release (critical) | 48 hours |
| Fix release (other) | 14 business days |

### Severity Levels

| Level | Description | Response |
|-------|-------------|----------|
| Critical | Authentication bypass, RCE, data breach | Fix within 48 hours |
| High | SQLi, XSS, privilege escalation | Fix within 7 days |
| Medium | CSRF, information disclosure | Fix within 14 days |
| Low | Best practice violations | Next release cycle |

## Security Measures

### Authentication and Authorization

- Better Auth for session management
- HTTPOnly, Secure, SameSite=Strict cookies
- Role-based access control (RBAC)

### Data Protection

- All passwords hashed with bcrypt (cost 12+)
- Sensitive data stored in environment variables only
- No secrets committed to source control
- `.env` files excluded via `.gitignore`

### Input Validation

- All user input validated with Zod schemas
- Drizzle ORM for parameterized queries (SQL injection prevention)
- React auto-escaping for XSS prevention

### Infrastructure

- HTTPS enforced in production
- CORS restricted to allowed origins
- Rate limiting on all API endpoints
- Stricter rate limiting on authentication endpoints
- Security headers via middleware

### CI/CD Security

- Dependency vulnerability scanning (`pnpm audit`)
- Pre-commit hooks for secret detection (`secret-guard.sh`)
- Dependency audit runs on every PR / push via `ci.yml`

## Development Security Practices

- See `.claude/rules/security.md` for detailed coding standards
- All PRs require code review before merge
- TDD workflow ensures security-related tests exist
- No `any` types allowed (prevents type confusion attacks)

## Contact

For security-related inquiries, use [GitHub Security Advisories](https://github.com/kirinnokubinagai/tech_clip/security/advisories/new).
