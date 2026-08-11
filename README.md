# Sparkle Shine Car Wash Booking System

A modern car wash booking application built with React, TypeScript, and Supabase.

## Features

- Customer booking system with multiple service packages
- Real-time queue management for admins
- Payment processing integration
- Customer notification system
- Reward points and free washes
- Admin dashboard for managing operations

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Build Tool**: Vite
- **Deployment**: Ready for Vercel/Netlify

## Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── integrations/       # External service integrations
└── types/              # TypeScript type definitions
```

## Environment Variables

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
VITE_SITE_URL=https://your-public-domain.com
```

`VITE_SITE_URL` is the public URL used by email-confirmation and password-reset
links. Do not set it to `localhost` in a deployed environment. In Supabase,
also add this URL (and `https://your-public-domain.com/**`) under **Authentication
→ URL Configuration → Redirect URLs**, and set **Site URL** to the same domain.
