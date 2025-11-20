# Database Migration Scripts

## migrate-to-production.ts

Safely migrates all publications from the development database to the production database.

### Features
- ✅ Duplicate detection (skips publications that already exist in production)
- ✅ Batch processing (handles large datasets efficiently)
- ✅ Detailed logging and progress tracking
- ✅ Verification of migration success
- ✅ Safe error handling

### Usage

#### Step 1: Get your production database URL
1. Go to your Replit project settings
2. Navigate to the Database section
3. Find your production database URL
4. Copy it to use in the command below

#### Step 2: Run the migration

```bash
# Using environment variables
DEV_DATABASE_URL="your_dev_database_url" \
PROD_DATABASE_URL="your_prod_database_url" \
npm run tsx server/scripts/migrate-to-production.ts
```

Or if you want to use your current DATABASE_URL as the source:

```bash
PROD_DATABASE_URL="your_prod_database_url" \
npm run tsx server/scripts/migrate-to-production.ts
```

### What it does

1. **Validates** - Ensures both database URLs are provided and different
2. **Fetches** - Retrieves all publications from development database
3. **Checks** - Identifies existing publications in production to avoid duplicates
4. **Migrates** - Copies publications in batches of 100
5. **Verifies** - Confirms the total count matches expectations

### Expected Output

```
🚀 Starting Database Migration: Development → Production

✅ Environment variables validated
📊 Development DB: postgresql://...
📊 Production DB: postgresql://...

📥 Fetching publications from development database...
✅ Found 2912 publications to migrate

🔍 Checking for existing publications in production...
📌 Found 0 existing publications in production

🔄 Starting migration in batches of 100...

📦 Processing batch 1/30 (1-100 of 2912)
   ✓ Inserted 50 publications...
   ✓ Inserted 100 publications...
   ✅ Batch 1 complete
...

═══════════════════════════════════════
📊 MIGRATION SUMMARY
═══════════════════════════════════════
Total records in dev:  2912
Successfully inserted: 2912
Skipped (duplicates):  0
Errors:                0
Production total:      2912
═══════════════════════════════════════

✅ Migration completed successfully!
```

### Safety Features

- **No destructive operations** - Only inserts new records
- **Duplicate prevention** - Checks PMID to avoid re-importing
- **Batch processing** - Prevents memory issues with large datasets
- **Connection cleanup** - Properly closes database connections
- **Error tracking** - Logs any failures without stopping the entire migration

### After Migration

Once the migration is complete:

1. Verify the production database has all publications
2. Update your published app to use `PROD_DATABASE_URL`
3. Keep using `DATABASE_URL` for development work
4. Future changes in dev won't affect production
