import { getRepository } from "@/db/repository";
import { SearchBar } from "@/components/SearchBar";
import { BiggestDrops } from "@/components/BiggestDrops";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  const repo = getRepository();
  const [drops, featured, supermarkets] = await Promise.all([
    repo.biggestDrops(8),
    repo.search("", 6),
    repo.getSupermarkets(),
  ]);

  return (
    <div>
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center text-white sm:py-20">
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Encontra o supermercado mais barato, todos os dias.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-brand-100 sm:text-base">
          Comparamos diariamente os preços do Continente, Pingo Doce, Aldi, Intermarché,
          Lidl e Auchan. Pesquisa um produto ou monta o teu carrinho.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <SearchBar />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-brand-100">
          {supermarkets.map((s) => (
            <span key={s.slug} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/40"
                style={{ backgroundColor: s.colorHex ?? "#fff" }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <BiggestDrops drops={drops} />

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-extrabold">Produtos em destaque</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item) => (
            <ProductCard key={item.product.id} data={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
