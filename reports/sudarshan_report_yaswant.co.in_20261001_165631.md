# Sudarshan AI — Security Scan Report

| Field | Value |
|---|---|
| **Target** | `https://yaswant.co.in` |
| **Mode** | `url` |
| **Model** | `llama3.1` |
| **Generated** | 2026-10-01 16:56 UTC |
| **Status** | ⚠️ Findings are unverified until manually confirmed |

> **Authorization reminder:** This report was generated against
> `https://yaswant.co.in`. Ensure you have explicit written authorization to test
> this target before sharing or acting on any findings.


## Executive Summary

[OLLAMA ERROR] HTTP 404: 


## OWASP Top 10 (2021) Coverage

| ID | Category | Primary Tool(s) |
|---|---|---|
| A01 | Broken Access Control | ffuf |
| A02 | Cryptographic Failures | nuclei / testssl.sh (manual) |
| A03 | Injection (SQLi / XSS) | sqlmap, nuclei |
| A04 | Insecure Design | semgrep (codebase mode) |
| A05 | Security Misconfiguration | nuclei, ffuf |
| A06 | Vulnerable & Outdated Components | nuclei, pip-audit, npm audit |
| A07 | Authentication Failures | nuclei, manual |
| A08 | Software & Data Integrity Failures | gitleaks |
| A09 | Logging & Monitoring Failures | manual review |
| A10 | SSRF | nuclei |


## Detailed Findings by Tool


### Tool: `subfinder`

<details>
<summary>Raw output — subfinder</summary>

```
untilwemeet.yaswant.co.in
samadhan.yaswant.co.in
blog.yaswant.co.in
missyou.yaswant.co.in
resource.yaswant.co.in
saksham.yaswant.co.in
sudarshan.yaswant.co.in
tools.yaswant.co.in
www.yaswant.co.in
mine.yaswant.co.in
course.yaswant.co.in
gfg.yaswant.co.in
internship.yaswant.co.in
special.yaswant.co.in
birthday.yaswant.co.in
project.yaswant.co.in
cyclone.yaswant.co.in
image.yaswant.co.in
resume.yaswant.co.in
resourses.yaswant.co.in
surprise.yaswant.co.in
```
</details>

**AI Analysis (Sudarshan)**

[OLLAMA ERROR] HTTP 404: 

---


### Tool: `httpx`

<details>
<summary>Raw output — httpx</summary>

```
[NOT INSTALLED] httpx (ProjectDiscovery) — install from: go install github.com/projectdiscovery/httpx/cmd/httpx@latest
  (The Python 'httpx' CLI is present but is NOT the security scanner.)
```
</details>

**AI Analysis (Sudarshan)**

(skipped — tool not available: [NOT INSTALLED] httpx (ProjectDiscovery) — install from: go install github.com/projectdiscovery/httpx/cmd/httpx@latest
  (The Python 'httpx' CLI is present but is NOT the security scanner.))

---


### Tool: `katana`

<details>
<summary>Raw output — katana</summary>

```
https://yaswant.co.in
https://yaswant.co.in/assets/index-B9_W0_W3.js
https://yaswant.co.in/assets/vendor-icons-B8s5RBze.js
https://yaswant.co.in/assets/index-CuahPxnq.css
https://yaswant.co.in/assets/vendor-framework-CPQMGIC9.js
https://yaswant.co.in/assets/AuthModal-CDsoWnGC.js
https://yaswant.co.in/assets/ProjectsPage-CeF12TB-.js
https://yaswant.co.in/assets/BlogPage-n9hCbGIE.js
https://yaswant.co.in/assets/CertificateModal-B_oHYdU9.js
https://yaswant.co.in/assets/ToolsPage-Cs7F_FOE.js
https://yaswant.co.in/assets/NotesPage-Cms1DTjv.js
https://yaswant.co.in/api/courses.php
https://yaswant.co.in/assets/FreeResourcesPage-DNypxYCT.js
https://yaswant.co.in/assets/SearchModal-Q-jHwugW.js
https://yaswant.co.in/assets/StudentProfilePage-CUQ4AnPc.js
https://yaswant.co.in/assets/CommunityPage-PuzuM9XM.js
https://yaswant.co.in/assets/SettingsPage-BZcGa-3K.js
https://yaswant.co.in/assets/LearningPathsPage-BvBtMhq7.js
https://yaswant.co.in/api/blog.php
https://yaswant.co.in/api/tools.php
https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80
https://yaswant.co.in/api/admin.php
https://yaswant.co.in/api/certificates.php
https://yaswant.co.in/api/discussions.php
https://yaswant.co.in/assets/vendor-firebase-Bzr4BDFK.js
https://yaswant.co.in/api/newsletter.php
https://yaswant.co.in/api/contact.php
http://www.apache.org/licenses/LICENSE-2.0
https://yaswant.co.in/assets/Trident/
https://yaswant.co.in/v1/token
https://yaswant.co.in/v2/recaptchaConfig
https://yaswant.co.in/assets/opera/
https://yaswant.co.in/assets/opr/
https://yaswant.co.in/assets/opios/
https://yaswant.co.in/assets/trident/
https://yaswant.co.in/assets/edge/
https://yaswant.co.in/assets/silk/
https://yaswant.co.in/assets/chrome/
https://yaswant.co.in/assets/safari/
https://yaswant.co.in/assets/crios/
https://yaswant.co.in/v2/passwordPolicy
https://yaswant.co.in/assets/auth/
https://yaswant.co.in/v1/projects
https://apis.google.com/js/api.js
https://www.google.com/recaptcha/api.js
https://www.google.com/recaptcha/enterprise.js?render=
https://github.com/le0pard/re2js
https://yaswant.co.in/assets/gl-js/
https://firebaseinstallations.googleapis.com/v1
https://www.googletagmanager.com/gtag/js
http://www.apache.org/licenses/LICENSE-2.0
https://yaswant.co.in/assets/g
https://apis.google.com/js/api.js
https://www.google.com/recaptcha/api.js
https://www.google.com/recaptcha/enterprise.js?render=
https://github.com/le0pard/re2js
https://firebaseinstallations.googleapis.com/v1
https://firebase.googleapis.com/v1alpha/projects/-/apps/
https://www.googletagmanager.com/gtag/js
https://yaswant.co.in/api/health.php
https://yaswant.co.in/assets/CertificatePage-Dc3dfqSP.js
https://yaswant.co.in/assets/QuizPage-1hWPQjaN.js
https://yaswant.co.in/assets/AssignmentPage-CY28aKJ6.js
https://yaswant.co.in/assets/CourseLearningPage-iN2y9JyF.js
https://yaswant.co.in/api/notes.php
https://yaswant.co.in/assets/StudentDashboardPage-D_vcpERy.js
https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&auto=format&fit=crop&q=80
https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80
https://yaswant.co.in/assets/CourseDetailsPage-DxqTWJiz.js
https://yaswant.co.in/assets/AdminAuthGate-Bp52BlkW.js
https://yaswant.co.in/assets/CourseDiscoveryPage-B64Q5Tcc.js
https://yaswant.co.in/assets/AdminDashboardPage-CQalzJmX.js
https://yaswant.co.in/api/settings.php
https://yaswant.co.in/assets/firebaseAuth-B3_2A28u.js
https://yaswant.co.in/assets/mediaEmbed-GgOs-4OM.js
https://drive.google.com/embeddedfolderview?id=
https://drive.google.com/drive/folders/
https://docs.google.com/document/d/
https://docs.google.com/spreadsheets/d/
https://docs.google.com/presentation/d/
https://drive.google.com/file/d/
https://www.youtube-nocookie.com/embed/
https://player.vimeo.com/video/
https://yaswant.co.in/assets/BentoCard-CAh37xYR.js
https://yaswant.co.in/assets/vendor-framework-CPQMGIC9.js
https://yaswant.co.in/assets/index-B9_W0_W3.js
https://yaswant.co.in/assets/vendor-framework-CPQMGIC9.js
https://yaswant.co.in/assets/index-B9_W0_W3.js
https://yaswant.co.in/api/roadmaps.php
https://yaswant.co.in/api/auth.php
https://yaswant.co.in/api/notifications.php
```
</details>

**AI Analysis (Sudarshan)**

[OLLAMA ERROR] HTTP 404: 

---


### Tool: `nuclei`

<details>
<summary>Raw output — nuclei</summary>

```
[NOT INSTALLED] nuclei — see Section 4 of DOCUMENTATION.md
```
</details>

**AI Analysis (Sudarshan)**

(skipped — tool not available: [NOT INSTALLED] nuclei — see Section 4 of DOCUMENTATION.md)

---


### Tool: `ffuf`

<details>
<summary>Raw output — ffuf</summary>

```
admin                   [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 317ms]
openapi.json            [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 323ms]
swagger-ui              [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 320ms]
uploads                 [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 323ms]
sitemap.xml             [Status: 200, Size: 2566, Words: 318, Lines: 96, Duration: 320ms]
api/v1                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 317ms]
swagger                 [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 312ms]
.env                    [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 293ms]
api                     [Status: 301, Size: 795, Words: 60, Lines: 14, Duration: 320ms]
config                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 281ms]
backup                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 302ms]
debug                   [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 299ms]
health                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 299ms]
js                      [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 297ms]
actuator                [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 263ms]
.git                    [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 294ms]
metrics                 [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 264ms]
img                     [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 264ms]
login                   [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 267ms]
dashboard               [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 268ms]
css                     [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 297ms]
robots.txt              [Status: 200, Size: 1453, Words: 70, Lines: 53, Duration: 253ms]
console                 [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 259ms]
images                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 259ms]
api/v2                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 276ms]
wp-admin                [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 256ms]
phpmyadmin              [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 264ms]
docs                    [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 173ms]
files                   [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 259ms]
upload                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 184ms]
test                    [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 189ms]
static                  [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 198ms]
assets                  [Status: 301, Size: 795, Words: 60, Lines: 14, Duration: 180ms]
graphql                 [Status: 403, Size: 787, Words: 61, Lines: 14, Duration: 193ms]
```
</details>

**AI Analysis (Sudarshan)**

[OLLAMA ERROR] HTTP 404: 

---


### Tool: `sqlmap`

<details>
<summary>Raw output — sqlmap</summary>

```
Skipped (pass --enable-sqlmap to enable).
```
</details>

**AI Analysis (Sudarshan)**

[OLLAMA ERROR] HTTP 404: 

---


## Recommended Next Steps

1. **Manually verify** every finding marked Medium severity or above.
2. For confirmed findings, draft a bug bounty report:
   - Impact statement
   - Step-by-step reproduction
   - Proof-of-concept (screenshot / request-response)
   - Remediation recommendation
3. Work through remaining OWASP categories not yet covered by this scan.
4. Rerun with `--enable-sqlmap` only after confirming likely injection points
   and ensuring you are authorized to run intrusive tests.

---
_Report generated by Sudarshan AI. All findings must be manually verified before submission or disclosure._