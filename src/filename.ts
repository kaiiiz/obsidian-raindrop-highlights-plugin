import sanitize from "sanitize-filename";

function isUnsupportedFilenameCodePoint(codePoint: number): boolean {
	const isUnicodeNoncharacter =
		(codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe;
	const isRejectedByMacOS = codePoint >= 0x3fffd && codePoint <= 0xe0000;
	return isUnicodeNoncharacter || isRejectedByMacOS;
}

/**
 * Produces a portable filename or folder-name component.
 *
 * APFS rejects Unicode noncharacters and some supplementary-plane code
 * points with EILSEQ. Remove those before the general sanitizer truncates the
 * value, so every caller uses a stable path.
 */
export function sanitizePathComponent(value: string, fallback: string): string {
	const withoutUnsupportedCodePoints = Array.from(value)
		.filter((character) => !isUnsupportedFilenameCodePoint(character.codePointAt(0)!))
		.join("");
	return sanitize(withoutUnsupportedCodePoints.trim()) || fallback;
}
