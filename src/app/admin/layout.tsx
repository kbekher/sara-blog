// PLACEHOLDER root layout for admin — owned by the editor agent.
import { sourceSerif } from "../fonts";
import { ThemeScript } from "@/components/theme-script";
import "../globals.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="ru" className={sourceSerif.variable} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body>{children}</body>
    </html>
  );
}
