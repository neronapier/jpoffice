'use client';

import {
	createDocument,
	createBody,
	createSection,
	createParagraph,
	createRun,
	createText,
	generateId,
	DEFAULT_SECTION_PROPERTIES,
} from '@jpoffice/model';
import { JPOfficeEditor } from '@jpoffice/react';

function createSampleDocument() {
	const titlePara = createParagraph(
		generateId(),
		[
			createRun(generateId(), [createText(generateId(), 'JPOffice Demo')], {
				bold: true,
				fontSize: 48,
			}),
		],
		{ alignment: 'center' },
	);

	const bodyPara = createParagraph(generateId(), [
		createRun(generateId(), [
			createText(
				generateId(),
				'This is a demo of the JPOffice word processor. You can type text, press Enter to create new paragraphs, and use Backspace to delete. Try formatting with Ctrl+B (bold), Ctrl+I (italic), or Ctrl+U (underline).',
			),
		]),
	]);

	const emptyPara = createParagraph(generateId(), [
		createRun(generateId(), [createText(generateId(), '')]),
	]);

	const section = createSection(
		generateId(),
		[titlePara, bodyPara, emptyPara],
		DEFAULT_SECTION_PROPERTIES,
	);

	const body = createBody(generateId(), [section]);
	return createDocument({ id: generateId(), body });
}

export default function Page() {
	const doc = createSampleDocument();

	return (
		<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
			<header
				style={{
					padding: '12px 24px',
					borderBottom: '1px solid #e0e0e0',
					backgroundColor: '#fff',
				}}
			>
				<h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>JPOffice</h1>
			</header>
			<main style={{ flex: 1, overflow: 'hidden' }}>
				<JPOfficeEditor
					document={doc}
					style={{ height: '100%' }}
					onEditorReady={(editor) => {
						console.log('Editor ready:', editor);
						// Set initial cursor at the end of the empty paragraph
						const sel = {
							anchor: { path: [0, 0, 2, 0, 0], offset: 0 },
							focus: { path: [0, 0, 2, 0, 0], offset: 0 },
						};
						editor.setSelection(sel);
					}}
				/>
			</main>
		</div>
	);
}
