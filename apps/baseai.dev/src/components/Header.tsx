import navigationData, { navLearn } from '@/data/navigation';
import clsx from 'clsx';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef } from 'react';

import {
	MobileNavigation,
	useIsInsideMobileNavigation,
	useMobileNavigationStore
} from '@/components/MobileNavigation';
import { MobileSearch, Search } from '@/components/Search';
import { ThemeToggle } from '@/components/ThemeToggle';
import BaseAILogo from './baseai-logo';
import { Anchor } from './ui/anchor';
import { IconDocs } from './ui/iconists/icon-docs';
import { GithubIcon } from './icons/GithubIcon';
import { TwitterIcon } from './icons/TwitterIcon';
import { DiscordIcon } from './icons/DiscordIcon';
import { OpenLink } from './icons/OpenLink';

/**
 * Retrieves the section title based on the provided pathname.
 *
 * @param {string} pathname - The current pathname.
 * @returns {string} - The section title.
 */
function getSectionTitle({
	pathname,
	isLearnPath
}: {
	pathname: string;
	isLearnPath: boolean;
}) {
	let currentTitle = '';
	const navData = isLearnPath ? navLearn : navigationData;

	for (const item of navData) {
		const foundLink = item.links.find(link => {
			if (link.href === pathname) {
				return true;
			}

			if (link.sections) {
				return link.sections.find(section => section.href === pathname);
			}
		});

		// If the link has sections, we need to find the matching section title
		if (foundLink?.sections?.length) {
			currentTitle = foundLink.title;
			break; // Stop searching once we've found the matching href
		}

		// If the link has no sections, we can use the link title
		if (foundLink) {
			currentTitle = item.title;
			break; // Stop searching once we've found the matching href
		}
	}

	return currentTitle;
}

function HeaderLinks() {
	const pathname = usePathname();
	const isLearnPath = pathname.startsWith('/learn');
	const href = isLearnPath ? '/docs' : '/learn';
	const text = isLearnPath ? 'Docs' : 'Learn';

	return (
		<>
			<Anchor
				href={href}
				className="w-28 font-semibold"
				variant={'default'}
			>
				{text}
			</Anchor>
			<Anchor
				href={'https://github.com/LangbaseInc/baseai'}
				target="_blank"
				className="hidden w-auto font-normal outline outline-[1.5px] outline-black/35 lg:flex lg:items-center dark:outline-white/35 "
				variant={'ghost'}
			>
				<GithubIcon className="size-4 text-black dark:text-white" />
				<span className="leading-none flex-grow truncate">Star us on Github</span>
			</Anchor>
		</>
	);
}

function Socials() {
	return (
		<>
			<Link
				className="hidden md:block"
				href={'https://x.com/langbaseinc'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<TwitterIcon className="size-4 text-black/75 dark:text-white/75" />
			</Link>
			<Link
				className="hidden md:block"
				href={'https://langbase.com/discord'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<DiscordIcon className="size-4 text-black/75 dark:text-white/75" />
			</Link>
			<Link
				className="hidden md:block"
				href={'https://github.com/LangbaseInc/'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<GithubIcon className="size-4 text-black/75 dark:text-white/75" />
			</Link>
		</>
	);
}

export const Header = forwardRef<
	React.ElementRef<'div'>,
	{ className?: string }
>(function Header({ className }, ref) {
	let { isOpen: mobileNavIsOpen } = useMobileNavigationStore();
	let isInsideMobileNavigation = useIsInsideMobileNavigation();
	const pathname = usePathname();
	const isLearnPath = pathname.startsWith('/learn');
	let currentTitle = getSectionTitle({ pathname, isLearnPath }) || 'BaseAI';

	let { scrollY } = useScroll();
	let bgOpacityLight = useTransform(scrollY, [0, 72], [0.5, 0.9]);
	let bgOpacityDark = useTransform(scrollY, [0, 72], [0.2, 0.8]);

	return (
		<motion.div
			ref={ref}
			className={clsx(
				className,
				'fixed inset-0 inset-x-0 top-0 z-50 flex h-14 px-4 md:static md:mx-5 md:my-6 md:flex md:h-auto md:items-center md:justify-between md:gap-12 md:px-0 md:transition lg:left-72 lg:z-30 xl:left-80',
				!isInsideMobileNavigation &&
					'backdrop-blur-sm lg:left-72 xl:left-80 dark:backdrop-blur',
				isInsideMobileNavigation ? 'xbg-background' : 'xbg-background'
			)}
			style={
				{
					'--bg-opacity-light': bgOpacityLight,
					'--bg-opacity-dark': bgOpacityDark
				} as React.CSSProperties
			}
		>
			<div className="xbg-zinc-900/7.5 absolute inset-x-0 top-full h-px transition md:hidden dark:bg-white/7.5" />

			<div className="flex items-center">
				<h2 className="flex items-center text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-2xl sm:tracking-tight">
					<IconDocs
						className="mr-4 hidden h-7 w-7 text-muted-foreground/50 lg:block"
						aria-hidden="true"
					/>
					<div className="mr-3 md:mr-4 lg:hidden">
						<MobileNavigation />
					</div>
					<div className="hidden md:block">{currentTitle}</div>
					<Link
						href="/"
						aria-label="Home"
						className="block w-full font-bold text-black md:hidden dark:text-white"
					>
						<BaseAILogo className="w-[10rem] " />
					</Link>
				</h2>
			</div>
			<div className="flex w-full justify-end md:w-[70%] md:space-x-6">
				<Search />
				<div className="flex hidden items-center justify-center md:flex xl:hidden">
					<MobileSearch />
				</div>
				<div className="flex items-center justify-end gap-5">
					<div className="hidden md:block md:h-5 md:w-px md:bg-zinc-900/10 md:dark:bg-white/15" />
					<div className="flex items-center gap-4">
						<div className="md:hidden">
							<MobileSearch />
						</div>
						<HeaderLinks />
					</div>
					<div className="hidden md:block md:h-5 md:w-px md:bg-zinc-900/10 md:dark:bg-white/15"></div>
					<ThemeToggle />
					<div className="hidden md:block md:h-5 md:w-px md:bg-zinc-900/10 md:dark:bg-white/15"></div>
					<Socials />
				</div>
			</div>
		</motion.div>
	);
});
