import Content from '../../../components/content';
import docsContent from '../../../../content/docs/docs.json';
import { ContentT } from '@/types/markdown';

export default async function SingleDocPage({
	params
}: {
	params: { section: string };
}) {
	let content: ContentT;

	if (process.env.NODE_ENV === 'production') {
		const docContent = docsContent.find(
			doc => doc.slug === params.section && doc.section === 'docs'
		);

		content = docContent?.content;
	} else {
		// dynamically import the file
		const { getContentBySlugOnDev } = await import('@/lib/get-content-by-slug-on-dev');

		let data = await getContentBySlugOnDev({
			type: 'docs',
			slug: params.section,
			section: 'docs',
		});

		if (!data.content) {
			data = await getContentBySlugOnDev({
				type: 'docs',
				slug: 'index',
				section: params.section
			});
		}

		content = data.content;
	}

	return <Content content={content} />;
}
