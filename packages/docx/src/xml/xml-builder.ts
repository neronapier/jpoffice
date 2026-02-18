/**
 * Zero-dependency XML string builder for generating OOXML.
 * Builds XML via string concatenation — no DOM needed for export.
 */
export class XmlBuilder {
	private parts: string[] = [];
	private stack: string[] = [];
	private tagOpen = false;

	/** Add XML declaration. */
	declaration(): this {
		this.parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
		return this;
	}

	/** Open an element with optional attributes. */
	open(tag: string, attrs?: Record<string, string | number | boolean | undefined>): this {
		this.closeTag();
		this.parts.push(`<${tag}`);
		this.writeAttrs(attrs);
		this.stack.push(tag);
		this.tagOpen = true;
		return this;
	}

	/** Write a self-closing element with optional attributes. */
	empty(tag: string, attrs?: Record<string, string | number | boolean | undefined>): this {
		this.closeTag();
		this.parts.push(`<${tag}`);
		this.writeAttrs(attrs);
		this.parts.push('/>');
		return this;
	}

	/** Close the current open element. */
	close(): this {
		const tag = this.stack.pop()!;
		if (this.tagOpen) {
			this.parts.push('/>');
			this.tagOpen = false;
		} else {
			this.parts.push(`</${tag}>`);
		}
		return this;
	}

	/** Add escaped text content. */
	text(content: string): this {
		this.closeTag();
		this.parts.push(escapeText(content));
		return this;
	}

	/** Add raw XML string (no escaping). Use with caution. */
	raw(xml: string): this {
		this.closeTag();
		this.parts.push(xml);
		return this;
	}

	/** Build the final XML string. */
	build(): string {
		return this.parts.join('');
	}

	private closeTag(): void {
		if (this.tagOpen) {
			this.parts.push('>');
			this.tagOpen = false;
		}
	}

	private writeAttrs(
		attrs: Record<string, string | number | boolean | undefined> | undefined,
	): void {
		if (!attrs) return;
		for (const key of Object.keys(attrs)) {
			const v = attrs[key];
			if (v === undefined || v === false) continue;
			const val = v === true ? key : String(v);
			this.parts.push(` ${key}="${escapeAttr(val)}"`);
		}
	}
}

function escapeAttr(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
