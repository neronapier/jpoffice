'use client';

import {
	DEFAULT_SECTION_PROPERTIES,
	createBody,
	createDocument,
	createParagraph,
	createRun,
	createSection,
	createText,
	generateId,
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
			<JPOfficeEditor
				document={doc}
				showMenuBar
				showTitleBar
				title="JPOffice Demo"
				style={{ height: '100%' }}
				onEditorReady={(editor) => {
					console.log('Editor ready:', editor);
					const sel = {
						anchor: { path: [0, 0, 2, 0, 0], offset: 0 },
						focus: { path: [0, 0, 2, 0, 0], offset: 0 },
					};
					editor.setSelection(sel);
				}}
			/>
		</div>
	);
}
