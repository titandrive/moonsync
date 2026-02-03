import { App, Notice, normalizePath } from "obsidian";
import { SyncSummaryModal } from "./modal";
import { parseAnnotationFiles } from "./parser/annotations";
import { generateBookNote, generateFilename, generateIndexNote, formatHighlight } from "./writer/markdown";
import { fetchBookInfo, downloadCover } from "./covers";
import { MoonSyncSettings, BookData } from "./types";
import { loadCache, saveCache, getCachedInfo, setCachedInfo, BookInfoCache } from "./cache";
import { scanAllBookNotes, mergeBookLists } from "./scanner";

export interface SyncResult {
	success: boolean;
	booksProcessed: number;
	booksCreated: number;
	booksUpdated: number;
	booksSkipped: number;
	manualBooksAdded: number;
	totalHighlights: number;
	totalNotes: number;
	isFirstSync: boolean;
	errors: string[];
}

/**
 * Main sync function that orchestrates the entire sync process
 */
export async function syncFromMoonReader(
	app: App,
	settings: MoonSyncSettings,
	wasmPath: string
): Promise<SyncResult> {
	const result: SyncResult = {
		success: false,
		booksProcessed: 0,
		booksCreated: 0,
		booksUpdated: 0,
		booksSkipped: 0,
		manualBooksAdded: 0,
		totalHighlights: 0,
		totalNotes: 0,
		isFirstSync: false,
		errors: [],
	};

	// Single progress notice that we'll hide when done
	const progressNotice = new Notice("MoonSync: Syncing...", 0);

	try {
		// Validate settings
		if (!settings.dropboxPath) {
			result.errors.push("Dropbox path not configured");
			progressNotice.hide();
			return result;
		}

		// Parse annotation files from Cache folder (real-time sync)
		const booksWithHighlights = await parseAnnotationFiles(settings.dropboxPath);

		if (booksWithHighlights.length === 0) {
			result.errors.push("No annotation files found in .Moon+/Cache folder");
			progressNotice.hide();
			return result;
		}

		// Check if output folder exists (for first sync detection)
		const outputPath = normalizePath(settings.outputFolder);
		const outputFolderExisted = await app.vault.adapter.exists(outputPath);
		result.isFirstSync = !outputFolderExisted;

		// Ensure output folder exists
		if (!outputFolderExisted) {
			await app.vault.createFolder(outputPath);
		}

		// Calculate total highlights and notes
		result.totalHighlights = booksWithHighlights.reduce((sum, b) => sum + b.highlights.length, 0);
		result.totalNotes = booksWithHighlights.reduce(
			(sum, b) => sum + b.highlights.filter((h) => h.note && h.note.trim()).length,
			0
		);

		// Load book info cache
		const cache = await loadCache(app, outputPath);
		let cacheModified = false;

		// Process each book
		for (const bookData of booksWithHighlights) {
			try {
				const processed = await processBook(app, outputPath, bookData, settings, result, cache);
				if (processed) {
					cacheModified = true;
				}
				result.booksProcessed++;
			} catch (error) {
				result.errors.push(
					`Error processing "${bookData.book.title}": ${error}`
				);
			}
		}

		// Save cache if modified
		if (cacheModified) {
			await saveCache(app, outputPath, cache);
		}

		// Update index note if enabled
		if (settings.showIndex) {
			const indexPath = normalizePath(`${outputPath}/${settings.indexNoteTitle}.md`);
			const indexExists = await app.vault.adapter.exists(indexPath);

			// Check if there are manually-created book notes by comparing counts
			const scannedBooks = await scanAllBookNotes(app, outputPath);
			const indexFilename = `${settings.indexNoteTitle}.md`;
			const filteredScanned = scannedBooks.filter((b) => !b.filePath.endsWith(indexFilename));
			const totalBookNotes = filteredScanned.length;
			const manualBookCount = totalBookNotes - booksWithHighlights.length;
			const hasManualBooks = manualBookCount > 0;

			// Track manual books for reporting
			if (hasManualBooks) {
				result.manualBooksAdded = manualBookCount;
			}

			// Regenerate if: books changed, index doesn't exist, or manual books detected
			if (result.booksCreated > 0 || result.booksUpdated > 0 || !indexExists || hasManualBooks) {
				// Populate cover paths for all books (for the collage)
				const coversFolder = normalizePath(`${outputPath}/covers`);
				for (const bookData of booksWithHighlights) {
					if (!bookData.coverPath) {
						const coverFilename = `${generateFilename(bookData.book.title)}.jpg`;
						const coverPath = normalizePath(`${coversFolder}/${coverFilename}`);
						if (await app.vault.adapter.exists(coverPath)) {
							bookData.coverPath = `covers/${coverFilename}`;
						}
					}
				}
				await updateIndexNote(app, outputPath, booksWithHighlights, settings);
			}
		}

		progressNotice.hide();
		result.success = true;
		return result;
	} catch (error) {
		progressNotice.hide();
		result.errors.push(`Sync failed: ${error}`);
		return result;
	}
}

interface ExistingBookData {
	highlightsCount: number;
	progress: number | null;
	isManualNote: boolean;
	fullContent?: string;
}

/**
 * Get highlights count, progress, and manual note status from an existing markdown file
 */
async function getExistingBookData(app: App, filePath: string): Promise<ExistingBookData | null> {
	try {
		if (!(await app.vault.adapter.exists(filePath))) {
			return null;
		}

		const content = await app.vault.adapter.read(filePath);

		const countMatch = content.match(/^highlights_count:\s*(\d+)/m);
		const progressMatch = content.match(/^progress:\s*"?(\d+(?:\.\d+)?)/m);
		const manualNoteMatch = content.match(/^manual_note:\s*true/m);

		if (countMatch) {
			return {
				highlightsCount: parseInt(countMatch[1], 10),
				progress: progressMatch ? parseFloat(progressMatch[1]) : null,
				isManualNote: !!manualNoteMatch,
				fullContent: content,
			};
		}
	} catch {
		// File doesn't exist or can't be read
	}
	return null;
}

/**
 * Merge a manual note with Moon+ Reader data
 * Preserves manual content and adds Moon+ Reader highlights section
 */
function mergeManualNoteWithMoonReader(
	existingContent: string,
	bookData: BookData,
	settings: MoonSyncSettings
): string {
	const lines: string[] = [];

	// Parse existing frontmatter and content
	const frontmatterMatch = existingContent.match(/^---\n([\s\S]*?)\n---/);
	const contentAfterFrontmatter = frontmatterMatch
		? existingContent.slice(frontmatterMatch[0].length).trim()
		: existingContent.trim();

	// Start building new frontmatter
	lines.push("---");

	// Preserve existing frontmatter fields, update with Moon+ Reader data
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		const frontmatterLines = frontmatter.split("\n");

		for (const line of frontmatterLines) {
			// Skip fields that Moon+ Reader will update
			if (line.startsWith("progress:") ||
			    line.startsWith("current_chapter:") ||
			    line.startsWith("highlights_count:") ||
			    line.startsWith("last_synced:") ||
			    line.startsWith("manual_note:")) {
				continue;
			}
			lines.push(line);
		}
	}

	// Add Moon+ Reader metadata
	lines.push(`last_synced: ${new Date().toISOString().split("T")[0]}`);
	lines.push(`highlights_count: ${bookData.highlights.length}`);

	if (settings.showProgress && bookData.progress !== null) {
		lines.push(`progress: "${bookData.progress.toFixed(1)}%"`);
		if (bookData.currentChapter) {
			lines.push(`current_chapter: ${bookData.currentChapter}`);
		}
	}

	lines.push("---");
	lines.push("");

	// Add existing content
	lines.push(contentAfterFrontmatter);
	lines.push("");

	// Add Moon+ Reader highlights section
	lines.push("## Moon+ Reader Highlights");
	lines.push("");

	// Add progress info if enabled
	if (settings.showReadingProgress && (bookData.progress !== null || bookData.currentChapter !== null)) {
		lines.push("**Reading Progress:**");
		if (bookData.progress !== null) {
			lines.push(`- Progress: ${bookData.progress.toFixed(1)}%`);
		}
		if (bookData.currentChapter !== null) {
			lines.push(`- Chapter: ${bookData.currentChapter}`);
		}
		lines.push("");
	}

	// Generate highlights
	for (const highlight of bookData.highlights) {
		lines.push(formatHighlight(highlight, settings.showHighlightColors, settings.showNotes));
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Process a single book - create or update its note
 * Returns true if cache was modified
 */
async function processBook(
	app: App,
	outputPath: string,
	bookData: BookData,
	settings: MoonSyncSettings,
	result: SyncResult,
	cache: BookInfoCache
): Promise<boolean> {
	const filename = generateFilename(bookData.book.title);
	const filePath = normalizePath(`${outputPath}/${filename}.md`);
	let cacheModified = false;

	// Check if book has changed (compare highlights count and progress)
	const existingData = await getExistingBookData(app, filePath);
	const fileExists = existingData !== null;

	if (fileExists) {
		const highlightsUnchanged = existingData.highlightsCount === bookData.highlights.length;
		const progressUnchanged = existingData.progress === bookData.progress;

		if (highlightsUnchanged && progressUnchanged) {
			// Book hasn't changed, skip
			result.booksSkipped++;
			return false;
		}
	}

	// Fetch book info (cover, description, and rating) from external sources
	if (settings.fetchCovers || settings.showDescription || settings.showRatings) {
		const coverFilename = `${filename}.jpg`;
		const coversFolder = normalizePath(`${outputPath}/covers`);
		const coverPath = normalizePath(`${coversFolder}/${coverFilename}`);

		const coverExists = await app.vault.adapter.exists(coverPath);

		// Check cache first for description and rating
		const cachedInfo = getCachedInfo(cache, bookData.book.title, bookData.book.author);

		if (cachedInfo) {
			// Use cached data
			if (cachedInfo.description) {
				bookData.fetchedDescription = cachedInfo.description;
			}
			if (cachedInfo.rating !== null) {
				bookData.rating = cachedInfo.rating;
			}
			if (cachedInfo.ratingsCount !== null) {
				bookData.ratingsCount = cachedInfo.ratingsCount;
			}
			if (!bookData.book.author && cachedInfo.author) {
				bookData.book.author = cachedInfo.author;
			}
		}

		// Fetch from APIs only if we need cover (and don't have it) OR we don't have cached data
		const needsApiFetch = (settings.fetchCovers && !coverExists) || !cachedInfo;

		if (needsApiFetch) {
			try {
				const bookInfo = await fetchBookInfo(
					bookData.book.title,
					bookData.book.author
				);

				// Save cover if fetched and enabled
				if (settings.fetchCovers && bookInfo.coverUrl && !coverExists) {
					// Ensure covers folder exists
					if (!(await app.vault.adapter.exists(coversFolder))) {
						await app.vault.createFolder(coversFolder);
					}

					// Download and save cover
					const imageData = await downloadCover(bookInfo.coverUrl);
					if (imageData) {
						await app.vault.adapter.writeBinary(coverPath, imageData);
						bookData.coverPath = `covers/${coverFilename}`;
					}
				}

				// Use fetched description if available
				if (bookInfo.description) {
					bookData.fetchedDescription = bookInfo.description;
				}

				// Use fetched rating if available
				if (bookInfo.rating !== null) {
					bookData.rating = bookInfo.rating;
				}
				if (bookInfo.ratingsCount !== null) {
					bookData.ratingsCount = bookInfo.ratingsCount;
				}

				// Use fetched author if book has no author from filename
				if (!bookData.book.author && bookInfo.author) {
					bookData.book.author = bookInfo.author;
				}

				// Update cache
				setCachedInfo(cache, bookData.book.title, bookData.book.author, {
					description: bookInfo.description,
					rating: bookInfo.rating,
					ratingsCount: bookInfo.ratingsCount,
					author: bookInfo.author,
				});
				cacheModified = true;
			} catch (error) {
				console.log(`MoonSync: Failed to fetch book info for "${bookData.book.title}"`, error);
			}
		}

		// Set cover path if cover already exists
		if (settings.fetchCovers && coverExists) {
			bookData.coverPath = `covers/${coverFilename}`;
		}
	}

	// Generate or merge markdown content
	let markdown: string;

	if (fileExists && existingData.isManualNote) {
		// Merge manual note with Moon+ Reader data
		markdown = mergeManualNoteWithMoonReader(existingData.fullContent!, bookData, settings);
	} else {
		// Generate new Moon+ Reader note
		markdown = generateBookNote(bookData, settings);
	}

	if (fileExists) {
		// Update existing file
		await app.vault.adapter.write(filePath, markdown);
		result.booksUpdated++;
	} else {
		// Create new file
		await app.vault.create(filePath, markdown);
		result.booksCreated++;
	}

	return cacheModified;
}

/**
 * Update the index note with summary and links to all books
 * Merges Moon+ Reader books with any manually-created book notes in the folder
 */
async function updateIndexNote(app: App, outputPath: string, moonReaderBooks: BookData[], settings: MoonSyncSettings): Promise<void> {
	const indexPath = normalizePath(`${outputPath}/${settings.indexNoteTitle}.md`);

	// Scan for manually-created book notes
	const scannedBooks = await scanAllBookNotes(app, outputPath);

	// Filter out the index note itself from scanned books
	const indexFilename = `${settings.indexNoteTitle}.md`;
	const filteredScanned = scannedBooks.filter(
		(b) => !b.filePath.endsWith(indexFilename)
	);

	// Merge Moon+ Reader books with manually-created ones
	const allBooks = mergeBookLists(moonReaderBooks, filteredScanned);

	const markdown = generateIndexNote(allBooks, settings);

	if (await app.vault.adapter.exists(indexPath)) {
		await app.vault.adapter.write(indexPath, markdown);
	} else {
		await app.vault.create(indexPath, markdown);
	}
}

/**
 * Refresh just the index note without full sync (for settings changes or after adding manual books)
 * This scans all book notes in the output folder, including manually-created ones
 */
export async function refreshIndexNote(app: App, settings: MoonSyncSettings): Promise<void> {
	if (!settings.showIndex) {
		new Notice("MoonSync: Index generation is disabled in settings");
		return;
	}

	const outputPath = normalizePath(settings.outputFolder);

	// Check if output folder exists
	if (!(await app.vault.adapter.exists(outputPath))) {
		new Notice("MoonSync: Output folder does not exist");
		return;
	}

	try {
		// Get Moon+ Reader books if dropbox is configured
		let moonReaderBooks: BookData[] = [];
		if (settings.dropboxPath) {
			try {
				moonReaderBooks = await parseAnnotationFiles(settings.dropboxPath);
			} catch {
				// Dropbox path might not be accessible, that's ok for manual-only use
			}
		}

		const coversFolder = normalizePath(`${outputPath}/covers`);

		// Populate cover paths for Moon+ Reader books
		for (const bookData of moonReaderBooks) {
			if (!bookData.coverPath) {
				const coverFilename = `${generateFilename(bookData.book.title)}.jpg`;
				const coverPath = normalizePath(`${coversFolder}/${coverFilename}`);
				if (await app.vault.adapter.exists(coverPath)) {
					bookData.coverPath = `covers/${coverFilename}`;
				}
			}
		}

		await updateIndexNote(app, outputPath, moonReaderBooks, settings);
		new Notice("MoonSync: Index refreshed");
	} catch (error) {
		console.error("MoonSync: Failed to refresh index", error);
		new Notice("MoonSync: Failed to refresh index");
	}
}

/**
 * Display sync results to the user
 */
export function showSyncResults(app: App, result: SyncResult): void {
	if (result.success) {
		if (result.booksProcessed === 0) {
			new Notice("MoonSync: No books with highlights to sync");
		} else if (result.isFirstSync) {
			// Show summary modal on first sync
			new SyncSummaryModal(app, result).open();
		} else {
			const parts = [];
			if (result.booksCreated > 0) parts.push(`${result.booksCreated} new`);
			if (result.booksUpdated > 0) parts.push(`${result.booksUpdated} updated`);
			if (result.booksSkipped > 0) parts.push(`${result.booksSkipped} unchanged`);
			if (result.manualBooksAdded > 0) parts.push(`${result.manualBooksAdded} manual`);

			new Notice(`MoonSync: ${parts.join(", ")}`);
		}
	} else {
		new Notice(`MoonSync: Sync failed - ${result.errors[0]}`);
	}

	// Log all errors to console
	for (const error of result.errors) {
		console.error("MoonSync:", error);
	}
}
