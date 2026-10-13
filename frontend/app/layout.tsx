import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import DemoToolsMenu from '@/components/layout/DemoToolsMenu'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CivicFix AI - Municipal Grievance Redressal Platform',
  description: 'AI-powered municipal complaint triage platform with Urdu/English voice interaction, explainable urgency scoring, and verified resolution.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          <div className="min-h-screen bg-background font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
            {children}
            <DemoToolsMenu />
          </div>
        </LanguageProvider>
      </body>
    </html>
  )
}