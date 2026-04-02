---
name: revenuecat-expo-subscriptions
description: RevenueCat subscription management for Expo apps. Use when implementing in-app purchases, checking subscription status, handling user authentication, or managing subscription lifecycle in Expo React Native projects with RevenueCat.
---

# RevenueCat Expo Subscriptions

RevenueCat subscription management for Expo React Native applications.

## When to Apply

- Setting up in-app purchases in Expo apps
- Implementing subscription paywalls and offerings
- Checking user subscription status and entitlements
- Handling purchase flows and user authentication

## Critical Rules

**Platform-specific API Keys**: Configure with correct keys per platform

```javascript
// WRONG - single key for all platforms
await Purchases.configure({apiKey: "generic_key"});

// RIGHT - platform-specific keys
if (Platform.OS === 'ios') {
  await Purchases.configure({apiKey: "public_ios_sdk_key"});
} else if (Platform.OS === 'android') {
  await Purchases.configure({apiKey: "public_google_sdk_key"});
}
```

**Check Entitlements, Not Product IDs**: Use entitlements for access control

```javascript
// WRONG - checking product IDs
if (customerInfo.activeSubscriptions.includes("monthly_sub")) {
  // Grant access
}

// RIGHT - checking entitlements
if (customerInfo.entitlements.active["premium"]?.isActive) {
  // Grant access
}
```

## Key Patterns

### Initial Setup

```bash
npx expo install react-native-purchases react-native-purchases-ui
npx expo install expo-dev-client
```

### SDK Initialization

このプロジェクトでは `src/lib/revenueCat.ts` で初期化関数を定義し、`_layout.tsx` から呼び出す方式を採用しています。
useEffect 内で直接 configure を呼ぶのではなく、初期化関数を分離してください。

```typescript
// src/lib/revenueCat.ts
import Purchases from "react-native-purchases";
import { Platform } from "react-native";

/** RevenueCat API キー */
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

/**
 * RevenueCat SDK を初期化する
 */
export async function configureRevenueCat(): Promise<void> {
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  const apiKey = Platform.OS === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) return;
  await Purchases.configure({ apiKey });
}
```

### Fetch Offerings

```javascript
try {
  const offerings = await Purchases.getOfferings();
  if (offerings.current?.availablePackages.length > 0) {
    // Display subscription packages
    const packages = offerings.current.availablePackages;
  }
} catch (error) {
  console.error('Failed to fetch offerings:', error);
}
```

### Purchase Subscription

```javascript
try {
  const result = await Purchases.purchasePackage(package);
  if (result.customerInfo.entitlements.active["premium"]?.isActive) {
    // User now has premium access
  }
} catch (error) {
  if (error.userCancelled) {
    // User cancelled - don't show error
  } else {
    console.error('Purchase failed:', error);
  }
}
```

### Check Subscription Status

```javascript
try {
  const customerInfo = await Purchases.getCustomerInfo();
  const hasPremium = customerInfo.entitlements.active["premium"]?.isActive;
  
  if (hasPremium) {
    // Show premium content
  } else {
    // Show paywall or limited content
  }
} catch (error) {
  // Handle error
}
```

### User Authentication

```javascript
// Login with user ID
await Purchases.logIn(userId);

// Anonymous usage (default)
// SDK automatically generates anonymous ID
```

### Restore Purchases

```javascript
try {
  const customerInfo = await Purchases.restorePurchases();
  if (customerInfo.entitlements.active["premium"]?.isActive) {
    // Subscription restored
  }
} catch (error) {
  console.error('Restore failed:', error);
}
```

## Common Mistakes

- **Missing BILLING permission**: Add `<uses-permission android:name="com.android.vending.BILLING" />` to AndroidManifest.xml
- **Using product IDs instead of entitlements**: Always check `entitlements.active` for access control
- **Not handling user cancellation**: Check `error.userCancelled` to avoid showing error messages for cancelled purchases
- **Hardcoding API keys**: Use environment variables and platform detection for API key management