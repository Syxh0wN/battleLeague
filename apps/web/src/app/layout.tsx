import "./globals.css";
import { ReactNode } from "react";
import { QueryProvider } from "../providers/query-provider";

export const metadata = {
  title: "Pokemon Duel Men",
  description: "Pokemon duel platform"
};

type LayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
