# MoonSync

Sync your reading highlights, notes, and progress from Moon+ Reader to Obsidian. MoonSync supports both automatic synchronization using Dropbox or via manual exports. 

## How It Works
Whenever you sync a book to the cloud in Moon Reader, it saves this data to two cache files in Dropbox. These files cotnain all of your book's meta data including highlights, notes, reading progress and book information. MoonSync reads this data and syncs it to your Obsidian vault. 

When MoonSync detects a new book, it  pulls metadata from Google Books and Open Library to create a note containing all of your highlights, notes, and book progress as well as book information (cover, genere, date published, etc). 

Moon Sync will then keep track of that book and update the note as you make new highlights and your reading progress changes. 

**Data flow:** Moon Reader → Dropbox Cloud Sync → MoonSync → Obsidian

### What Gets Synced

- Book highlights with timestamps and colors
- Reading progress (percentage and current chapter)
- Book metadata (title, author, publisher, page count, genres, series)
- Book covers, descriptions, and ratings (fetched from Google Books/Open Library)

### Requirements

- [Moon Reader](https://play.google.com/store/apps/details?id=com.flyersoft.moonreader) with Dropbox cloud sync enabled
- [Dropbox Desktop App](https://www.dropbox.com/desktop) 
- [Obsidian](https://obsidian.md/) 
- [BRAT](https://github.com/TfTHacker/obsidian42-brat) Obsidian Plugin

## Installation
MoonSync can be installed either via the BRAT Plugin (reccomended) or via a custom install:


### BRAT Installation
Using BRAT is the reccomended, and easiest, way to install custom Obsidin plugins that are not available in the Obsidian Community Store.

1. Install BRAT via community plugins. 
2. Open BRAT and select "Add Beta Plugin"
3. Paste `https://github.com/titandrive/moonsync` into the text bar
4. Click "Add Plugin"
5. Configure MoonSync (see below)

BRAT will now automatically keep track of updates for you

### Custom Installation
1. Browse to MoonSync [Releases](https://github.com/titandrive/moonsync/releases)
2. Download the latest release
3. Extract the release and copy it to your obsidian vault: `.obsidian/plugins/MoonSync`
4. Configure MoonSync (see below)

## Configuring Automatic Sync
Once MoonSync is installed, you will need to configure it before it can complete its first sync. 
1. Open up Settings → Community Plugins → MoonSync
2. Enable MoonSync
3. Click on the settings Cog to open up MoonSync settings.
4. Under configuration, browse to your MoonSync folder within Dropbox on your computer. This is typically `.../Dropbox/Apps/Books/`
*Note: /Books will appear empty as the cache files MoonSync relies on are contained in a hidden folder (/Books/.Moon+)*
5. Press Sync

By default, MoonSync will now Sync your books anytime you open Obsidian. You can also trigger a manual sync via the ribbon menu shortcut or Command Pallete (see below) 

## Manual Book Import
If you do not want to use automartic syncing, via Dropbox, MoonSync also supports manual exports. 

First, export your notes: 
1. While viewing a book in Moon Reader, open up the Bookmarks bar. You should see all of your existing notes and highlights 
2. Click the share button then "Share notes & highlights (TXT)"
3. Share the notes to Obsidian. 
*Note: It does not matter where the note is created. It does not need to be made in the /books directory.*
4. Choose a note in Obsidian to save it to. 

Once you have exported your notes, you can import it using MoonSync
1. Open the note that you just created.
2. While viewing the note, open the Command Pallete (`Cmd/Ctrl + P`)
3. Choose `MoonSync: Import Note`

## Custom Books
Sometimes you may have books you wish to keep track of that you read outside of Moon Reader. MoonSync supports creating custom books that can be tracked in the same manner. 

To create a custom book, 
1. Open the Command Pallete and select `MoonSync: Create Book Note`. 
2. Search for your book in the search prompt
3. Select your book

MoonSync will import all available metadata and create a new book note in `/Books`. You can then enter your favorite highlights and notes! 

If in the future, you begin reading that same book in Moon Reader, and make more highlights, MoonSync will intelligently update this note so you won't lose any of your past highlights. 

## Command Pallete

MoonSync provides several commands accessible via the command palette (`Cmd/Ctrl + P`):

### Sync Now
Synchronize all books from Moon Reader. Only updates notes when highlights or progress have changed.

### Create Book Note
Create a new book note by searching Google Books/Open Library. Opens a visual grid of search results - click a book to create a note with full metadata, cover, and a placeholder highlights section.

### Fetch Book Cover
Re-fetch the cover image for the current note. Useful if a book didn't have a cover initially or you want a different edition's cover.

### Fetch Book Metadata
Replace all metadata for the current note by selecting from search results. Updates title, author, cover, description, publisher, page count, genres, series, and language. Also sets `custom_metadata: true` to prevent future syncs from overwriting your selection.

### Import Moon Reader Export
Import highlights from a Moon Reader backup export file (`.mrexport`). Useful for one-time imports or when Dropbox sync isn't available.

## Settings
MoonSync has a variety of settings to customize how the plugin works. Default settings should work for most people but are available so you can tailor it to your preferences. 

### Configuration Tab
These settings configure how MoonSync works. 
#### Configuration
- **Moon Reader Dropbox Path** - path to your Moon Reader data. This is typically... `/Dropbox/Apps/Books`. The plugin automatically looks for the hidden `.Moon+/Cache` folder inside.
- **Output Folder** - Where your booknotes will be stored. Default: `/Books

#### Sync Options
- **Sync Now** - Trigger manual sync
- **Sync on Startup** - Automatically sync when Obsidian starts
- **Show Ribbon Icon** - Show sync button in the ribbon menu
- **Track Books Without Highlights** - Track books that do not currently have highlights. If enabled, MoonSync will create notes for books you are currently reading but have not created highlights in. 

### Content Tab
These settings configure what information is shown on your book notes. 
#### Note Content 
- **Show Description** - Include book description (from Google Books/Open Library)

- **Show Reading Progress** - Include progress percentage, current chapter, and date last read
- **Show Highlight Colors** - Use different callout styles based on highlight color
- **Show Notes** - Include your annotations below highlights
- **Show Book Covers** - Include book covers 

### Index & Base Tab
MoonSycn automatically generates an Index and Base note that shows all of your books. These settings control control the Index and Base notes. 

#### Library Index

- **Generate Library Index** - Generate a visual index page with cover thumbnails and statistics

### Highlight Colors

When "Show Highlight Colors" is enabled:
- Yellow → `[!quote]`
- Blue → `[!info]`
- Red → `[!warning]`
- Green → `[!tip]`

## Library Index

When enabled, MoonSync generates a `1. Library Index.md` file with:

- Visual grid of book covers (clickable links to each book)
- Summary statistics (total books, highlights, notes, average progress)
- List of all books with author, progress, and highlight counts

The index updates automatically after each sync.

## Output Format

Each book creates a markdown file with:

```markdown
---
title: "Book Title"
author: "Author Name"
published_date: "2024"
publisher: "Publisher Name"
page_count: 320
genres:
  - "Fiction"
  - "Science Fiction"
progress: "41.1%"
current_chapter: 25
last_synced: 2026-02-02
highlights_count: 12
notes_count: 3
rating: 4.2
ratings_count: 1234
cover: "covers/Book Title.jpg"
---

# Book Title
**Author:** Author Name

![[covers/Book Title.jpg|200]]

**Rating:** ⭐ 4.2/5 (1,234 ratings)

## Description
Book description from Google Books...

## Highlights

**Reading Progress:**
- Progress: 41.1%
- Chapter: 25

> [!quote] Chapter 3 • Jan 15, 2026
> "Highlighted text from the book..."

> [!info] Chapter 4 • Jan 16, 2026
> "Blue highlighted text..."
>
> **Note:** Your annotation appears here
```

## Custom Metadata Protection

MoonSync respects two special frontmatter flags:

### `custom_metadata: true`
Set automatically when you use "Fetch Book Metadata" command. When present:
- Sync preserves all your custom metadata (title, author, cover, etc.)
- Only highlights and reading progress are updated from Moon Reader

### `manual_note: true`
For notes created via "Create Book Note" command. When present:
- If the book later appears in Moon Reader, highlights are merged in
- Your custom content is preserved

## How Real-Time Sync Works

Moon Reader stores highlights and reading position in cache files that sync to Dropbox:

- **`.an` files** - Compressed annotation/highlight data for each book
- **`.po` files** - Reading position (progress percentage, current chapter)

When you sync Moon Reader to the cloud, these files update in your Dropbox. MoonSync reads them directly, so you don't need to create manual backups.

### Sync Efficiency

MoonSync only updates notes when something changes:
- New highlights added
- Reading progress changed

Unchanged books are skipped to keep syncs fast.

## Privacy & Security

- **Read-only access**: MoonSync only reads from your Dropbox folder. It never modifies your Moon Reader data.
- **Local processing**: All data stays on your machine. External APIs are only contacted for book metadata (Google Books, Open Library).
- **Caching**: API responses are cached locally to minimize external requests.

## Troubleshooting

### "No annotation files found"
- Ensure Moon Reader has cloud sync enabled (not just backup)
- Check that highlights exist and have synced to Dropbox
- Verify the path points to the folder containing `.Moon+` (usually `Dropbox/Apps/Books`)

### Progress not showing
- Progress requires a `.po` file for the book
- Open the book in Moon Reader and let it sync

### Covers/descriptions not loading
- Check your internet connection
- Some books (especially new releases) may not be in Google Books/Open Library
- Use "Fetch Book Cover" or "Fetch Book Metadata" to manually search for the correct edition

### Wrong book metadata
- Use "Fetch Book Metadata" command to search and select the correct book
- This sets `custom_metadata: true` to prevent future syncs from changing it

## Support

If you find this plugin useful, consider [buying me a coffee](https://ko-fi.com/titandrive)!

## License

MIT
