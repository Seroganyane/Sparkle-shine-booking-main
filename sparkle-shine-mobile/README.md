# AquaLux Mobile - React Native + Expo

A mobile app for AquaLux car wash booking and product shop built with React Native and Expo. Shares the same Supabase backend as the web app.

## 📋 Prerequisites

- **Node.js** (v16+) and npm
- **Expo CLI**: `npm install -g expo-cli`
- **iOS**: Xcode + Simulator (macOS only)
- **Android**: Android Studio + Emulator (or physical device)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Supabase

Update `src/lib/supabase.ts` with your Supabase credentials:

```typescript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
```

### 3. Start Development Server

```bash
npm start
# or
expo start
```

This will open the Expo CLI menu. Press:
- **i** for iOS Simulator
- **a** for Android Emulator
- **w** for web preview
- **s** to switch to LAN (useful for physical devices)

## 📱 Features

### Authentication
- User signup and login
- Mock authentication (ready for Supabase Auth integration)
- Persistent session with AsyncStorage

### Dashboard
- View your bookings
- Track booking status
- View reward points and free washes
- Cancel bookings

### Shop
- Browse car wash products
- Add items to cart
- Checkout (demo payment flow)
- Cart management

### Profile
- View account information
- Track rewards and free washes
- App preferences
- Sign out

## 🔧 Project Structure

```
sparkle-shine-mobile/
├── App.tsx                    # Main app entry + navigation
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── src/
    ├── context/
    │   ├── AuthContext.tsx    # Auth state management
    │   └── CartContext.tsx    # Cart state management
    ├── screens/
    │   ├── LoginScreen.tsx    # Login/signup
    │   ├── SignupScreen.tsx
    │   ├── HomeScreen.tsx     # Main home screen
    │   ├── DashboardScreen.tsx # Bookings management
    │   ├── ShopScreen.tsx     # Product shopping
    │   └── ProfileScreen.tsx  # User profile
    └── lib/
        ├── supabase.ts        # Supabase client
        └── products.ts        # Product catalog
```

## 🔌 Integration Checklist

### Supabase Auth (TODO)
Currently using mock auth. To enable real Supabase Auth:

1. Update `src/context/AuthContext.tsx`:
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});
```

2. Set up auth redirects in `app.json`

### Database Queries (TODO)
Replace mock data with real Supabase queries:

```typescript
// Example: Fetch bookings
const { data: bookings } = await supabase
  .from('bookings')
  .select('*')
  .eq('user_id', user.id);
```

### Orders Table (TODO)
The web app has an `orders` migration. Ensure mobile creates orders the same way:

```typescript
await supabase.from('orders').insert([
  {
    user_id: user.id,
    items: cartItems,
    total_amount: total,
    status: 'paid'
  }
]);
```

## 📦 Building for Production

### iOS
```bash
expo build:ios
# Or use EAS (recommended):
eas build --platform ios
```

### Android
```bash
expo build:android
# Or:
eas build --platform android
```

## 🎨 Styling

The app uses React Native StyleSheet with a dark theme matching your web app:
- Primary color: `#0ea5e9` (cyan)
- Background: `#0f172a` (dark blue)
- Cards: `#1e293b` (slate)

## 🔗 Sharing Code with Web App

Shared utilities can be extracted to a monorepo structure:

```
sparkle-shine-monorepo/
├── web/              (current web app)
├── mobile/           (this app)
└── shared/
    ├── lib/
    │   ├── supabase.ts
    │   ├── products.ts
    │   └── types.ts
    └── hooks/
        └── useAuth.ts
```

## 🚨 Common Issues

### "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js
```

### Android emulator won't connect
```bash
# Reset Expo cache
expo start --clear
```

### iOS build fails on physical device
Ensure `app.json` bundleIdentifier is unique and provisioning profiles are set up.

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/reference/javascript/introduction)
- [React Native StyleSheet API](https://reactnative.dev/docs/stylesheet)

## 🤝 Next Steps

1. ✅ Integrate real Supabase Auth
2. ✅ Replace mock bookings with database queries
3. ✅ Add real payment processing (Stripe)
4. ✅ Implement image uploads for proof-of-wash
5. ✅ Add push notifications for booking status
6. ✅ Build shared libraries with web app (monorepo)

## 📝 License

Same as the web app (AquaLux)

---

**Ready to test?** Run `npm start` and press `a` for Android or `i` for iOS!
