import { getRepository } from "@/db/repository";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = await getRepository().search(query, 50);

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <SearchBar initialQuery={query} />
      </div>

      <div className="mt-8">
        <h1 className="text-lg font-bold">
          {query ? (
            <>
              {results.length} resultado{results.length === 1 ? "" : "s"} para{" "}
              <span className="text-brand-600">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "Todos os produtos"
          )}
        </h1>

        {results.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            Não encontrámos produtos para esta pesquisa. Tenta outro termo.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <ProductCard key={item.product.id} data={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
