import { NextResponse } from 'next/server';
import { db } from '@/db';
import { favorites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { articleId, action } = await req.json();
    
    if (action === 'add') {
      await db.insert(favorites).values({ articleId }).onConflictDoNothing();
    } else if (action === 'remove') {
      await db.delete(favorites).where(eq(favorites.articleId, articleId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
