import Content from '../../../../components/content';
import docsContent from '../../../../../content/docs/docs.json';
import { ContentT } from '@/types/markdown';

export default async function SingleDocPage({
	params
}: {
	params: { section: string; slug: string };
}) {
	let content: ContentT;

	if (process.env.NODE_ENV === 'production') {
		const docContent = docsContent.find(
			doc => doc.slug === params.slug && doc.section === params.section
		);

		content = docContent?.content;
	} else {
		// dynamically import the file
		const { getContentBySlugOnDev } = await import('@/lib/get-content-by-slug-on-dev');

		const data = await getContentBySlugOnDev({
			type: 'docs',
			slug: params.slug,
			section: params.section,
		});

		content = data.content;
	}

	return <Content content={content} />;
}
