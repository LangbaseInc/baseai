export function OpenLink(props: React.ComponentPropsWithoutRef<'svg'>) {
	return (
		<svg
			{...props}
			aria-hidden="true"
			viewBox="0 0 9 9"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M3.60904 1H1.86968C1.63903 1 1.41782 1.09163 1.25472 1.25472C1.09163 1.41782 1 1.63903 1 1.86968V7.08777C1 7.31842 1.09163 7.53963 1.25472 7.70272C1.41782 7.86582 1.63903 7.95745 1.86968 7.95745H7.08777C7.31842 7.95745 7.53963 7.86582 7.70272 7.70272C7.86582 7.53963 7.95745 7.31842 7.95745 7.08777V5.3484M4.47872 4.47872L7.95745 1M7.95745 1V3.1742M7.95745 1H5.78324"
				stroke="currentColor"
				strokeWidth="0.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
