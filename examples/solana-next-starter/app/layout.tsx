export const metadata = {
  title: 'Polyq + Solana + Next.js',
  description: 'Minimal starter for the polyq toolkit',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
