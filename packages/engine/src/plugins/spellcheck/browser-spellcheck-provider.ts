import type { SpellCheckProvider, SpellError } from './spellcheck-types';

/**
 * A minimal, built-in dictionary of common English words.
 * This is a fallback provider -- real spell checking should use
 * nspell/hunspell, a server API, or the browser's built-in spellcheck.
 */
const COMMON_WORDS = new Set([
	// Articles & determiners
	'a',
	'an',
	'the',
	'this',
	'that',
	'these',
	'those',
	'my',
	'your',
	'his',
	'her',
	'its',
	'our',
	'their',
	'some',
	'any',
	'no',
	'every',
	'each',
	'all',
	'both',
	'few',
	'more',
	'most',
	'other',
	'such',
	'much',
	'many',

	// Pronouns
	'i',
	'me',
	'we',
	'us',
	'you',
	'he',
	'him',
	'she',
	'it',
	'they',
	'them',
	'who',
	'whom',
	'what',
	'which',
	'whose',
	'myself',
	'yourself',
	'himself',
	'herself',
	'itself',
	'ourselves',
	'themselves',

	// Prepositions
	'in',
	'on',
	'at',
	'to',
	'for',
	'with',
	'about',
	'against',
	'between',
	'through',
	'during',
	'before',
	'after',
	'above',
	'below',
	'from',
	'up',
	'down',
	'out',
	'off',
	'over',
	'under',
	'again',
	'further',
	'then',
	'once',
	'into',
	'of',
	'by',
	'as',
	'until',
	'while',
	'near',
	'along',
	'across',
	'behind',
	'beyond',
	'within',
	'without',
	'around',
	'among',
	'upon',
	'toward',
	'towards',

	// Conjunctions
	'and',
	'but',
	'or',
	'nor',
	'so',
	'yet',
	'because',
	'although',
	'since',
	'unless',
	'if',
	'when',
	'where',
	'how',
	'than',
	'whether',
	'either',
	'neither',

	// Common verbs
	'be',
	'am',
	'is',
	'are',
	'was',
	'were',
	'been',
	'being',
	'have',
	'has',
	'had',
	'having',
	'do',
	'does',
	'did',
	'doing',
	'done',
	'will',
	'would',
	'shall',
	'should',
	'may',
	'might',
	'must',
	'can',
	'could',
	'go',
	'goes',
	'went',
	'gone',
	'going',
	'come',
	'comes',
	'came',
	'coming',
	'take',
	'takes',
	'took',
	'taken',
	'taking',
	'make',
	'makes',
	'made',
	'making',
	'get',
	'gets',
	'got',
	'getting',
	'give',
	'gives',
	'gave',
	'given',
	'giving',
	'know',
	'knows',
	'knew',
	'known',
	'knowing',
	'think',
	'thinks',
	'thought',
	'thinking',
	'say',
	'says',
	'said',
	'saying',
	'see',
	'sees',
	'saw',
	'seen',
	'seeing',
	'want',
	'wants',
	'wanted',
	'wanting',
	'use',
	'uses',
	'used',
	'using',
	'find',
	'finds',
	'found',
	'finding',
	'tell',
	'tells',
	'told',
	'telling',
	'ask',
	'asks',
	'asked',
	'asking',
	'work',
	'works',
	'worked',
	'working',
	'call',
	'calls',
	'called',
	'calling',
	'try',
	'tries',
	'tried',
	'trying',
	'need',
	'needs',
	'needed',
	'needing',
	'feel',
	'feels',
	'felt',
	'feeling',
	'become',
	'becomes',
	'became',
	'leave',
	'leaves',
	'left',
	'leaving',
	'put',
	'puts',
	'putting',
	'mean',
	'means',
	'meant',
	'keep',
	'keeps',
	'kept',
	'keeping',
	'let',
	'lets',
	'letting',
	'begin',
	'begins',
	'began',
	'begun',
	'show',
	'shows',
	'showed',
	'shown',
	'hear',
	'hears',
	'heard',
	'play',
	'plays',
	'played',
	'playing',
	'run',
	'runs',
	'ran',
	'running',
	'move',
	'moves',
	'moved',
	'moving',
	'live',
	'lives',
	'lived',
	'living',
	'believe',
	'turn',
	'turns',
	'turned',
	'write',
	'writes',
	'wrote',
	'written',
	'writing',
	'read',
	'reads',
	'set',
	'sets',
	'setting',
	'learn',
	'change',
	'changes',
	'changed',
	'help',
	'helps',
	'helped',
	'follow',
	'follows',
	'stop',
	'stops',
	'stopped',
	'create',
	'speak',
	'open',
	'opened',
	'close',
	'closed',
	'start',
	'started',
	'hold',
	'holds',
	'held',

	// Common nouns
	'time',
	'year',
	'people',
	'way',
	'day',
	'man',
	'woman',
	'child',
	'children',
	'world',
	'life',
	'hand',
	'part',
	'place',
	'case',
	'week',
	'company',
	'system',
	'program',
	'question',
	'work',
	'government',
	'number',
	'night',
	'point',
	'home',
	'water',
	'room',
	'mother',
	'area',
	'money',
	'story',
	'fact',
	'month',
	'lot',
	'right',
	'study',
	'book',
	'eye',
	'job',
	'word',
	'business',
	'issue',
	'side',
	'kind',
	'head',
	'house',
	'service',
	'friend',
	'father',
	'power',
	'hour',
	'game',
	'line',
	'end',
	'member',
	'law',
	'car',
	'city',
	'community',
	'name',
	'president',
	'team',
	'minute',
	'idea',
	'body',
	'information',
	'back',
	'parent',
	'face',
	'others',
	'level',
	'office',
	'door',
	'health',
	'person',
	'art',
	'war',
	'history',
	'party',
	'result',
	'morning',
	'reason',
	'research',
	'girl',
	'guy',
	'moment',
	'air',
	'teacher',
	'force',
	'education',
	'food',
	'letter',
	'paper',
	'document',
	'page',
	'file',
	'text',
	'data',
	'table',
	'list',
	'view',
	'color',
	'image',
	'button',
	'title',
	'field',

	// Common adjectives
	'good',
	'new',
	'first',
	'last',
	'long',
	'great',
	'little',
	'own',
	'old',
	'right',
	'big',
	'high',
	'different',
	'small',
	'large',
	'next',
	'early',
	'young',
	'important',
	'public',
	'bad',
	'same',
	'able',
	'free',
	'sure',
	'true',
	'real',
	'full',
	'best',
	'better',
	'whole',
	'possible',
	'left',
	'hard',
	'clear',
	'simple',
	'easy',
	'strong',
	'special',
	'short',
	'single',
	'personal',
	'local',
	'current',
	'low',
	'open',
	'available',
	'ready',
	'common',
	'human',
	'red',
	'blue',
	'green',
	'white',
	'black',

	// Common adverbs
	'not',
	'also',
	'very',
	'often',
	'however',
	'too',
	'usually',
	'really',
	'already',
	'always',
	'never',
	'sometimes',
	'together',
	'likely',
	'simply',
	'generally',
	'instead',
	'actually',
	'here',
	'there',
	'now',
	'only',
	'just',
	'well',
	'still',
	'even',
	'back',
	'also',
	'quite',
	'enough',
	'almost',
	'perhaps',
	'rather',
	'today',
	'yesterday',
	'tomorrow',

	// Numbers
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'hundred',
	'thousand',
	'million',

	// Other common words
	'yes',
	'no',
	'not',
	'don',
	'doesn',
	'didn',
	'won',
	'wouldn',
	'couldn',
	'shouldn',
	'isn',
	'aren',
	'wasn',
	'weren',
	'hasn',
	'haven',
	'hadn',
	"don't",
	"doesn't",
	"didn't",
	"won't",
	"wouldn't",
	"couldn't",
	"shouldn't",
	"isn't",
	"aren't",
	"wasn't",
	"weren't",
	"hasn't",
	"haven't",
	"hadn't",
	'ok',
	'okay',
	'hello',
	'please',
	'thank',
	'thanks',
	'sorry',
]);

/** Regex to split text into words (keeps track of positions) */
const WORD_RE = /[a-zA-Z'\u00C0-\u024F]+/g;

/**
 * BrowserSpellCheckProvider is a minimal, zero-dependency fallback
 * spell checker that uses a small built-in dictionary of common English words.
 *
 * For production use, consumers should provide their own SpellCheckProvider
 * that uses a full dictionary (nspell, hunspell, or an API).
 */
export class BrowserSpellCheckProvider implements SpellCheckProvider {
	private personalDictionary = new Set<string>();

	async check(text: string, _language?: string): Promise<SpellError[]> {
		const errors: SpellError[] = [];
		let match: RegExpExecArray | null = null;

		// Reset regex state
		WORD_RE.lastIndex = 0;

		match = WORD_RE.exec(text);
		while (match !== null) {
			const word = match[0];
			const lower = word.toLowerCase();

			// Skip single-character words, all-caps abbreviations (2-3 chars)
			if (word.length <= 1) {
				match = WORD_RE.exec(text);
				continue;
			}
			if (word.length <= 3 && word === word.toUpperCase()) {
				match = WORD_RE.exec(text);
				continue;
			}

			if (!COMMON_WORDS.has(lower) && !this.personalDictionary.has(lower)) {
				errors.push({
					path: [], // will be filled by the plugin
					offset: match.index,
					length: word.length,
					word,
					suggestions: this.generateSuggestions(lower),
					type: 'spelling',
				});
			}

			match = WORD_RE.exec(text);
		}

		return errors;
	}

	addToPersonalDictionary(word: string): void {
		this.personalDictionary.add(word.toLowerCase());
	}

	async getSuggestions(word: string): Promise<string[]> {
		return this.generateSuggestions(word.toLowerCase());
	}

	/**
	 * Generate simple suggestions by finding dictionary words
	 * within edit distance 1-2 of the misspelled word.
	 */
	private generateSuggestions(word: string): string[] {
		const suggestions: string[] = [];
		const maxSuggestions = 5;

		for (const dictWord of COMMON_WORDS) {
			if (suggestions.length >= maxSuggestions) break;

			// Quick length check: only consider words within +/- 2 characters
			if (Math.abs(dictWord.length - word.length) > 2) continue;

			const dist = this.editDistance(word, dictWord);
			if (dist > 0 && dist <= 2) {
				suggestions.push(dictWord);
			}
		}

		return suggestions;
	}

	/**
	 * Compute Levenshtein edit distance between two strings.
	 * Bounded: returns early if distance exceeds maxDist.
	 */
	private editDistance(a: string, b: string, maxDist = 2): number {
		const m = a.length;
		const n = b.length;

		if (Math.abs(m - n) > maxDist) return maxDist + 1;

		// Use two rows for space optimization
		let prev = new Array<number>(n + 1);
		let curr = new Array<number>(n + 1);

		for (let j = 0; j <= n; j++) {
			prev[j] = j;
		}

		for (let i = 1; i <= m; i++) {
			curr[0] = i;
			let minRow = curr[0];

			for (let j = 1; j <= n; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				curr[j] = Math.min(
					prev[j] + 1, // deletion
					curr[j - 1] + 1, // insertion
					prev[j - 1] + cost, // substitution
				);
				if (curr[j] < minRow) minRow = curr[j];
			}

			// Early termination if minimum in row exceeds maxDist
			if (minRow > maxDist) return maxDist + 1;

			// Swap rows
			const tmp = prev;
			prev = curr;
			curr = tmp;
		}

		return prev[n];
	}
}
