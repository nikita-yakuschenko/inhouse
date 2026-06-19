import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Проект не найден</h1>
        <p className="mt-2 text-slate-600">Проверьте ссылку или вернитесь к списку проектов.</p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          К проектам
        </Link>
      </div>
    </div>
  );
}
