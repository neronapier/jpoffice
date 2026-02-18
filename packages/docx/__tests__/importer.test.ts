import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { importDocx } from '../src/importer/docx-importer';

/**
 * Helpers to construct minimal .docx ZIP archives programmatically.
 * This avoids depending on external fixture files.
 */

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

function makeDocumentXml(bodyContent: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyContent}</w:body>
</w:document>`;
}

function buildDocx(documentXml: string, extras?: Record<string, string>): Uint8Array {
	const zipData: Record<string, Uint8Array> = {
		'[Content_Types].xml': strToU8(CONTENT_TYPES_XML),
		'_rels/.rels': strToU8(RELS_XML),
		'word/_rels/document.xml.rels': strToU8(DOC_RELS_XML),
		'word/document.xml': strToU8(documentXml),
	};
	if (extras) {
		for (const [path, content] of Object.entries(extras)) {
			zipData[path] = strToU8(content);
		}
	}
	return zipSync(zipData);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DOCX Importer', () => {
	it('imports an empty document', () => {
		const xml = makeDocumentXml('');
		const docx = buildDocx(xml);
		const doc = importDocx(docx);

		expect(doc.type).toBe('document');
		expect(doc.children).toHaveLength(1); // body
		const body = doc.children[0];
		expect(body.type).toBe('body');
		// At least one section (default)
		expect(body.children.length).toBeGreaterThanOrEqual(1);
	});

	it('imports a single paragraph with text', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:t>Hello World</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const body = doc.children[0];
		const section = body.children[0];
		expect(section.type).toBe('section');

		const para = section.children[0];
		expect(para.type).toBe('paragraph');

		// Find text content
		const run = para.children[0];
		expect(run.type).toBe('run');
		expect(run.children[0].type).toBe('text');
		expect(run.children[0].text).toBe('Hello World');
	});

	it('imports bold and italic formatting', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:rPr><w:b/><w:i/></w:rPr>
					<w:t>Formatted</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		const para = section.children[0];
		const run = para.children[0];
		expect(run.type).toBe('run');
		expect(run.properties.bold).toBe(true);
		expect(run.properties.italic).toBe(true);
	});

	it('imports font size and color', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:rPr>
						<w:sz w:val="28"/>
						<w:color w:val="FF0000"/>
					</w:rPr>
					<w:t>Red text</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const run = doc.children[0].children[0].children[0].children[0];
		expect(run.properties.fontSize).toBe(28);
		expect(run.properties.color).toBe('FF0000');
	});

	it('imports paragraph alignment', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr><w:jc w:val="center"/></w:pPr>
				<w:r><w:t>Centered</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.alignment).toBe('center');
	});

	it('maps "both" alignment to "justify"', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr><w:jc w:val="both"/></w:pPr>
				<w:r><w:t>Justified</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.alignment).toBe('justify');
	});

	it('imports multiple paragraphs', () => {
		const xml = makeDocumentXml(`
			<w:p><w:r><w:t>First</w:t></w:r></w:p>
			<w:p><w:r><w:t>Second</w:t></w:r></w:p>
			<w:p><w:r><w:t>Third</w:t></w:r></w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		expect(section.children).toHaveLength(3);
		expect(section.children[0].children[0].children[0].text).toBe('First');
		expect(section.children[1].children[0].children[0].text).toBe('Second');
		expect(section.children[2].children[0].children[0].text).toBe('Third');
	});

	it('imports section properties (page size and margins)', () => {
		const xml = makeDocumentXml(`
			<w:p><w:r><w:t>Content</w:t></w:r></w:p>
			<w:sectPr>
				<w:pgSz w:w="12240" w:h="15840"/>
				<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"
				         w:header="720" w:footer="720" w:gutter="0"/>
			</w:sectPr>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		expect(section.properties.pageSize.width).toBe(12240);
		expect(section.properties.pageSize.height).toBe(15840);
		expect(section.properties.margins.right).toBe(1800);
		expect(section.properties.margins.left).toBe(1800);
	});

	it('imports landscape orientation', () => {
		const xml = makeDocumentXml(`
			<w:p><w:r><w:t>Landscape</w:t></w:r></w:p>
			<w:sectPr>
				<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
				<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
				         w:header="720" w:footer="720" w:gutter="0"/>
			</w:sectPr>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		expect(section.properties.orientation).toBe('landscape');
	});

	it('imports paragraph style reference', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
				<w:r><w:t>Title</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.styleId).toBe('Heading1');
	});

	it('imports paragraph spacing', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr>
					<w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/>
				</w:pPr>
				<w:r><w:t>Spaced</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.spacing.before).toBe(240);
		expect(para.properties.spacing.after).toBe(120);
		expect(para.properties.spacing.line).toBe(360);
		expect(para.properties.spacing.lineRule).toBe('auto');
	});

	it('imports paragraph indentation', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr>
					<w:ind w:left="720" w:firstLine="360"/>
				</w:pPr>
				<w:r><w:t>Indented</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.indent.left).toBe(720);
		expect(para.properties.indent.firstLine).toBe(360);
	});

	it('imports numbering reference', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr>
					<w:numPr>
						<w:ilvl w:val="0"/>
						<w:numId w:val="1"/>
					</w:numPr>
				</w:pPr>
				<w:r><w:t>List item</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.numbering).toEqual({ numId: 1, level: 0 });
	});

	it('imports styles.xml', () => {
		const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
  </w:style>
</w:styles>`;

		const xml = makeDocumentXml('<w:p><w:r><w:t>Styled</w:t></w:r></w:p>');
		const docx = buildDocx(xml, { 'word/styles.xml': stylesXml });
		const doc = importDocx(docx);

		expect(doc.styles.styles.length).toBeGreaterThanOrEqual(2);
		const normal = doc.styles.styles.find((s) => s.id === 'Normal');
		expect(normal).toBeDefined();
		expect(normal?.isDefault).toBe(true);

		const h1 = doc.styles.styles.find((s) => s.id === 'Heading1');
		expect(h1).toBeDefined();
		expect(h1?.basedOn).toBe('Normal');
	});

	it('imports numbering.xml', () => {
		const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

		const xml = makeDocumentXml('<w:p><w:r><w:t>Numbered</w:t></w:r></w:p>');
		const docx = buildDocx(xml, { 'word/numbering.xml': numberingXml });
		const doc = importDocx(docx);

		expect(doc.numbering.abstractNumberings).toHaveLength(1);
		expect(doc.numbering.instances).toHaveLength(1);
		expect(doc.numbering.instances[0].numId).toBe(1);
		expect(doc.numbering.abstractNumberings[0].levels[0].format).toBe('decimal');
	});

	it('imports document metadata from core.xml', () => {
		const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test Document</dc:title>
  <dc:creator>Test Author</dc:creator>
  <dc:description>A test document</dc:description>
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created>
</cp:coreProperties>`;

		const relsWithCore = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

		const xml = makeDocumentXml('<w:p><w:r><w:t>Metadata</w:t></w:r></w:p>');
		const docx = buildDocx(xml, {
			'docProps/core.xml': coreXml,
			'_rels/.rels': relsWithCore,
		});
		const doc = importDocx(docx);

		expect(doc.metadata.title).toBe('Test Document');
		expect(doc.metadata.author).toBe('Test Author');
		expect(doc.metadata.description).toBe('A test document');
		expect(doc.metadata.created).toBe('2024-01-01T00:00:00Z');
	});

	it('imports a simple table', () => {
		const xml = makeDocumentXml(`
			<w:tbl>
				<w:tr>
					<w:tc>
						<w:p><w:r><w:t>Cell 1</w:t></w:r></w:p>
					</w:tc>
					<w:tc>
						<w:p><w:r><w:t>Cell 2</w:t></w:r></w:p>
					</w:tc>
				</w:tr>
			</w:tbl>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		const table = section.children[0];
		expect(table.type).toBe('table');
		expect(table.children).toHaveLength(1); // 1 row
		expect(table.children[0].type).toBe('table-row');
		expect(table.children[0].children).toHaveLength(2); // 2 cells

		const cell1 = table.children[0].children[0];
		expect(cell1.type).toBe('table-cell');
		expect(cell1.children[0].type).toBe('paragraph');
		expect(cell1.children[0].children[0].children[0].text).toBe('Cell 1');
	});

	it('imports underline style', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:rPr><w:u w:val="single"/></w:rPr>
					<w:t>Underlined</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const run = doc.children[0].children[0].children[0].children[0];
		expect(run.properties.underline).toBe('single');
	});

	it('imports font family', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:rPr><w:rFonts w:ascii="Arial"/></w:rPr>
					<w:t>Arial text</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const run = doc.children[0].children[0].children[0].children[0];
		expect(run.properties.fontFamily).toBe('Arial');
	});

	it('imports toggle properties with explicit val="0" as false', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:r>
					<w:rPr><w:b w:val="0"/></w:rPr>
					<w:t>Not bold</w:t>
				</w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const run = doc.children[0].children[0].children[0].children[0];
		expect(run.properties.bold).toBeUndefined();
	});

	it('imports multiple sections', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr>
					<w:sectPr>
						<w:pgSz w:w="12240" w:h="15840"/>
						<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
						         w:header="720" w:footer="720" w:gutter="0"/>
					</w:sectPr>
				</w:pPr>
				<w:r><w:t>Section 1</w:t></w:r>
			</w:p>
			<w:p><w:r><w:t>Section 2</w:t></w:r></w:p>
			<w:sectPr>
				<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>
				<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
				         w:header="720" w:footer="720" w:gutter="0"/>
			</w:sectPr>
		`);
		const doc = importDocx(buildDocx(xml));

		const body = doc.children[0];
		expect(body.children).toHaveLength(2); // 2 sections

		const section1 = body.children[0];
		expect(section1.properties.pageSize.width).toBe(12240);
		expect(section1.properties.orientation).toBe('portrait');

		const section2 = body.children[1];
		expect(section2.properties.pageSize.width).toBe(15840);
		expect(section2.properties.orientation).toBe('landscape');
	});

	it('imports columns configuration', () => {
		const xml = makeDocumentXml(`
			<w:p><w:r><w:t>Columns</w:t></w:r></w:p>
			<w:sectPr>
				<w:pgSz w:w="12240" w:h="15840"/>
				<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
				         w:header="720" w:footer="720" w:gutter="0"/>
				<w:cols w:num="2" w:space="720"/>
			</w:sectPr>
		`);
		const doc = importDocx(buildDocx(xml));

		const section = doc.children[0].children[0];
		expect(section.properties.columns).toBeDefined();
		expect(section.properties.columns?.count).toBe(2);
		expect(section.properties.columns?.space).toBe(720);
	});

	it('imports keepNext and keepLines paragraph properties', () => {
		const xml = makeDocumentXml(`
			<w:p>
				<w:pPr>
					<w:keepNext/>
					<w:keepLines/>
				</w:pPr>
				<w:r><w:t>Keep together</w:t></w:r>
			</w:p>
		`);
		const doc = importDocx(buildDocx(xml));

		const para = doc.children[0].children[0].children[0];
		expect(para.properties.keepNext).toBe(true);
		expect(para.properties.keepLines).toBe(true);
	});
});
