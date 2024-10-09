'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';
import { type Section, SectionProvider } from '@/components/SectionProvider';
import BaseAILogo from './baseai-logo';

export function Layout({
	children,
	allSections
}: {
	children: React.ReactNode;
	allSections: Record<string, Array<Section>>;
}) {
	let pathname = usePathname();

	return (
		<SectionProvider sections={[]}>
			<div className="h-full bg-background lg:ml-72  xl:ml-80">
				<motion.header
					layoutScroll
					className="contents lg:pointer-events-none lg:fixed lg:inset-0 lg:z-40 lg:flex"
				>
					<div className="nav contents bg-background lg:pointer-events-auto lg:block lg:w-72 lg:overflow-y-auto lg:border-zinc-900/10 lg:px-6 lg:pb-8 lg:pt-6 xl:w-80 lg:dark:border-white/10">
						<div className="mt-4 hidden lg:flex">
							<Link href="/docs" aria-label="Home">
								<BaseAILogo width="30%" />
							</Link>
						</div>
						<Navigation className="hidden lg:mt-10 lg:block" />
					</div>
				</motion.header>
				<div className="z-1 relative flex flex-col rounded-bl-[calc(var(--radius)+2px)] rounded-tl-[calc(var(--radius)+2px)] bg-background md:mt-5 md:border md:border-r-0 md:border-border md:p-1 md:pr-0">
					<Header />
					<div className="prose rounded-bl-lg rounded-tl-lg bg-muted">
						<main className="flex-auto px-4 md:m-0 md:p-0">
							{children}
						</main>
						<Footer />
					</div>
				</div>
			</div>
		</SectionProvider>
	);
}
