// app/page.tsx
// app/page.tsx
export const dynamic = "force-dynamic"; // ← keep this

import NextDynamic from "next/dynamic"; // ← rename the import

const ClientApp = NextDynamic(() => import("./ClientApp"), { ssr: false });

export default function Page() {
  return <ClientApp />;
}

