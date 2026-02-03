import { App, Modal, Setting, Notice, normalizePath } from "obsidian";
import { SyncResult } from "./sync";
import { MoonSyncSettings } from "./types";
import { generateFilename } from "./writer/markdown";
import { fetchBookInfo, downloadCover } from "./covers";

export class SyncSummaryModal extends Modal {
	private result: SyncResult;

	constructor(app: App, result: SyncResult) {
		super(app);
		this.result = result;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("moonsync-summary-modal");

		// Title
		contentEl.createEl("h2", { text: "MoonSync Import Complete" });

		// Stats container
		const statsContainer = contentEl.createDiv({ cls: "moonsync-stats" });

		// Create stat items (2x2 grid)
		// Top row: Books Imported, Notes Created
		this.createStatItem(statsContainer, this.result.booksCreated.toString(), "Books Imported");
		this.createStatItem(statsContainer, this.result.booksCreated.toString(), "Notes Created");
		// Bottom row: Highlights, Notes
		this.createStatItem(statsContainer, this.result.totalHighlights.toString(), "Highlights");
		this.createStatItem(statsContainer, this.result.totalNotes.toString(), "Notes");

		// Settings link
		const settingsLink = contentEl.createDiv({ cls: "moonsync-settings-link" });
		const link = settingsLink.createEl("a", { text: "Open MoonSync Settings" });
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.close();
			// Open Obsidian settings and navigate to MoonSync tab
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById("moonsync");
		});

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: "moonsync-button-container" });
		const closeButton = buttonContainer.createEl("button", { text: "Done" });
		closeButton.addEventListener("click", () => this.close());
	}

	private createStatItem(container: HTMLElement, value: string, label: string) {
		const item = container.createDiv({ cls: "moonsync-stat-item" });
		item.createDiv({ cls: "moonsync-stat-value", text: value });
		item.createDiv({ cls: "moonsync-stat-label", text: label });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for creating a new book note
 */
export class CreateBookModal extends Modal {
	private settings: MoonSyncSettings;
	private onSubmit: (title: string, author: string) => void;

	private title = "";
	private author = "";

	constructor(
		app: App,
		settings: MoonSyncSettings,
		onSubmit: (title: string, author: string) => void
	) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("moonsync-create-book-modal");

		contentEl.createEl("h2", { text: "Create Book Note" });

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Book title (required)")
			.addText((text) =>
				text
					.setPlaceholder("Enter book title")
					.onChange((value) => {
						this.title = value;
					})
			);

		new Setting(contentEl)
			.setName("Author")
			.setDesc("Author name (optional)")
			.addText((text) =>
				text
					.setPlaceholder("Enter author name")
					.onChange((value) => {
						this.author = value;
					})
			);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "moonsync-button-container" });

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		const createButton = buttonContainer.createEl("button", {
			text: "Create",
			cls: "mod-cta",
		});
		createButton.addEventListener("click", () => {
			if (!this.title.trim()) {
				new Notice("Please enter a book title");
				return;
			}
			this.onSubmit(this.title.trim(), this.author.trim());
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Generate a book note template
 */
export function generateBookTemplate(
	title: string,
	author: string,
	coverPath: string | null,
	description: string | null,
	rating: number | null,
	ratingsCount: number | null
): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
	if (author) {
		lines.push(`author: "${author.replace(/"/g, '\\"')}"`);
	}
	lines.push(`last_synced: ${new Date().toISOString().split("T")[0]}`);
	lines.push("highlights_count: 0");
	if (rating !== null) {
		lines.push(`rating: ${rating}`);
		if (ratingsCount !== null) {
			lines.push(`ratings_count: ${ratingsCount}`);
		}
	}
	if (coverPath) {
		lines.push(`cover: "${coverPath}"`);
	}
	lines.push("---");

	// Content
	lines.push(`# ${title}`);
	if (author) {
		lines.push(`**Author:** ${author}`);
	}
	if (rating !== null) {
		const ratingText = ratingsCount !== null
			? `**Rating:** ⭐ ${rating}/5 (${ratingsCount.toLocaleString()} ratings)`
			: `**Rating:** ⭐ ${rating}/5`;
		lines.push(ratingText);
	}
	lines.push("");

	if (coverPath) {
		lines.push(`![[${coverPath}|200]]`);
		lines.push("");
	}

	if (description) {
		lines.push("## Description");
		lines.push(description);
		lines.push("");
	}

	lines.push("## Highlights");
	lines.push("");
	lines.push("> [!quote]");
	lines.push("> Add your highlights here...");
	lines.push("");

	return lines.join("\n");
}
