import { NextResponse } from 'next/server';
import { db } from '@/db';
import { watchlist } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { topic, action, id } = await req.json();
    
    if (action === 'add' && topic) {
      await db.insert(watchlist).values({ topic });
    } else if (action === 'remove' && id) {
      await db.delete(watchlist).where(eq(watchlist.id, parseInt(id)));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
