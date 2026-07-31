import { Poppins } from "next/font/google";
import "./globals.css";
import ThemeInitializer from "./components/ThemeInitializer";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  title: "OS-COMS",
  description: "Our Skin Clinical Operations & Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className}>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}