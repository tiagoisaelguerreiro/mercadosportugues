import { notFound } from "next/navigation";
import { findSupermarketBySlug } from "@/lib/data";

/** Valida o slug antes da fronteira de Suspense para que o 404 saia com status real. */
export default async function SupermarketLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await findSupermarketBySlug(slug))) notFound();
  return children;
}
