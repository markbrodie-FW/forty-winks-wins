# Forty Winks Wins

A lightweight digital office wins board hosted as static HTML/CSS/JS and backed by Supabase.

## Pages

- `index.html` — office display / celebration mode
- `submit.html` — public staff submission page
- `admin.html` — authenticated admin page

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run the full contents of `supabase-schema.sql`.
4. Open **Authentication → Users** and create at least one admin user with email/password.
5. The app's public Project URL and Publishable Key live in `config.js`.
6. Never add a Supabase secret/service-role key to this project or GitHub.

### Security model

- Anonymous visitors can read active wins.
- Anonymous visitors can submit wins.
- Anonymous visitors cannot edit, hide, delete or read hidden wins.
- Authenticated Supabase users can manage all wins via `admin.html`.

## GitHub Pages

Upload all files at the repository root, then enable:

**Settings → Pages → Deploy from a branch → main → /(root)**

The site will then be available at a GitHub Pages URL such as:

`https://USERNAME.github.io/forty-winks-wins/`

## Font

`FWObviouslyNarrow-Bold.woff2` is used for the main wins title and Celebration Mode win statement. Confirm the font licence permits public web hosting before placing this file in a public GitHub repository.
