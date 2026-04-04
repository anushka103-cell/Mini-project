import AuthGuard from "@/components/AuthGuard";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "MindSafe",
  description: "A safe world where your mind can breathe",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark-mode">
      <body className="bg-slate-950 text-slate-100">
        <ThemeProvider>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-slate-950">
              <AuthGuard>{children}</AuthGuard>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
