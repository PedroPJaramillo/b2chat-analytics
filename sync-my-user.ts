/**
 * Migration script to sync all Clerk users to database with roles from metadata
 * Run with: npx tsx sync-my-user.ts
 *
 * This script:
 * 1. Fetches all users from Clerk
 * 2. Reads their role from publicMetadata
 * 3. Syncs to database using the existing syncUserToDatabase function
 */

import { config } from "dotenv";
config({ path: ".env" }); // Explicitly load .env file

import { clerkClient } from "@clerk/nextjs/server";
import { syncUserToDatabase } from "./src/lib/auth";

async function main() {
  try {
    console.log("🔄 Starting Clerk user sync...\n");

    // Verify environment variables are loaded
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY not found. Make sure .env file exists.");
    }

    // Get all users from Clerk (with pagination)
    const client = await clerkClient();
    let hasMore = true;
    let offset = 0;
    const limit = 100;
    let totalSynced = 0;
    let totalErrors = 0;

    while (hasMore) {
      const response = await client.users.getUserList({
        limit,
        offset
      });

      console.log(`\n📦 Processing batch: ${response.data.length} users (offset: ${offset})`);

      for (const user of response.data) {
        const email = user.emailAddresses[0]?.emailAddress || "No email";
        const role = (user.publicMetadata as any)?.role || "Not set (will default to Manager)";

        console.log(`\n  👤 ${email}`);
        console.log(`     Clerk ID: ${user.id}`);
        console.log(`     Role in Clerk metadata: ${role}`);

        try {
          await syncUserToDatabase(user);
          console.log(`     ✅ Synced successfully`);
          totalSynced++;
        } catch (error) {
          console.error(`     ❌ Failed:`, error instanceof Error ? error.message : error);
          totalErrors++;
        }
      }

      hasMore = response.data.length === limit;
      offset += limit;
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ Sync complete!`);
    console.log(`   Total users synced: ${totalSynced}`);
    console.log(`   Total errors: ${totalErrors}`);
    console.log(`${"=".repeat(50)}\n`);

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    console.error("\nTroubleshooting:");
    console.error("  1. Make sure .env file exists");
    console.error("  2. Verify CLERK_SECRET_KEY is set");
    console.error("  3. Check database connection (DATABASE_URL)");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
