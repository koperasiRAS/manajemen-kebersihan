# Deployment Guide (Vercel)

## Prerequisites

- GitHub repository with the project code
- Vercel account at [vercel.com](https://vercel.com)
- Supabase project fully set up (see `SETUP.md`)

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Clean Office Discipline System"
git remote add origin https://github.com/YOUR_USERNAME/clean-office-discipline.git
git push -u origin main
```

## Step 2: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Add environment variables:

| Variable                        | Value                              |
| ------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key             |
| `NOTIFICATION_PROVIDER`         | `telegram` or `whatsapp` or `none` |
| `TELEGRAM_BOT_TOKEN`            | (if using Telegram)                |
| `TELEGRAM_CHAT_ID`              | (if using Telegram)                |

5. Click **Deploy**

## Step 3: Update Supabase Settings

After deployment, add your Vercel URL to Supabase:

1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your Vercel domain (e.g., `https://your-app.vercel.app`)
3. Add it to **Redirect URLs** as well

## Step 4: Verify

1. Open your Vercel URL
2. Login with your owner/employee credentials
3. Test report submission and photo upload
4. Verify owner dashboard shows correct data

## Custom Domain (Optional)

1. Go to Vercel project **Settings > Domains**
2. Add your custom domain
3. Update Supabase Site URL and Redirect URLs to match

## Updating

Any push to the `main` branch will trigger auto-deployment on Vercel.
