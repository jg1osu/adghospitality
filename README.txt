ADG HOSPITALITY — CHARLESTON ELOPEMENT WEBSITE

A responsive, five-page website inspired by your supplied ADG brand image.
Package starting investments: Petite $3,500; Signature $5,000; Premier $7,500.
Maximum: 30 guests, excluding the couple, subject to location restrictions.
Owner contact: alisa@adghospitality.com.

START HERE
1. Open LAUNCH-GUIDE.html in a browser for the illustrated setup and research notes.
2. Use Node 22 or newer. No npm dependencies or installation are required.
3. Run npm run dev to preview at http://localhost:4173.
4. Run npm run build, npm run check and npm test to verify the Vercel version.
5. Run node scripts/build.mjs --hostgator for the PHP/static version in work/hostgator-dist.

CURRENT DRAFT STATE
Package inclusions are proposals for review, not approved operational commitments.
The photographs are generated illustrative images, not ADG client events or verified venues.
Email delivery is disabled by default: the form opens a prepared email to Alisa with a copy fallback.
No calendar URL has been provided: the consultation action collects a preferred call time.
Search indexing is disabled until launchReady is set true after approving the content.
Do not describe the site as live, automatic email delivery as verified, or appointments as bookable yet.

ACTIVATE
Configure a real booking URL, server mail configuration, inquiryEnabled and launchReady in site.config.mjs.
Never put mail credentials in site.config.mjs or public files. See .env.example and LAUNCH-GUIDE.html.
This website is for external Vercel or HostGator deployment; it has not been deployed to either provider.

CONTENTS
public/              Homepage, three local guides, FAQ, privacy notice, fonts and generated images.
public/app.js        Mobile menu, package dialogs, location tabs, inquiry, calendar link and FAQ assistant.
site.config.mjs      Public launch settings and contact information.
scripts/build.mjs    Generates static pages, metadata, schema, robots.txt and sitemap.xml.
api/inquiry.mjs      Vercel Node email endpoint using Resend.
hostgator/           PHP mail endpoint and private config example.
tests/               12 backend behavior checks, using mocked delivery only.
vercel.json          Vercel build and security-header settings.
output/              Source ZIP, HostGator ZIP, launch guide and preview images.

VERIFICATION
Five pages, links, structured data, package prices and assets checked.
Desktop and 390px mobile browser QA passed: no JS errors or horizontal overflow.
Verified navigation, package dialogs, location tabs, FAQ, guided chat, consultation fallback,
form validation, failure recovery and successful submission UI using mocked delivery.
All 12 backend behavior checks pass; no real email was sent.
PHP runtime/lint is unverified in this environment because PHP is not installed.
Live email delivery, provider scheduling, DNS and production deployment remain launch tests.

LICENSES
Local Cormorant Garamond and Inter fonts use the SIL Open Font License;
license files are in public/assets. Illustrative imagery generated for this project.
