# Project Bolt - Inventory Management System

A modern inventory management system built with React, TypeScript, and Supabase.

## Features

- Product Management
- Inventory Control
- Order Management
- Purchase Orders
- Advanced Reporting
- Activity Logging

## Tech Stack

- Frontend: React 18 with TypeScript
- UI: TailwindCSS
- Backend: Supabase
- Build Tool: Vite

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Installation

1. Clone the repository
```bash
git clone [repository-url]
cd project-bolt
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm run dev
```

4. Build for production
```bash
npm run build
```

## Deployment

### Netlify Deployment Steps

1. Push your code to GitHub
2. Log in to Netlify
3. Click "New site from Git"
4. Choose your GitHub repository
5. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add environment variables in Netlify:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
7. Deploy!

## License

MIT
