import './globals.css';
import type { Metadata } from 'next';
import SiteHeader from './site-header';
export const metadata: Metadata = { title: 'My English Hub', description: 'Your personal English learning platform' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body suppressHydrationWarning><div className="shell"><SiteHeader />{children}<footer className="footer">MY ENGLISH HUB · Learn a little every day</footer></div></body></html> }
