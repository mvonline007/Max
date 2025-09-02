import "./globals.css";
export const metadata = {
  title: "Max — Tracker",
  description: "Puppy tracker deployed on Vercel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50">
        {children}
      </body>
    </html>
  );
}
