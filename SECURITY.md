# Security Policy

## Supported versions

Only the latest version on `main` (and the live deployment at https://fuzzload.tanisheesh.in) receives security fixes.

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |
| Older releases | ❌ |

---

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report privately through either channel:

1. **GitHub:** go to the [Security tab → Report a vulnerability](../../security/advisories/new) (preferred)
2. **Email:** [hi@tanisheesh.in](mailto:hi@tanisheesh.in) with the subject `Security: FuzzLoad`

Please include:

- What the issue is and where it lives (URL, endpoint, file)
- Steps to reproduce, or a minimal proof of concept
- The impact you think it has
- Any suggested fix (optional)

---

## What to expect

| Step | Timeline |
|---|---|
| Acknowledgement of your report | within **72 hours** |
| Initial assessment and severity | within **7 days** |
| Fix released for confirmed issues | as soon as possible, based on severity |

You'll be kept updated throughout, and credited in the release notes once it's fixed (unless you'd rather stay anonymous).

---

## Scope

**In scope**

- This repository's source code (`proxy-go/`, `backend/`, `frontend/`)
- The live deployment at https://fuzzload.tanisheesh.in
- Reverse proxy forwarding headers, control-plane API input validation, and symbolic expression evaluation safety

**Out of scope**

- Vulnerabilities in third-party hosting providers (Vercel, AWS, Render, GitHub). Report those to the vendor.
- Denial-of-service, spam or volumetric attacks
- Social engineering
- Findings from automated scanners with no demonstrated impact

Please act in good faith: don't access or modify other users' data, and don't degrade the service while testing.

---

<div align="center">

<h3>Tanish Poddar</h3>

<a href="https://tanisheesh.in"><img src="https://img.shields.io/badge/Website-tanisheesh.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/tanisheesh"><img src="https://img.shields.io/badge/LinkedIn-tanisheesh-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/tanisheesh"><img src="https://img.shields.io/badge/GitHub-tanisheesh-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:hi@tanisheesh.in"><img src="https://img.shields.io/badge/Email-hi%40tanisheesh.in-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

<h3>Krish Gohel</h3>

<a href="https://github.com/krish-codess"><img src="https://img.shields.io/badge/GitHub-krish--codess-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:krishnakulgohel544@gmail.com"><img src="https://img.shields.io/badge/Email-krishnakulgohel544%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
