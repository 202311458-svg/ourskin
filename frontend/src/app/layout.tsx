import { Newsreader, Poppins } from "next/font/google";
import "./globals.css";
import "./styles/landing-hero-cleanup.css";
import ThemeInitializer from "./components/ThemeInitializer";
import SessionInitializer from "./components/SessionInitializer";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata = {
  title: "OS-COMS",
  description: "Our Skin Clinical Operations & Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.className} ${newsreader.variable}`}>
        <SessionInitializer />
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
