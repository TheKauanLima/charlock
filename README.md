# Cursed Concepts

**Live:** https://cursedconcepts.xyz

A community platform where *Deadlock* players design custom heroes (abilities, stats, backstory, art) and share them with others. I designed and built it solo, end to end.

<!-- Add a screenshot or GIF here: ![Cursed Concepts screenshot](docs/screenshot.png) -->

## Features
- **Hero creator:** ability editor with sub-stats, stat panels with variants, backstory module, custom colors, and export of hero cards as images
- **Accounts and profiles:** sign up or sign in with email or SSO, unique usernames, and public creator profiles
- **Social:** public hero pages, interactions, and reporting
- **Moderation:** role-protected admin tools to review reports and remove content
- **SEO:** dynamic metadata, sitemap and robots.txt, JSON-LD, and generated Open Graph images

## Tech stack
| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data | MongoDB with Mongoose |
| Auth | Clerk, with Svix-verified webhooks syncing users to MongoDB |
| Uploads and email | UploadThing, Resend |
| Validation | Zod |
| Testing | Vitest, Testing Library, jsdom (~60 test suites) |
| Hosting | Vercel |

## Engineering notes
- **Auth sync:** Clerk webhooks are verified with Svix signatures before user records are created or updated in MongoDB, so the database never trusts unsigned requests.
- **Security:** route guards in `proxy.ts`, ownership checks on profile and hero edits, admin-only moderation APIs, and dedicated security-hardening tests.
- **Testing:** tests cover API routes, auth redirects, moderation services, validation schemas, and UI components (see `__tests__/`).

## Running locally
```bash
npm install
# create .env.local with your MongoDB, Clerk, UploadThing, and Resend keys
npm run dev                  # http://localhost:3000
npm test
```
Admin access: set `ADMIN_USER_IDS` to a comma-separated list of Clerk user IDs.
