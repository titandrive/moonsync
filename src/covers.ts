import { requestUrl } from "obsidian";

export interface CoverResult {
	url: string | null;
	source: "openlibrary" | "googlebooks" | null;
}

/**
 * Fetch book cover from Open Library or Google Books
 * Tries Open Library first, falls back to Google Books
 */
export async function fetchBookCover(
	title: string,
	author: string
): Promise<CoverResult> {
	// Try Open Library first
	const openLibraryCover = await fetchFromOpenLibrary(title, author);
	if (openLibraryCover) {
		return { url: openLibraryCover, source: "openlibrary" };
	}

	// Fall back to Google Books
	const googleBooksCover = await fetchFromGoogleBooks(title, author);
	if (googleBooksCover) {
		return { url: googleBooksCover, source: "googlebooks" };
	}

	return { url: null, source: null };
}

/**
 * Search Open Library for book cover
 */
async function fetchFromOpenLibrary(
	title: string,
	author: string
): Promise<string | null> {
	try {
		const query = encodeURIComponent(`${title} ${author}`);
		const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=1`;

		const response = await requestUrl({ url: searchUrl });
		const data = response.json;

		if (data.docs && data.docs.length > 0) {
			const book = data.docs[0];

			// Try cover_i (cover ID) first
			if (book.cover_i) {
				return `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
			}

			// Try ISBN
			if (book.isbn && book.isbn.length > 0) {
				return `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`;
			}
		}
	} catch (error) {
		console.log("MoonSync: Open Library search failed", error);
	}

	return null;
}

/**
 * Search Google Books for book cover
 */
async function fetchFromGoogleBooks(
	title: string,
	author: string
): Promise<string | null> {
	try {
		const query = encodeURIComponent(`${title} ${author}`);
		const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;

		const response = await requestUrl({ url: searchUrl });
		const data = response.json;

		if (data.items && data.items.length > 0) {
			const book = data.items[0];
			const imageLinks = book.volumeInfo?.imageLinks;

			if (imageLinks) {
				// Prefer larger images
				return (
					imageLinks.large ||
					imageLinks.medium ||
					imageLinks.thumbnail ||
					imageLinks.smallThumbnail
				)?.replace("http://", "https://"); // Ensure HTTPS
			}
		}
	} catch (error) {
		console.log("MoonSync: Google Books search failed", error);
	}

	return null;
}

/**
 * Download cover image and return as ArrayBuffer
 */
export async function downloadCover(url: string): Promise<ArrayBuffer | null> {
	try {
		const response = await requestUrl({ url });
		return response.arrayBuffer;
	} catch (error) {
		console.log("MoonSync: Failed to download cover", error);
		return null;
	}
}
