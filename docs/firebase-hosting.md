# Firebase Hosting for MySocial2

Firebase Hosting is configured as the intended primary production host, but this change adds **preview deployment only**. No workflow deploys to the live channel.

## Build and local validation

Run:

```sh
npm install
npm test
npm run test:rules
npm run build:hosting
```

The build creates `dist/` from an explicit allowlist: the app HTML, CSS, JavaScript modules, PWA manifest/service workers, and icon. It deliberately excludes repository scripts, GitHub workflows, Firestore rules/indexes, Firebase Functions source, and other root files.

## Enable temporary pull-request previews

In GitHub repository **Settings → Secrets and variables → Actions**:

1. Add repository variable `FIREBASE_HOSTING_PREVIEW_ENABLED` with value `true`.
2. Add encrypted repository secret `FIREBASE_HOSTING_SERVICE_ACCOUNT` containing a dedicated Firebase service-account JSON with Firebase Hosting deployment permission on project `mysocial2-5c3c5`.
3. Keep this credential separate from the Firestore deployment credential. Never commit it or paste it into chat.

When enabled, the pull-request workflow runs JavaScript/configuration checks, Firestore Emulator tests, and the allowlisted build before deploying a temporary preview channel. Preview channels expire after 7 days. Without the variable, tests still run and the preview deployment is skipped.

## Important preview privacy limitation

Firebase preview URLs are public to anyone who has the URL. The preview app continues to use the Firebase project configured in its client code, so it can communicate with the project's real Authentication and Firestore backend. Do not treat a preview channel as a staging backend. A separate Firebase staging project and staging web configuration are recommended before testing with real accounts or data.

## Production

There is intentionally no production deployment workflow or `channelId: live` action in this change. Production deployment must be added as a separate reviewed change and explicitly authorized before it is run.
