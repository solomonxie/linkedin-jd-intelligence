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

## Permission justifications (Privacy practices tab)

- **storage**: stores your OpenAI API key, resume profiles, and analysis cache locally in this
  browser profile.
- **unlimitedStorage**: analysis history (IndexedDB) can grow past the default quota over many
  analyzed postings.
- **sidePanel**: the extension's UI is a Chrome side panel, shown alongside the LinkedIn tab you're
  viewing.
- **host_permissions: `https://www.linkedin.com/*`**: reads the currently open job posting's text
  (job description, company/role details) to analyze it — no other LinkedIn data is accessed.
- **host_permissions: `https://api.openai.com/*`**: sends the job posting and resume text to OpenAI's
  API, using your own API key, to generate the analysis.

## Data usage disclosure (Privacy practices tab)

- Personally identifiable information: resume content may contain PII (name, contact info, work
  history) — collected only into local browser storage, never transmitted to the developer, only sent
  to OpenAI's API (with the user's own key) to perform the requested analysis.
- Not sold to third parties. Not used for purposes unrelated to the extension's single purpose. Not
  used to determine creditworthiness or for lending purposes.
- Privacy policy URL: link to `PRIVACY.md` in this repository (raw GitHub URL or repo page).
