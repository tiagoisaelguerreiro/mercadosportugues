import { notFound } from "next/navigation";
import { getProductCached, parseProductId } from "@/lib/data";

/**
 * Valida a existencia do produto fora da fronteira de Suspense criada pelo
 * `loading.tsx`: assim o `notFound()` e lancado antes do streaming comecar e a
 * resposta sai com status 404 real (importante para SEO), mantendo o skeleton
 * para a pagina em si.
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const globalId = parseProductId(id);
  if (!globalId || !(await getProductCached(globalId))) notFound();
  return children;
}
