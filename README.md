# MySocial2

A mobile-first Bengali/English community app built with HTML, CSS, JavaScript modules, Firebase Authentication and Cloud Firestore.

## Implemented in the repository
- Responsive social-network layout, Bengali/English toggle, dark theme and installable PWA shell
- Firebase email/password registration and login
- Public text feed with real-time updates
- Create and delete your own posts
- Like/unlike posts and add/read recent comments
- Report posts; trusted admins can review reports, resolve them, or remove reported posts
- Search member profiles, send/accept/decline friend requests
- Private text chat between accepted friends in the normal UI flow
- AI helper directory; all automated profiles are clearly labelled as AI

## Not implemented yet
- Stories, groups, image/video uploads, push notifications, full profile editing and a full notification center
- Automated bot conversations or autonomous AI posting
- Production-grade backend checks that verify a chat participant is an accepted friend. Do not treat client-side navigation as a security boundary.

## Firebase setup required before real users can use it
1. Open Firebase Console and select project `mysocial2-5c3c5`.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create/enable **Cloud Firestore**.
4. Deploy the repository's `firestore.rules` and `firestore.indexes.json` using Firebase CLI from a trusted computer:
   `firebase login`
   `firebase use mysocial2-5c3c5`
   `firebase deploy --only firestore:rules,firestore:indexes`
5. Set the admin user's Firebase Authentication custom claim to `admin: true` using a trusted Admin SDK environment. Never expose Admin SDK credentials in browser code or this public repository.

The Firebase Web config in `js/firebase-config.js` is browser configuration, not a service-account secret. Configure Firebase App Check and review the Firestore rules before opening the app to a wider audience.

## Checks
GitHub Actions runs `npm test` on pushes and pull requests. This checks JavaScript syntax and JSON configuration. It does **not** prove that Firebase services are configured, Firestore rules are deployed, or two real user accounts can complete live flows. Those require Firebase project access and live testing.

## Hosting
Enable GitHub Pages for the `main` branch and repository root:
https://mdmamunhossen69.github.io/MySocial2/

## Security checks
The validation workflow also runs Firestore Rules unit tests in the local emulator. The rules require a confirmed friendship document before private chats and messages are readable or writable. Friend requests use a deterministic pair ID; accepting a request and creating the friendship record happen in one batch.

### Assign the first administrator
Run the local helper only on a trusted computer with Firebase Admin SDK Application Default Credentials:
`GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json npm run set-admin -- FIREBASE_AUTH_UID`
The service-account file must stay outside the repository and must never be pasted into chat. After the claim is set, the administrator must sign out and sign back in. The script preserves any existing custom claims.
