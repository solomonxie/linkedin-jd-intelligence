# Privacy Policy — LinkedIn JD Intelligence

Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.

## Summary

Everything this extension stores lives only in your own browser profile. Nothing is sent to any
server operated by this extension's developer. The only place any data leaves your browser is a
direct call from your browser to OpenAI's API, using an API key you provide, solely to generate the
job analysis you ask for.

## What's collected and where it's stored

| Data | Stored where | Purpose |
|---|---|---|
| Your OpenAI API key | `chrome.storage.local` (this browser profile) | Authenticates requests to OpenAI on your behalf |
| Resume file content (parsed to text) | `chrome.storage.local` | Compared against a job posting to produce the match analysis |
| LinkedIn job posting text you analyze | IndexedDB (this browser profile) | Cached so re-opening a job doesn't require re-analyzing it |
| Analysis results (skill match, company/role notes, interview rounds) | IndexedDB (this browser profile) | Displayed back to you; exportable/deletable at any time |

None of this is encrypted beyond the normal sandboxing Chrome already applies to a browser profile's
local storage. None of it is transmitted to, or readable by, this extension's developer — there is no
backend server this extension talks to.

## What's sent externally, and to whom

When you click "Analyze," the job posting text and your resume text are sent directly from your
browser to OpenAI's Chat Completions API (`api.openai.com`), authenticated with your own API key, so
OpenAI's model can generate the analysis. That request is subject to
[OpenAI's own privacy policy](https://openai.com/policies/privacy-policy) for however OpenAI handles
API traffic. This extension has no other third-party integration, no analytics, and no tracking of
any kind — the only network calls it ever makes are to `api.openai.com`.

## No selling, no sharing, no accounts

This extension doesn't have user accounts, doesn't sell or share your data with anyone, and doesn't
run any analytics or advertising code.

## Your controls

- Delete individual resume profiles or your entire analysis history from the extension's Settings
  page at any time.
- Clear your OpenAI API key from Settings at any time.
- Uninstalling the extension removes all of its locally stored data (Chrome's normal behavior for
  `chrome.storage.local` and IndexedDB data belonging to a removed extension).

## Contact

Questions or issues: <https://github.com/solomonxie/linkedin-jd-intelligence/issues>
