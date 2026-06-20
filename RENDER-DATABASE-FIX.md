# Fix: Render Backend Database Connection Error

## Problem
The backend is failing with:
```
Error: getaddrinfo ENOTFOUND dpg-d85k9rfaqgkc73bfeihg-a
```

This means the database hostname cannot be resolved. The issue is that **Render's internal database hostname is not accessible** from the web service because:
1. The backend and database services are not properly linked in Render
2. OR the DATABASE_URL environment variable is using the internal hostname instead of the external URL

## Solution: Manual Setup Required

Follow these steps in the Render Dashboard:

### Step 1: Get the Correct Database URL

1. Go to **Render Dashboard** → https://dashboard.render.com
2. Click on **contador-db** (PostgreSQL service)
3. Find the connection string section
4. **IMPORTANT**: Copy the **External Database URL** (NOT the Internal Connection String)
   - Internal URL looks like: `postgresql://user:pass@dpg-xxxxx.internal:5432/dbname` ❌
   - External URL looks like: `postgresql://user:pass@dpg-xxxxx.c.postgres.render.com:5432/dbname` ✅

### Step 2: Update Backend Environment Variable

1. Go to Render Dashboard → **contador-backend** (Web Service)
2. Click **Settings** → **Environment**
3. Find or create the `DATABASE_URL` environment variable
4. **Delete the current value** (if using internal hostname)
5. **Paste the External Database URL** from Step 1
6. **Important**: Make sure `sync: false` is set (so it's treated as a secret and not displayed)

### Step 3: Trigger Redeploy

1. After updating DATABASE_URL, click **Manual Deploy** or push a code change to trigger auto-deploy
2. Watch the logs for successful connection:
   ```
   ✓ Production configuration validated successfully
   ✓ Environment validation completed successfully
   Database connection pool initialized
   Running migrations...
   ```

### Step 4: Verify Connection

1. Once deployment succeeds, test the login at: https://contador-saas-ashy.vercel.app/
2. Check Render logs for any errors
3. If successful, you should see `Database connection pool initialized` in logs

---

## Alternative: Use Internal Hostname (Advanced)

If both services are in the same Render project and region, you can use the internal hostname, but you may need to:

1. Ensure both services are in the **same region** (e.g., `oregon`)
2. Add SSL connection option (already configured in code)
3. Use the format: `postgresql://user:pass@dpg-xxxxx.internal:5432/dbname`

However, **external URL is more reliable** and recommended.

---

## Connection URL Format Reference

| Component | Example | Notes |
|-----------|---------|-------|
| Scheme | `postgresql://` | Always use postgresql, not postgres |
| User | `contador_user` | Database user (set at creation) |
| Password | `[password]` | Retrieved from Render dashboard |
| Host (External) | `dpg-xxxxx.c.postgres.render.com` | External accessible hostname |
| Host (Internal) | `dpg-xxxxx.internal` | Only works within Render internal network |
| Port | `5432` | Default PostgreSQL port |
| Database | `contador_db` | Database name (set at creation) |

**Full External URL Example:**
```
postgresql://contador_user:MyPassword123@dpg-d85k9rfaqgkc73bfeihg-a.c.postgres.render.com:5432/contador_db
```

---

## Testing Connection Manually (Optional)

If you have `psql` installed, you can test the connection:

```bash
# Replace with your actual credentials
psql "postgresql://contador_user:PASSWORD@dpg-xxxxx.c.postgres.render.com:5432/contador_db" -c "SELECT version();"
```

If it returns the PostgreSQL version, the connection is working.

---

## Common Issues & Solutions

### Issue 1: ENOTFOUND Error
**Cause**: Using internal hostname or incorrect external hostname  
**Solution**: Copy the correct **External Database URL** from Render dashboard

### Issue 2: Connection Timeout
**Cause**: Wrong port or firewall blocking connection  
**Solution**: Verify port is `5432` in the URL

### Issue 3: Authentication Failed
**Cause**: Wrong username/password  
**Solution**: Check credentials match those set when PostgreSQL was created in Render

### Issue 4: Database Does Not Exist
**Cause**: Database name mismatch  
**Solution**: Ensure database name matches exactly (case-sensitive)

---

## Code Changes Made

The backend code has been updated to:
1. ✅ Support SSL connections (required for Render)
2. ✅ Improve error logging with helpful suggestions
3. ✅ Handle both `connectionString` and individual host/port configs
4. ✅ Properly handle Render's internal/external database URLs

No code changes are needed on your part - just update the `DATABASE_URL` environment variable in Render.

---

## Files Modified
- `backend/src/config/database.ts` - Added better logging and connection handling

## References
- [Render PostgreSQL Docs](https://render.com/docs/postgresql)
- [Render Connection String Format](https://render.com/docs/databases#connecting-to-your-database)
- [PostgreSQL Connection String Format](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
