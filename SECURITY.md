# Security Policy

## Supported versions

Security fixes are backported to the latest minor line only.

| Version | Supported |
|---|---|
| `0.4.x` | yes (latest) |
| `0.3.x` | critical security fixes for 90 days after 0.4.0 ships |
| `< 0.3` | no |

"Critical" means RCE, credential disclosure, or supply-chain compromise. Non-security bugs on 0.3.x are only fixed by upgrading to 0.4.x.

## Reporting a vulnerability

**Do not file a public GitHub issue** for anything that could be exploited.

Report privately via GitHub's [private security advisories](../../security/advisories/new) (absolute URL: `https://github.com/jynxbt/PolyQ/security/advisories/new` — update if you fork). Include:

- Affected version(s)
- A minimal reproduction — config, commands, and the behaviour you observed
- Your assessment of the impact (information disclosure, arbitrary code execution, supply-chain, etc.)

We aim to acknowledge within 72 hours and ship a patch within 14 days for high-impact issues.

## Threat model

Polyq is a local-development toolkit:

- **`polyq.config.ts` is executed as TypeScript at load time** via [jiti](https://github.com/unjs/jiti). Only run Polyq in projects you trust; a malicious config file can execute arbitrary code on your machine.
- **The workspace orchestrator spawns shell commands** (`docker`, `psql`, `anchor`, `forge`, validators). Database URLs are passed as environment variables, not interpolated into shell strings. Extension and database names are sanitised to prevent SQL/command injection.
- **Polyq does not authenticate to remote networks.** It never sends wallet keys or program binaries to devnet/mainnet; all network calls are to the local validator/node.
- **Published tarballs are attested.** Every release goes through `npm publish --provenance` on GitHub Actions with OIDC; consumers can verify via `npm view polyq`.

Supply-chain guarantees above the above are the responsibility of the consumer (their npm registry, their CI, their machine).
