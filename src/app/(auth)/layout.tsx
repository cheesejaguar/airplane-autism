import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="chart-grid grid flex-1 place-items-center px-4 py-12">
      <Suspense>{children}</Suspense>
    </div>
  );
}
