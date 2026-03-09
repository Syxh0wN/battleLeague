import "./globals.css";
import { ReactNode } from "react";
import { QueryProvider } from "../providers/query-provider";
import { HideNextJsPortal } from "../components/hide-nextjs-portal";

export const metadata = {
  title: "BattleLeague",
  description: "BattleLeague duel platform"
};

type LayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body className="m-0 min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        <HideNextJsPortal />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
