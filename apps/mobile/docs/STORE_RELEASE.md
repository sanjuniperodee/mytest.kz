# Store billing and release checklist

The iOS and Android store builds sell the same finite-access plans as the website. They use one-time consumable products, because every plan grants a fixed number of attempts or a fixed access period and must be purchasable again.

## Product contract

Create these four one-time products in both App Store Connect and Google Play Console. In App Store Connect use **Consumable**; in Play Console use **one-time product**.

| API plan | Product ID | Access |
| --- | --- | --- |
| `starter` | `com.sanjuniperodee.mobile.premium.trial` | 1 ENT attempt, 7 days |
| `basic` | `com.sanjuniperodee.mobile.premium.week` | 3 ENT attempts, 30 days |
| `pro` | `com.sanjuniperodee.mobile.premium.annual` | 5 ENT attempts, 30 days |
| `premium` | `com.sanjuniperodee.mobile.premium.month` | unlimited ENT attempts, 30 days |

The legacy-looking suffixes are retained because released App Store product identifiers cannot be renamed. Product display names and descriptions in the consoles must match the access column. Prices shown in the app come from StoreKit/Google Play, not from the KZT website price.

## API environment

Set these only in the production API environment; never commit their values.

```text
STORE_BILLING_ENABLED=true
APPLE_IAP_BUNDLE_ID=com.sanjuniperodee.mobile
APPLE_IAP_APP_APPLE_ID=<numeric App Store app id>
APPLE_IAP_ROOT_CA_BASE64=["<base64 DER Apple Root CA G3>"]
GOOGLE_PLAY_PACKAGE_NAME=com.sanjuniperodee.mobile
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

The Google service account must be linked in Play Console and have order/purchase verification access. `APPLE_IAP_ROOT_CA_BASE64` contains DER root certificates from Apple PKI, encoded as base64. The backend uses Apple's official App Store Server Library to verify the StoreKit 2 JWS certificate chain, environment, app identifier, bundle, product, transaction, revocation, and account token. Google purchases are checked with Android Publisher API, granted only in `PURCHASED` state, bound to the obfuscated account ID, and then consumed server-side.

## Review behavior

- iOS and Android builds show only their platform store for digital access. Kaspi remains on the website and is not linked or offered inside store builds.
- The app includes **Restore purchases**. Existing server entitlements also appear after normal sign-in.
- Supply App Review with a working account and note the path: `Login → More → Plans → select a plan`.
- Add all four products to the iOS app version before submitting it for review.
- Test iOS with Sandbox/TestFlight and Android with a license tester on an internal track. Test success, cancel, pending, interrupted/relaunch, duplicate callback, and repurchase after consumption.

## Commands

```bash
cd apps/mobile
npm run release:check
npx expo prebuild --platform ios --clean
npx expo prebuild --platform android --clean
npm run build:production
npm run submit:production
```

`eas submit` uploads binaries. Final screenshots, privacy/data-safety forms, product review attachment, reviewer notes, and the final App Review / Production rollout action are completed in App Store Connect and Play Console.
