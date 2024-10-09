'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/Button';
import navigationData, { navLearn } from '@/data/navigation';

import { GithubIcon } from './icons/GithubIcon';
import { TwitterIcon } from './icons/TwitterIcon';
import { DiscordIcon } from './icons/DiscordIcon';

function PageLink({
	label,
	page,
	previous = false
}: {
	label: string;
	page: { href: string; title: string };
	previous?: boolean;
}) {
	return (
		<>
			<Button
				className="not-prose"
				href={page.href}
				aria-label={`${label}: ${page.title}`}
				variant="outline-muted"
				arrow={previous ? 'left' : 'right'}
			>
				{label}
			</Button>
			<Link
				href={page.href}
				tabIndex={-1}
				aria-hidden="true"
				className="prose text-base font-semibold text-zinc-900 transition dark:prose-invert hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300"
			>
				{page.title}
			</Link>
		</>
	);
}

function PageNavigation() {
	let pathname = usePathname();
	const isLearnPath = pathname.startsWith('/learn');
	const navLinks = isLearnPath ? navLearn : navigationData;

	let allPages = navLinks.flatMap(group => group.links);
	let currentPageIndex = allPages.findIndex(page => page.href === pathname);

	if (currentPageIndex === -1) {
		return null;
	}

	let previousPage = allPages[currentPageIndex - 1];
	let nextPage = allPages[currentPageIndex + 1];

	if (!previousPage && !nextPage) {
		return null;
	}

	return (
		<div className="prose flex dark:prose-invert">
			{previousPage && (
				<div className="flex flex-col items-start gap-3">
					<PageLink label="Previous" page={previousPage} previous />
				</div>
			)}
			{nextPage && (
				<div className="ml-auto flex flex-col items-end gap-3">
					<PageLink label="Next" page={nextPage} />
				</div>
			)}
		</div>
	);
}

function Socials() {
	return (
		<>
			<Link
				className="hidden md:block"
				href={'https://github.com/LangbaseInc/'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<GithubIcon className="size-4 text-black/35 dark:text-white/35" />
			</Link>
			<Link
				className="hidden md:block"
				href={'https://langbase.com/discord'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<DiscordIcon className="size-4 text-black/35 dark:text-white/35" />
			</Link>
			<Link
				className="hidden md:block"
				href={'https://x.com/langbaseinc'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<TwitterIcon className="size-4 text-black/35 dark:text-white/35" />
			</Link>
		</>
	);
}

function SmallPrint() {
	return (
		<div className="xborder-t xborder-zinc-900/5 flex flex-col items-center justify-between gap-5 pt-8 sm:flex-row dark:border-white/5">
			<p className="text-xs text-zinc-600 dark:text-zinc-400">
				&copy; Copyright {new Date().getFullYear()}. All rights
				reserved.
			</p>
			<div className="flex gap-4">
				<Socials />
				{/* <SocialLink href="#" icon={DiscordIcon}>
          Join our Discord server
        </SocialLink> */}
			</div>
		</div>
	);
}

export function Footer() {
	return (
		<footer className="mx-auto w-full max-w-2xl space-y-10 px-4 pb-16 md:px-0 lg:max-w-5xl">
			<PageNavigation />
			<SmallPrint />
		</footer>
	);
}
