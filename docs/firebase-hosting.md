# Firebase Hosting for MySocial2

Firebase Hosting is configured for reviewed builds. This workflow creates **temporary staging previews only**; it does not deploy to the production live channel.

## Build and local validation

Production-target build (default; preserves the current production Firebase config):

```sh
npm install
npm test
npm run test:rules
npm run build:hosting
```

Staging-target build:

```sh
FIREBASE_TARGET=staging npm run build:hosting
```

The staging build substitutes the staging-only web config and Firebase Messaging service worker inside `dist/`. It does not modify the source production config or the production messaging service worker. The build publishes an explicit allowlist and excludes repository scripts, GitHub workflows, Firestore rules/indexes, Firebase Functions source, and Admin tooling.

## Enable temporary staging previews

In GitHub repository **Settings → Secrets and variables → Actions**:

1. Add repository variable `FIREBASE_STAGING_HOSTING_PREVIEW_ENABLED` with value `true`.
2. Add encrypted repository secret `FIREBASE_STAGING_HOSTING_SERVICE_ACCOUNT` containing a dedicated service-account JSON with Firebase Hosting deployment permission on project `mysocial2-staging`.
3. Keep this credential separate from production or Firestore deployment credentials. Never commit it or paste it into chat.

When enabled, the pull-request workflow runs JavaScript/configuration checks, Firestore Emulator tests, and both production and staging bundle builds before deploying a temporary preview to the staging project. Preview channels expire after 7 days. Without the variable, tests still run and deployment is skipped.

## Staging setup and safety

- Enable Email/Password Authentication in the staging project.
- Create the Firestore database in the staging project and deploy the reviewed Firestore rules/indexes to that project before testing.
- Use only test accounts and test data. Do not copy production user data into staging.
- Firebase preview URLs are public to anyone who has the URL. The preview app connects to the staging project's real Authentication/Firestore backend.
- Configure a staging-only VAPID key if push notifications are needed. The staging config intentionally leaves `vapidKey` empty until then.

## Production

The normal Hosting build continues to use the existing production Firebase configuration. There is intentionally no production deployment workflow or `channelId: live` action in this change. Production deployment requires a separate reviewed change and explicit authorization.
