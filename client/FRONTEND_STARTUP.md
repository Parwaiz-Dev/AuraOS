# Frontend Startup Guide

## Step 1: Install Dependencies
```bash
cd c:\Projects\AuraOS\client
npm install
```

## Step 2: Start the Frontend Development Server
```bash
npm run dev
```

The frontend will start on: **http://localhost:3001** (configured in vite.config.ts)

## Step 3: Ensure Backend is Running
Before accessing the frontend, make sure the backend is running:
```bash
cd c:\Projects\AuraOS
npm run dev
```

Backend should be running on: **http://localhost:3000**

## Step 4: Login
Navigate to http://localhost:3001 and login with:
- **Email**: admin@demo-kitchen.local
- **Password**: demo123

## Troubleshooting

### Frontend shows blank page
1. Check browser console (F12) for errors
2. Verify backend is running at http://localhost:3000
3. Check that npm install completed successfully
4. Clear browser cache and refresh (Ctrl+Shift+Delete)

### Connection refused errors
- Backend not running - start it with `npm run dev` in root AuraOS folder
- Check backend is on port 3000

### Module not found errors
- Run `npm install` in client folder
- Delete node_modules and package-lock.json, then `npm install` again

### CORS errors
- Backend proxy is configured in vite.config.ts
- Ensure backend is running on 3000

## Available Endpoints After Login

- **Dashboard**: http://localhost:3001/
- **Orders**: http://localhost:3001/orders
- **Tables**: http://localhost:3001/tables
- **Menu**: http://localhost:3001/menu
- **Payments**: http://localhost:3001/payments
- **Inventory**: http://localhost:3001/inventory (Admin only)
- **Users**: http://localhost:3001/users (Admin only)
- **Reports**: http://localhost:3001/reports (Admin only)
- **Kitchen Display**: http://localhost:3001/kitchen

## Build for Production

```bash
npm run build
npm run preview
```

This will create an optimized build in `dist/` folder.
