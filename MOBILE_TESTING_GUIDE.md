# LUDI Mobile App Testing Guide

## Quick Setup for Expo Go Testing

Since you have Expo Go installed on your iPhone, here's the simplest way to test the app:

### Step 1: Set up the Environment
The mobile app needs to connect to your backend server. I've already configured:
- ✅ Environment variables (`.env` file created)
- ✅ App configuration (`app.json` created) 
- ✅ Metro bundler config
- ✅ Babel config

### Step 2: Install Dependencies
In your terminal, run these commands:

```bash
cd mobile
npm install --legacy-peer-deps
```

If you get dependency conflicts, try:
```bash
npm install expo@~51.0.0 --legacy-peer-deps
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack --legacy-peer-deps
npm install @stripe/stripe-react-native expo-secure-store --legacy-peer-deps
```

### Step 3: Configure Your API Connection
Edit the `mobile/.env` file and update:
```
EXPO_PUBLIC_API_URL=http://your-replit-url.replit.app
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
```

### Step 4: Start the Development Server
```bash
cd mobile
npx expo start --tunnel
```

### Step 5: Test on iPhone
1. Open Expo Go app on your iPhone
2. Scan the QR code that appears in your terminal
3. The app should load and connect to your backend

## Features You Can Test

✅ **Authentication**: Login with your Replit account
✅ **Teams**: Create and manage teams
✅ **Events**: Create events and manage attendance  
✅ **Notifications**: Real-time notifications
✅ **Search**: Find events with flare search
✅ **Payments**: Stripe payment integration (test mode)

## Troubleshooting

**Connection Issues**: 
- Make sure your phone and computer are on the same network
- If using localhost, switch to tunnel mode: `npx expo start --tunnel`

**Authentication Issues**:
- The mobile app uses JWT tokens (different from web session auth)
- Check that your backend server is running on port 5000

**Stripe Issues**:
- Use test mode keys from your Stripe dashboard
- Test with card number: 4242 4242 4242 4242

## Next Steps

Once testing works well:
1. **Development Build**: Create a development build for more native features
2. **TestFlight**: Deploy to TestFlight for production-like testing
3. **Production**: Configure production API URLs and Stripe keys

The mobile app has full feature parity with the web version and uses native mobile UI components for the best user experience!