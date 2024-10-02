'use client';

import cn from 'mxcn';
import { Inter } from 'next/font/google';
import { useState } from 'react';
import '../../styles/global.css';
import { Anchor } from '../ui/anchor';
import { IconDocs } from '../ui/iconists/icon-docs';
import WebGLInitializer from './webgl';
import Link from 'next/link';
const inter = Inter({ subsets: ['latin'] });

export default function Hero({}) {
	return (
		<div className="align-center flex flex h-screen flex-col items-center justify-center justify-center">
			<div className="xmin-h-screen webgl absolute absolute -top-[10vh] flex w-full sm:top-0">
				<WebGLInitializer />
			</div>
			<Content />
		</div>
	);
}

function Content() {
	return (
		<div className="z-10 mt-24 grid min-h-[75vh] w-[90vw] grid-rows-[auto_1fr_auto] gap-4 p-6 sm:mt-28 sm:min-h-[85vh] sm:w-[76vw]">
			<div className="col-span-2 flex items-center justify-between">
				<div className={cn('flex items-center', inter.className)}>
					<div className="mr-4 hidden size-4 rounded-full bg-muted-foreground/70 sm:block"></div>
					<span className="text-sm text-muted-foreground/70 2xl:text-[1vw] 2xl:leading-[1vw]">
						dev local-first
					</span>
				</div>

				<div className={cn('flex items-center', inter.className)}>
					<span className="text-sm text-muted-foreground/70 2xl:text-[1vw] 2xl:leading-[1vw]">
						deploy serverless
					</span>
					<div className="ml-4 hidden size-4 rounded-full bg-muted-foreground/70 sm:block"></div>
				</div>
			</div>

			<div className="col-span-2"></div>

			<div className="col-span-2 flex w-full flex-col-reverse items-center justify-between lg:flex-row lg:items-start">
				<div className={cn('self-end lg:max-w-[60%]', inter.className)}>
					<div
						className="text-center text-sm text-sm lg:text-left lg:text-left
					
					2xl:text-[1vw] 2xl:text-[1vw] 2xl:leading-[1.5vw] 2xl:leading-[1.5vw]"
					>
						<div className="flex items-center justify-center lg:justify-start">
							<div className="mr-4 hidden size-4 rounded-full bg-muted-foreground/70 sm:block"></div>
							<span className="text-sm text-muted-foreground/70 2xl:text-[1vw] 2xl:leading-[1vw]">
								<strong className="mr-2 text-white">
									Base AI
								</strong>
								<span className="text-muted-foreground/90">
									The first Web AI Framework.
								</span>
							</span>
						</div>
						<p className="mt-4 text-sm text-muted-foreground/90 2xl:text-[1vw] 2xl:leading-[1.5vw]">
							The easiest way to build serverless autonomous AI
							agents with memory. Start building local-first,
							agentic pipes, tools, and memory. Deploy serverless
							with one command.
						</p>
					</div>

					<div className="mt-4 flex justify-center space-x-2 lg:justify-start ">
						<Anchor
							variant="default"
							href="/docs"
							aria-label="Get Started"
						>
							<IconDocs className="size-4" />
							<span className={inter.className}>Get Started</span>
						</Anchor>
						<Anchor
							variant="secondary"
							href="/learn"
							aria-label="Learn BaseAI"
						>
							Learn BaseAI
						</Anchor>
					</div>

					<CopyableCommand command="npx baseai@latest init" />
					<div className="flex text-muted-foreground/70 w-full items-center justify-center text-md lg:hidden">
						<Socials />
					</div>
				</div>

				<div className="mb-5 flex w-full flex-col items-center justify-center lg:mb-0 lg:min-h-full lg:w-[40%] lg:justify-between">
					<div className="flex w-full items-center justify-center lg:mb-0 lg:justify-end">
						<span className="text-sm text-muted-foreground/70 2xl:text-[1vw] 2xl:leading-[1vw]">
							agentic{' '}
							<span className="text-muted-foreground/20">(</span>{' '}
							pipes{' '}
							<span className="text-muted-foreground/20">|</span>{' '}
							tools{' '}
							<span className="text-muted-foreground/20">|</span>{' '}
							memory{' '}
							<span className="text-muted-foreground/20">)</span>
						</span>
						<div className="ml-4 hidden size-4 rounded-full bg-muted-foreground/70 lg:block"></div>
					</div>
					<div className="hidden text-muted-foreground/70 w-full items-center justify-center text-lg lg:mb-5 lg:flex lg:justify-end">
						<Socials />
						
					</div>
				</div>
			</div>
		</div>
	);
}

interface CopyableCommandProps {
	command: string;
}

function Socials() {
	return (
		<>
			<Link
				href={'https://github.com/LangbaseInc/'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<svg
					className="mr-4 h-[1em] w-[1em] cursor-pointer"
					viewBox="0 0 19 18"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M9.5 0C8.25244 0 7.0171 0.238571 5.86451 0.702093C4.71191 1.16561 3.66464 1.84501 2.78249 2.70148C1.00089 4.43122 0 6.77723 0 9.22344C0 13.3002 2.7265 16.759 6.498 17.9857C6.973 18.0595 7.125 17.7736 7.125 17.5245V15.9658C4.4935 16.5192 3.933 14.7298 3.933 14.7298C3.496 13.6599 2.8785 13.374 2.8785 13.374C2.014 12.8021 2.945 12.8206 2.945 12.8206C3.895 12.8851 4.3985 13.7706 4.3985 13.7706C5.225 15.1726 6.6215 14.7575 7.163 14.5361C7.2485 13.9366 7.4955 13.5308 7.7615 13.3002C5.6525 13.0696 3.439 12.2764 3.439 8.76227C3.439 7.73847 3.8 6.91758 4.4175 6.26272C4.3225 6.03213 3.99 5.07289 4.5125 3.82773C4.5125 3.82773 5.3105 3.5787 7.125 4.76852C7.8755 4.5656 8.6925 4.46415 9.5 4.46415C10.3075 4.46415 11.1245 4.5656 11.875 4.76852C13.6895 3.5787 14.4875 3.82773 14.4875 3.82773C15.01 5.07289 14.6775 6.03213 14.5825 6.26272C15.2 6.91758 15.561 7.73847 15.561 8.76227C15.561 12.2856 13.338 13.0604 11.2195 13.291C11.5615 13.5769 11.875 14.1395 11.875 14.9973V17.5245C11.875 17.7736 12.027 18.0687 12.5115 17.9857C16.283 16.7498 19 13.3002 19 9.22344C19 8.0122 18.7543 6.81282 18.2769 5.69378C17.7994 4.57474 17.0997 3.55796 16.2175 2.70148C15.3354 1.84501 14.2881 1.16561 13.1355 0.702093C11.9829 0.238571 10.7476 0 9.5 0Z"
						fill="currentColor"
					/>
				</svg>
			</Link>
			<Link
				href={'https://discord.com/invite/qz6VsMtvXU'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<svg
					className="mr-4 h-[1em] w-[1em] cursor-pointer"
					viewBox="0 0 20 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M16.9225 1.32966C15.6558 0.709816 14.2844 0.259933 12.8557 0C12.8306 0.000375608 12.8067 0.0111559 12.7891 0.0299924C12.6176 0.359907 12.4176 0.789795 12.2843 1.11971C10.769 0.879923 9.22804 0.879923 7.71275 1.11971C7.57941 0.779798 7.37941 0.359907 7.19845 0.0299924C7.18893 0.00999762 7.16035 0 7.13178 0C5.70317 0.259933 4.34123 0.709816 3.065 1.32966C3.05548 1.32966 3.04595 1.33965 3.03643 1.34965C0.445883 5.4186 -0.268423 9.37757 0.0839681 13.2966C0.0839681 13.3166 0.0934922 13.3365 0.11254 13.3465C1.82687 14.6662 3.47454 15.466 5.10315 15.9959C5.13173 16.0059 5.1603 15.9959 5.16982 15.9759C5.55078 15.426 5.89365 14.8462 6.1889 14.2363C6.20795 14.1963 6.1889 14.1563 6.1508 14.1463C5.60793 13.9264 5.09363 13.6665 4.58885 13.3665C4.55076 13.3465 4.55076 13.2866 4.57933 13.2566C4.68409 13.1766 4.78886 13.0866 4.89362 13.0066C4.91267 12.9866 4.94124 12.9866 4.96029 12.9966C8.23657 14.5662 11.77 14.5662 15.0082 12.9966C15.0272 12.9866 15.0558 12.9866 15.0749 13.0066C15.1796 13.0966 15.2844 13.1766 15.3891 13.2666C15.4272 13.2966 15.4272 13.3565 15.3796 13.3765C14.8844 13.6865 14.3606 13.9364 13.8177 14.1563C13.7796 14.1663 13.7701 14.2163 13.7796 14.2463C14.0844 14.8562 14.4272 15.436 14.7987 15.9859C14.8272 15.9959 14.8558 16.0059 14.8844 15.9959C16.5225 15.466 18.1702 14.6662 19.8845 13.3465C19.9036 13.3365 19.9131 13.3166 19.9131 13.2966C20.3321 8.76773 19.2178 4.83875 16.9606 1.34965C16.9511 1.33965 16.9416 1.32966 16.9225 1.32966ZM6.68415 10.9072C5.70317 10.9072 4.8841 9.95742 4.8841 8.78773C4.8841 7.61803 5.68412 6.66827 6.68415 6.66827C7.6937 6.66827 8.49372 7.62803 8.4842 8.78773C8.4842 9.95742 7.68418 10.9072 6.68415 10.9072ZM13.3224 10.9072C12.3414 10.9072 11.5224 9.95742 11.5224 8.78773C11.5224 7.61803 12.3224 6.66827 13.3224 6.66827C14.332 6.66827 15.132 7.62803 15.1225 8.78773C15.1225 9.95742 14.332 10.9072 13.3224 10.9072Z"
						fill="currentColor"
					/>
				</svg>
			</Link>
			<Link
				href={'https://x.com/langbaseinc'}
				target="_blank"
				rel="noopener noreferrer"
			>
				<svg
					className="h-[1em] w-[1em] cursor-pointer"
					viewBox="0 0 18 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M14.3819 0.417969H16.9932L11.289 6.95414L18.0003 15.8499H12.746L8.62778 10.4557L3.92087 15.8499H1.30713L7.40788 8.85637L0.972656 0.419185H6.36068L10.0776 5.34868L14.3819 0.417969ZM13.4636 14.2833H14.911L5.57011 1.90302H4.01817L13.4636 14.2833Z"
						fill="currentColor"
					/>
				</svg>
			</Link>
		</>
	);
}

function CopyableCommand({ command }: CopyableCommandProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	};

	return (
		<div
			className="group my-4 flex w-full cursor-pointer items-center justify-center font-mono text-sm transition-colors lg:items-start lg:justify-start "
			// "mx-auto mt-8 flex w-full items-center justify-center space-x-2 lg:items-start lg:justify-start"
			onClick={copyToClipboard}
			role="button"
			tabIndex={0}
			onKeyDown={e => e.key === 'Enter' && copyToClipboard()}
			aria-label={`Copy command: ${command}`}
		>
			<div className="group flex items-center space-x-2 transition-colors group-hover:text-indigo-400">
				<span className="text-muted-foreground/50 group-hover:text-indigo-400 sm:text-sm 2xl:text-[1vw] 2xl:leading-[1.5vw]">
					<span className="xtext-indigo-400">⌘</span>
					<span className="group-hover:text-muted-foreground/50">
						{' '}
						~
					</span>
				</span>
				<span className="font-mono text-muted-foreground/50 transition-colors group-hover:text-indigo-400 sm:text-sm 2xl:leading-[1.5vw] ">
					{command}
				</span>
				<div className="ml-2 text-muted-foreground/50 transition-colors group-hover:text-indigo-400 sm:text-sm 2xl:leading-[1.5vw]">
					{copied ? (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-[1em] w-[1em]"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fillRule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clipRule="evenodd"
							/>
						</svg>
					) : (
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-[1em] w-[1em]"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					)}
				</div>
			</div>
		</div>
	);
}
