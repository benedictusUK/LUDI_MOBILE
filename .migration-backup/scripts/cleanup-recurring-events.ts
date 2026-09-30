import { db } from '../server/db';
import { events } from '@shared/schema';
import { ilike } from 'drizzle-orm';

async function cleanupRecurringEvents() {
  try {
    console.log('Starting cleanup of recurring events...');
    
    // Delete all events with "recurring" in the name (case-insensitive)
    const result = await db
      .delete(events)
      .where(ilike(events.name, '%recurring%'))
      .returning();
    
    console.log(`✅ Successfully deleted ${result.length} events containing "recurring" in the name`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up events:', error);
    process.exit(1);
  }
}

cleanupRecurringEvents();
