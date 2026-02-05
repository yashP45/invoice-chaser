import Link from "next/link";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
};

function buildUrl(
  basePath: string,
  page: number,
  searchParams?: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || key === "page") return;
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item));
      } else {
        params.set(key, value);
      }
    });
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({ page, pageSize, total, basePath, searchParams }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-xs text-slate-500">
        Showing {(page - 1) * pageSize + 1}–
        {Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className={`button-secondary ${page === 1 ? "pointer-events-none opacity-50" : ""}`}
          href={buildUrl(basePath, Math.max(1, page - 1), searchParams)}
        >
          Prev
        </Link>
        {pages.map((pageNumber) => (
          <Link
            key={pageNumber}
            className={`button-secondary ${
              pageNumber === page ? "border-slate-900 text-slate-900" : ""
            }`}
            href={buildUrl(basePath, pageNumber, searchParams)}
          >
            {pageNumber}
          </Link>
        ))}
        <Link
          className={`button-secondary ${
            page === totalPages ? "pointer-events-none opacity-50" : ""
          }`}
          href={buildUrl(basePath, Math.min(totalPages, page + 1), searchParams)}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
