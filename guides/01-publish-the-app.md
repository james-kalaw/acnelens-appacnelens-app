# 1 · Publish the app (one-time, about 2 minutes)

The app lives in the `docs/` folder of this repository. GitHub Pages turns that folder into a free website.

1. Open the repository on GitHub: **acnelens/acnelens-appacnelens-app**.
2. Click **Settings** (top bar) → **Pages** (left menu).
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, pick **main** and the folder **/docs**, then click **Save**.
5. Wait 1–2 minutes and refresh the page. GitHub shows the address, which will be:

   **https://acnelens.github.io/acnelens-appacnelens-app/**

Open that link on a phone to use or install the app (see guide 2).

## Updating the app later
Any change pushed to `main` inside `docs/` goes live automatically within a minute or two.
Installed copies pick up the update the next time they are opened twice (the first launch downloads it, the second shows it).

## If something looks wrong
- **404 page:** Pages is still building, or the folder was not set to `/docs`. Re-check step 4.
- **"Couldn't load the AI":** the first launch must be online (it downloads ~35 MB once). After that it works offline.
