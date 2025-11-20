# Database Migration Guide

## Overview
This guide helps you safely migrate 2,912 publications from the development database to the production database without data loss or downtime.

## Prerequisites
1. Access to both development and production database URLs
2. Sufficient disk space for export file (~50-100 MB)
3. Node.js and TypeScript installed

## Migration Steps

### Step 1: Export from Development Database

```bash
# Run the export script
npx tsx server/scripts/exportPublications.ts
```

This will create a timestamped export file: `server/scripts/publications-export-YYYY-MM-DD.json`

**What it does:**
- Exports all 2,912 publications from development database
- Creates a checksum for verification
- Saves a timestamped snapshot file
- Shows sample records for manual verification

### Step 2: (Optional) Dry Run Import

Test the import without making changes:

```bash
# Set production database URL (get this from Replit Database pane)
export PROD_DATABASE_URL="postgresql://..."

# Run in dry-run mode
DRY_RUN=true npx tsx server/scripts/importPublications.ts server/scripts/publications-export-YYYY-MM-DD.json
```

**What it does:**
- Validates the export file
- Verifies checksum
- Shows what would be imported
- No actual database changes

### Step 3: Import to Production Database

```bash
# Set production database URL
export PROD_DATABASE_URL="postgresql://..."

# Run the actual import
npx tsx server/scripts/importPublications.ts server/scripts/publications-export-YYYY-MM-DD.json
```

**What it does:**
- Processes publications in batches of 500
- Uses upsert logic (insert new, update existing)
- Detects duplicates by PMID or DOI
- Provides detailed import statistics
- Continues on errors (logs them for review)

### Step 4: Verify Migration

Compare counts between databases:

**Development:**
```sql
SELECT COUNT(*) FROM publications;
```

**Production:**
```sql
SELECT COUNT(*) FROM publications;
-- Connect using PROD_DATABASE_URL
```

Sample a few records to ensure data integrity:
```sql
SELECT id, pmid, title, publication_date 
FROM publications 
ORDER BY publication_date DESC 
LIMIT 5;
```

### Step 5: Update Published Site

1. Go to Replit Deployment settings
2. Update `DATABASE_URL` secret to point to production database URL
3. Redeploy the application
4. Test the published site to ensure all publications are visible

## Rollback Strategy

If something goes wrong:

1. **Before import:** Simply don't run the import script
2. **After import but before deployment:** Keep using development database (change nothing)
3. **After deployment:** Revert `DATABASE_URL` back to development database URL and redeploy

## Export File Structure

The export file contains:
```json
{
  "exportDate": "2025-01-20T10:30:00.000Z",
  "totalRecords": 2912,
  "checksum": "a1b2c3d4e5f6g7h8",
  "publications": [...]
}
```

## Important Notes

- **Keep the export file** as a backup snapshot
- **Don't delete development data** until production is verified
- The import script uses **upsert logic**, so running it multiple times is safe
- Duplicate detection uses `pmid` (preferred) or `doi` as unique identifiers
- The categories table is intentionally unused and will remain empty

## Troubleshooting

### "PROD_DATABASE_URL not found"
Set the environment variable:
```bash
export PROD_DATABASE_URL="your-production-database-url"
```

### "Checksum mismatch"
The export file may be corrupted. Re-run the export script.

### "Connection refused"
Verify the database URL is correct and accessible from your environment.

### Count mismatch after import
Check the error log in the import output. Some publications may have failed to import due to validation errors.

## Support

If you encounter issues:
1. Check the import error log for specific failures
2. Verify database connection strings
3. Ensure schema matches between dev and prod
4. Contact Replit support for production database access issues
