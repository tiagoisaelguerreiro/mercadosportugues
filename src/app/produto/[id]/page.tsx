import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/db/repository";
import { formatEuro, formatPricePerUnit } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import { AddToBasketButton } from "@/components/AddToBasketButton";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const globalId = Number(id);
  const repo = getRepository();
  const data = repo.getProduct(globalId);
  if (!data) notFound();

  const history = repo.getHistory(globalId, 30);
  const { product, offers, category, savingsAbsolute, savingsPercent } = data;
  const cheapest = offers[0] ?? null;

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-brand-600">
          Início
        </Link>
        <span className="mx-1.5">/</span>
        {category ? <span>{category.name}</span> : <span>Produto</span>}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna esquerda: imagem + info */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl ?? "https://placehold.co/300x300/png?text=Produto"}
              alt={product.nameGlobal}
              width={240}
              height={240}
              className="mx-auto h-60 w-60 rounded-xl bg-gray-50 object-contain"
            />
          </div>
        </div>

        {/* Coluna direita: titulo + ofertas */}
        <div className="lg:col-span-2">
          {product.brand && (
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {product.brand}
            </p>
          )}
          <h1 className="text-2xl font-extrabold leading-tight">{product.nameGlobal}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {cheapest && (
              <div className="rounded-xl bg-brand-50 px-4 py-2">
                <span className="text-xs text-gray-500">Melhor preço</span>
                <p className="text-xl font-extrabold text-brand-700">
                  {formatEuro(cheapest.effectivePrice)}{" "}
                  <span className="text-sm font-medium text-gray-500">
                    {cheapest.supermarket.name}
                  </span>
                </p>
              </div>
            )}
            {savingsAbsolute != null && savingsAbsolute > 0 && (
              <div className="rounded-xl bg-amber-50 px-4 py-2">
                <span className="text-xs text-gray-500">Poupança máxima</span>
                <p className="text-xl font-extrabold text-amber-700">
                  {formatEuro(savingsAbsolute)}{" "}
                  {savingsPercent != null && (
                    <span className="text-sm font-medium">({savingsPercent.toFixed(0)}%)</span>
                  )}
                </p>
              </div>
            )}
            <AddToBasketButton productGlobalId={product.id} />
          </div>

          {/* Lista de ofertas ordenada */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">Supermercado</th>
                  <th className="px-4 py-2.5 text-right">Preço/un.</th>
                  <th className="px-4 py-2.5 text-right">Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offers.map((offer) => {
                  const ppu = formatPricePerUnit(offer.pricePerUnit, offer.pricePerUnitUom);
                  return (
                    <tr key={offer.productMarketId} className={offer.isCheapest ? "bg-brand-50" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: offer.supermarket.colorHex ?? "#999" }}
                          />
                          <span className="font-medium">{offer.supermarket.name}</span>
                          {offer.isCheapest && (
                            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Melhor preço
                            </span>
                          )}
                          {offer.hasPromo && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                              Promo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">{ppu ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-baseline justify-end gap-2">
                          {offer.hasPromo && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatEuro(offer.priceRegular)}
                            </span>
                          )}
                          <span
                            className={`font-bold ${
                              offer.isCheapest ? "text-brand-700" : "text-gray-800"
                            }`}
                          >
                            {formatEuro(offer.effectivePrice)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grafico de evolucao */}
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-extrabold">Evolução do preço (30 dias)</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <PriceChart supermarkets={history.supermarkets} points={history.points} />
        </div>
      </section>
    </div>
  );
}
