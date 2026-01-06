export default {
  expo: {
    name: "LUDI Mobile",
    slug: "ludi-mobile",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#3b82f6"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ludi.mobile",
      usesAppleSignIn: true
    },
    android: {
      package: "com.ludi.mobile",
      adaptiveIcon: {
        backgroundColor: "#3b82f6"
      }
    },
    plugins: [
      "expo-apple-authentication"
    ],
    scheme: "ludi-mobile",
    extra: {
      eas: {
        projectId: "ludi-mobile"
      },
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ''
    }
  }
};
