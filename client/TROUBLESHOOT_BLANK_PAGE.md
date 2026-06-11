# Troubleshooting: Blank Page Issues

If the frontend is showing a blank white page, follow these steps:

## Step 1: Check if Frontend is Running

```bash
cd c:\Projects\AuraOS\client
npm run dev
```

You should see:
```
VITE v4.3.2  ready in XXX ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

## Step 2: Check Browser Console for Errors

1. Open browser (Chrome, Firefox, Edge, Safari)
2. Press **F12** to open Developer Tools
3. Click the **Console** tab
4. Look for red error messages

## Step 3: Common Issues & Solutions

### Issue: `Cannot find module` errors
**Solution:**
```bash
cd c:\Projects\AuraOS\client
npm install
```

Then restart dev server:
```bash
npm run dev
```

### Issue: Backend connection refused
**Error:** `Error: connect ECONNREFUSED 127.0.0.1:3000`

**Solution:**
1. Open new terminal
2. Go to root folder:
   ```bash
   cd c:\Projects\AuraOS
   npm install
   npm run dev
   ```
3. Wait for backend to start
4. Refresh frontend (Ctrl+R)

### Issue: `GET /login 404` or routes not found
**Solution:**
1. Frontend should redirect to /login automatically
2. If seeing 404, check that you're accessing: http://localhost:5173 (not 3000)
3. Try: http://localhost:5173/login

### Issue: Styles not showing (no colors/fonts)
**Solution:**
1. Tailwind CSS might not be compiling
2. Stop dev server (Ctrl+C)
3. Rebuild:
   ```bash
   npm run build
   npm run preview
   ```
4. Or restart dev:
   ```bash
   npm run dev
   ```

### Issue: Page loads but shows blank white space
**Solution:**
1. Check console for JavaScript errors
2. Try hard refresh: **Ctrl+Shift+R** (Windows) or **Cmd+Shift+R** (Mac)
3. Clear browser cache:
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Develop → Empty Web Storage
4. Close browser completely and reopen
5. Try incognito/private mode

## Step 4: Verify Setup

### Check Backend Health
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok"}
```

### Check Frontend Files Exist
```bash
# From c:\Projects\AuraOS\client
ls -la src/pages/Login.tsx
ls -la src/components/Button.tsx
ls -la src/contexts/AuthContext.tsx
```

All should exist (no "file not found")

### Check npm Dependencies Installed
```bash
cd c:\Projects\AuraOS\client
npm ls react react-dom
```

Should show installed versions like:
```
react@18.2.0
react-dom@18.2.0
```

## Step 5: Complete Reset

If nothing works, do a complete reset:

```bash
# Clean up
cd c:\Projects\AuraOS\client
rm -r node_modules package-lock.json dist

# Reinstall
npm install

# Rebuild and run
npm run build
npm run dev
```

## Step 6: Check Ports Are Available

Backend needs port 3000:
```bash
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000
```

If something is already using port 3000:
- Kill it: `taskkill /PID <process_id> /F`
- Or change backend port in `.env`

Frontend needs port 5173 (or configured port):
```bash
# Windows
netstat -ano | findstr :5173

# Mac/Linux  
lsof -i :5173
```

## Step 7: Verify All Files Exist

Key files that must exist:
- ✅ `c:\Projects\AuraOS\client\src\App.tsx`
- ✅ `c:\Projects\AuraOS\client\src\pages\Login.tsx`
- ✅ `c:\Projects\AuraOS\client\src\contexts\AuthContext.tsx`
- ✅ `c:\Projects\AuraOS\client\src\api.ts`
- ✅ `c:\Projects\AuraOS\client\index.html`
- ✅ `c:\Projects\AuraOS\client\tailwind.config.js`

If any are missing, run:
```bash
npm install
npm run dev
```

## Step 8: Browser Compatibility

Frontend works best on:
- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (14+)
- ✅ Edge (latest)

If using older browser, try latest Chrome.

## Step 9: Check for JavaScript Errors

In browser console, look for:
- Red errors (critical)
- Yellow warnings (non-critical but check)
- Network tab for failed requests

Common errors:
```
"Cannot find module 'react'"
→ Run: npm install

"API not found"
→ Backend not running on port 3000

"undefined is not a function"
→ Check for typos in import statements
```

## Step 10: Enable Debug Mode

Add to browser console:
```javascript
localStorage.setItem('debug', 'auraos:*')
localStorage.setItem('logLevel', 'debug')
```

This enables verbose logging for debugging.

## If Still Blank After All Steps

1. **Take a screenshot** of the blank page
2. **Open browser console** (F12)
3. **Copy any error messages**
4. **Check these files** are modified recently:
   - `src/App.tsx`
   - `src/main.tsx`
   - `package.json`

5. **Reinstall everything**:
   ```bash
   cd c:\Projects\AuraOS
   rm -r client/node_modules client/package-lock.json
   cd client
   npm install --legacy-peer-deps
   npm run dev
   ```

---

## Quick Checklist

- [ ] Backend running on http://localhost:3000 ✅
- [ ] Frontend running on http://localhost:5173 ✅
- [ ] Browser console has no red errors ✅
- [ ] Able to reach http://localhost:5173/login ✅
- [ ] All source files exist ✅
- [ ] npm install completed successfully ✅
- [ ] Hard refresh tried (Ctrl+Shift+R) ✅
- [ ] Incognito/private mode tested ✅
- [ ] No processes using ports 3000 or 5173 ✅

---

## Contact/Support

If you've tried all steps and still have issues:

1. Check error in console (F12)
2. Verify backend is running
3. Try complete reset (Step 5)
4. Check network connectivity
5. Try different browser
6. Restart computer

The frontend SHOULD work at this point. If not, there may be environment-specific issues.

---

## Success Indicators

When working correctly, you should see:
- ✅ AuraOS login page at http://localhost:5173
- ✅ Email/password input fields
- ✅ "Sign In" button
- ✅ Demo credentials displayed
- ✅ "Create account" and "Forgot password" links
- ✅ Blue gradient background

Once logged in:
- ✅ Dashboard with metrics cards
- ✅ Sidebar with navigation menu
- ✅ User name and role displayed
- ✅ Green/red connection indicator
- ✅ Logout button

**Your frontend is working! 🎉**
