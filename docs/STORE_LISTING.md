# Chrome Web Store listing draft

Reference copy for the Developer Dashboard listing form. Not used by the build — paste into the
dashboard fields when submitting.

## Title

LinkedIn JD Intelligence

## Short description (≤132 characters, shown in search results)

Analyzes LinkedIn job postings against your resume — skill match, company/role facts, interview
process. Your data stays local.

## Detailed description

**Privacy first: everything stays local to your browser.** Your resume and OpenAI API key are stored
only in this browser profile — never on any server this extension's developer runs. The only data
that ever leaves your browser is the job posting and resume text sent directly to OpenAI's API, using
your own API key, solely to generate the analysis you ask for. No accounts, no analytics, no tracking,
nothing sold or shared. Full details: see this extension's Privacy Policy link on this page.

---

LinkedIn JD Intelligence reads the job posting you're viewing on LinkedIn and compares it against your
resume, using your own OpenAI API key, to show you:

- A weighted skill/requirement match — what the posting asks for, what's required vs. preferred vs.
  implied, and whether your resume shows evidence for each one
- Company and role facts pulled from the posting (industry, size, funding stage, tech stack, salary
  range, and more where stated)
- The interview process, when the posting describes one
- A per-region estimate of how common a skill is among postings you've analyzed, to help gauge
  competition

Bring your own OpenAI API key (Settings page) and one or more resumes (PDF/DOCX), then open any
LinkedIn job posting and click Analyze.

Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.

## Category

Productivity

## Language

English (United States)

## Single purpose description (Privacy practices tab)

Analyzes the LinkedIn job posting you're currently viewing against your resume — skill match, a
company/role brief, and interview process — entirely within a Chrome side panel.

## Permission justifications (Privacy practices tab)

- **storage**: stores your OpenAI API key, resume profiles, and analysis cache locally in this
  browser profile.
- **unlimitedStorage**: analysis history (IndexedDB) can grow past the default quota over many
  analyzed postings.
- **sidePanel**: the extension's UI is a Chrome side panel, shown alongside the LinkedIn tab you're
  viewing.
- **Host permission** (`https://www.linkedin.com/*`, `https://api.openai.com/*`): `linkedin.com` is
  read-only access to the currently open job posting's text (job description, company/role details)
  so it can be analyzed — no other LinkedIn data is accessed. `api.openai.com` is used to send that
  job posting text and your resume text to OpenAI's API, authenticated with your own API key, to
  generate the analysis. No other host is ever contacted.
- **Remote code**: This item does not use remote code. Every script it runs ships inside the packaged
  extension, built at publish time — there is no `eval`, dynamic `import()` of a remote URL, or
  externally hosted script. The one third-party library that needs a worker script (`pdfjs-dist`, for
  parsing an uploaded PDF resume) has that worker bundled into the extension package itself, not
  loaded from a CDN. The only network calls this extension ever makes are `fetch` requests to
  `api.openai.com` to submit an analysis request and receive a JSON response — that response is
  displayed data, never executed as code.

## Data usage disclosure (Privacy practices tab)

- Personally identifiable information: resume content may contain PII (name, contact info, work
  history) — collected only into local browser storage, never transmitted to the developer, only sent
  to OpenAI's API (with the user's own key) to perform the requested analysis.
- Not sold to third parties. Not used for purposes unrelated to the extension's single purpose. Not
  used to determine creditworthiness or for lending purposes.
- Privacy policy URL: https://github.com/solomonxie/linkedin-jd-intelligence/blob/master/PRIVACY.md
