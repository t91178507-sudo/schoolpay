This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment Separation

InvoiceHub uses separate databases for local development and production.

- Local development defaults to `invoicehub_dev`.
- Production defaults to `invoicehub`.
- You can override either environment with `MONGODB_DB`.

Recommended local `.env.local`:

```env
MONGODB_URI=your_development_mongodb_connection_string
MONGODB_DB=invoicehub_dev
JWT_SECRET=your_local_secret
ADMIN_JWT_SECRET=your_local_admin_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

Recommended production environment variables in Vercel:

```env
MONGODB_URI=your_production_mongodb_connection_string
MONGODB_DB=invoicehub
JWT_SECRET=your_production_secret
ADMIN_JWT_SECRET=your_production_admin_secret
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
APP_URL=https://your-production-domain.com
```

Keep payment gateway, Twilio, WhatsApp bridge, and OpenAI keys separate between development and production whenever possible.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
"# Invoice"
