# Cognivers Frontend

## Project Structure

This project follows a standard Next.js project structure:

- **Configuration files** - Located at the project root level
- **Application code** - Also at the root level following Next.js conventions

### Root Level Structure

```
cognivers-frontend/
├── components/     - UI components
├── context/        - Context providers
├── lib/            - Utility libraries
├── pages/          - Next.js page components
├── public/         - Static assets
├── styles/         - CSS styles
├── utils/          - Utility functions
├── .next/          - Build output (generated)
├── node_modules/   - Dependencies (generated)
├── .env.local      - Environment variables
├── next.config.ts  - Next.js configuration
├── package.json    - Dependencies and scripts
└── tsconfig.json   - TypeScript configuration
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run on a specific port
npm run dev -- -p 3001

# Build for production
npm run build

# Start production server
npm start
```

## Structure Rationale

This organization separates concerns:
- Makes it easy to find configuration files
- Keeps application code together
- Improves maintainability
- Follows modern Next.js best practices

## Getting Started

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
