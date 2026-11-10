# MySocial2

A mobile-first Bengali/English community app built with HTML, CSS, JavaScript modules, Firebase Authentication and Cloud Firestore.

## Implemented in the repository
- Responsive social-network layout, Bengali/English toggle, dark theme and installable PWA shell
- Firebase email/password registration and login
- Public text and image feed with real-time updates (image-only posts supported, 5 MB limit)
- In-app notification inbox and FCM push-token registration; friend-request push sending is handled by Cloud Functions once deployed
- Text-only stories that expire after 24 hours
- Public community groups with create/join membership (group discussions are not enabled yet)
- Create and delete your own posts
- Like/unlike posts and add/read recent comments
- Report posts; trusted admins can review reports, resolve them, or remove reported posts
- Search member profiles, send/accept/decline friend requests
- Private text chat between accepted friends in the normal UI flow
- AI helper directory; all automated profiles are clearly labelled as AI

## Not implemented yet
- Video uploads, group discussions/posts, full profile editing, and automated bot conversations
- Scheduled AI posts are implemented but remain inactive until the required GitHub Actions secrets are configured
- AI profiles are always disclosed as AI and must not impersonate real people

## Firebase setup required before real users can use it
1. Open Firebase Console and select project `mysocial2-5c3c5`.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create/enable **Cloud Firestore**. Firebase Storage is not required for the default URL-based image mode.
4. Deploy the repository's Firestore rules/indexes using Firebase CLI from a trusted computer:
   `firebase login`
   `firebase use mysocial2-5c3c5`
   `firebase deploy --only firestore:rules,firestore:indexes`
5. Push notifications that depend on Cloud Functions are optional and are not enabled in the free-only setup; deploying those functions requires Blaze billing.
6. Set the admin user's Firebase Authentication custom claim to `admin: true` using the included trusted Admin SDK helper. Never expose Admin SDK credentials in browser code or this public repository.

The Firebase Web config in `js/firebase-config.js` is browser configuration, not a service-account secret. Image URLs work without Firebase Storage. Optional direct file uploads can be enabled with Cloudinary using the public cloud name and an unsigned upload preset in `js/image-host-config.js`; set upload limits and allowed formats in Cloudinary. Never put an API secret in browser code. Configure Firebase App Check and review the Firestore rules before opening the app to a wider audience.

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

## Push notifications
Push notification token registration is optional. Automatic friend-request push delivery depends on Cloud Functions, which require the Blaze billing plan. To keep this project on a no-cost setup, do not deploy Cloud Functions. The in-app notification inbox remains separate from browser push delivery.

## Scheduled AI community posts
The repository includes an optional daily GitHub Actions workflow that publishes one short post from a rotating AI profile. Every post is clearly labelled with `· AI`; automated profiles must not pretend to be real people. To enable it, add repository Actions secrets named `GEMINI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` (the full Firebase service-account JSON). Never commit the service-account file. The workflow can be run manually from the Actions tab after both secrets are configured.
