# Database Migrations

## Overview

This project uses Prisma Migrate for safe, versioned database schema changes.

**IMPORTANT:** The build script has been updated to use `prisma migrate deploy` instead of `prisma db push --accept-data-loss`. This prevents accidental data loss during deployments.

## For Developers

### Making Schema Changes

1. Edit `prisma/schema.prisma`
2. Generate a migration:
   ```bash
   npx prisma migrate dev --name describe_your_change
   ```
3. Commit the migration files along with schema changes
4. Push to your branch

### Local Development

```bash
# Apply pending migrations
npx prisma migrate dev

# Reset database (CAUTION: destroys data)
npx prisma migrate reset
```

## For Production Deployment

### First Time Setup (Baselining)

If deploying to an existing database that was created with `db push`:

```bash
# Mark the baseline migration as applied
npx prisma migrate resolve --applied 0_init
```

### Regular Deployments

The build script automatically runs:
```bash
prisma migrate deploy
```

This safely applies any pending migrations without data loss.

## Render Deployment

### After Data Loss Recovery

1. Restore database using Render's Point-in-Time Recovery
2. Update `DATABASE_URL` to point to the new database
3. Run baseline command:
   ```bash
   npx prisma migrate resolve --applied 0_init
   ```
4. Deploy as normal

### Backup Best Practices

- Render provides PITR for paid database instances
- Recovery window: 7 days
- Always backup before major schema changes

## Troubleshooting

### "Migration already applied" Error

This is normal - it means the migration was already run.

### "Database schema is not in sync" Warning

Run `prisma migrate dev` locally to generate a new migration.

### Production Deploy Fails

1. Check if there are pending migrations
2. Verify DATABASE_URL is correct
3. Try running `prisma migrate deploy` manually
