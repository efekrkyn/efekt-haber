'use server';

export async function triggerManualRefresh() {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001';
  const url = `${baseUrl}/api/cron/refresh?limit=10&secret=${process.env.CRON_SECRET}`;
  
  try {
    const res = await fetch(url, { method: 'POST', cache: 'no-store' });
    if (!res.ok) {
      console.error("Refresh action failed with status:", res.status);
      return { error: 'Failed' };
    }
    return await res.json();
  } catch (err) {
    console.error("Refresh action error:", err);
    return { error: 'Server error' };
  }
}
