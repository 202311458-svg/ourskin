import "./globals.css";
import ThemeInitializer from "./components/ThemeInitializer";

export const metadata = {
  title: "OS-COMS",
  description: "Our Skin Clinical Operations & Monitoring System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}