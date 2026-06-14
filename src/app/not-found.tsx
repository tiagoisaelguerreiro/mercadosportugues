import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-extrabold">Página não encontrada</h1>
      <p className="mt-2 text-gray-500">O produto ou página que procuras não existe.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
