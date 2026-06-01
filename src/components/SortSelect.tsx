"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") || "date";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSort);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium text-muted-foreground">
        Sırala:
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={handleChange}
        className="h-9 rounded-md border border-border/50 bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="date">En Yeni (Tarih)</option>
        <option value="importance">Önem Puanı (Yüksekten)</option>
        <option value="impact">Piyasa Etkisi (Yüksekten)</option>
        <option value="sentiment">Duygu (Olumlu İlk)</option>
      </select>
    </div>
  );
}
