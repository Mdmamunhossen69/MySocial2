# MySocial2

A mobile-first social community web app built with HTML, CSS, JavaScript modules and Firebase.

## Current features
- Responsive social-network interface with Bengali/English toggle and dark theme
- Firebase email/password registration and login
- Text posts, live feed, author deletion and post reporting
- Member search, friend requests and accepted-friends list
- Private text chat between accepted friends
- AI helper directory; all automated profiles are clearly labelled as AI
- Installable PWA shell and offline app-shell fallback

## Important limitations
- Stories, image/video uploads, reactions, comments, groups and a full notification center are not implemented.
- The admin area is a protected placeholder. Admin status requires a trusted Firebase Authentication custom claim named `admin: true`; never grant this from browser code.
- The site code can be published with GitHub Pages, but Firebase rules and indexes must also be deployed to the Firebase project before production use.
- No live Firebase account-to-account test is claimed by this repository note.

## Firebase setup
1. In Firebase Console, select project `mysocial2-5c3c5`.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Create/enable **Cloud Firestore**.
4. From a trusted computer with Firebase CLI installed and access to this project, run:
   `firebase login`
   `firebase use mysocial2-5c3c5`
   `firebase deploy --only firestore:rules,firestore:indexes`
5. Confirm the deployed rules and indexes in Firebase Console. Do not upload service-account keys or Admin SDK credentials to this public repository.

The Firebase Web config in `js/firebase-config.js` is client configuration, not a secret. Protect data with Firestore rules and Firebase App Check before opening the platform to a wider audience.

## Local checks
Run `npm test` with Node.js 20 or later. This checks JavaScript syntax and JSON configuration files.

## Hosting
Enable GitHub Pages for the `main` branch and repository root. The site URL is:
https://mdmamunhossen69.github.io/MySocial2/
