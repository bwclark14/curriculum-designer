# Curriculum Designer

A demo site for defining a curriculum area visually.

- A **curriculum area** has a name, a purpose statement and one or more big ideas, each with a name and a description.
- An area has **strands**; strands can have **sub-strands**, nested as deep as needed.
- Each strand applies at one or more **levels**: Early, First, Second, Third, Fourth.
- At each level a strand applies at, it is either **name only** (no statement and no ID; it just groups its sub-strands), has its own **understanding statements**, or **inherits** the statements written above it.

## Understanding IDs

An understanding ID (e.g. `TCH 1-01`) is only needed once an understanding statement is written, and it is entered at the **lowest level of understanding**. At a given level, a strand holds the IDs only if none of its sub-strands are taught at that level. Otherwise each sub-strand taught there gets its own IDs, even when it inherits its statements. A lowest-level statement with no ID is flagged "ID needed".

Examples in the demo:

- **Technologies:** *Systems* has a statement and ID at Early. At First it breaks into *Engineering* and *Computing*, which inherit the Systems statement but each have their own ID.
- **Sciences:** at First, *The connected world* is name only, as is its sub-strand *Nature and the Earth's resources*. That sub-strand's sub-strands, *Nature*, *Food* and *Materials*, each have their own statement and ID.

## Knows & Dos

Once an understanding has an ID, the **Knows & Dos** page (switch at the top) lets you add the know and do statements that support it.

- Statements are grouped into **collections**. Each collection is a row, with its knows on the left and its dos on the right so related content lines up. A collection's name is optional: named collections show the name as a bold heading; unnamed ones just align content.
- Add, edit, delete and reorder statements (drag, or the ↑/↓ buttons), and drag statements between collections. Collections can be reordered too.
- Sequencing is optional: turn on **Sequence collections** to number the collections, and **Numbered** on a collection to number its statements.
- The statement editor has a maths symbol palette and an **equation** builder. Equations are written in LaTeX between dollar signs (e.g. `$P = \frac{F}{A}$`) and rendered with KaTeX.
- Add **images** to a statement by uploading or pasting them. Images are downscaled and stored in the browser with the rest of the data, so very large numbers of images can fill the browser's storage; use Export to keep a copy.
- **Preview** shows the finished layout.

## Cross-cutting themes

The **Themes** page holds the cross-cutting themes shared by every curriculum area. It starts with:

| Code | Theme |
|---|---|
| CCCAP | Career and Pathways |
| CCC | Creativity |
| CCDV | Democratic Values |
| CCDS | Digital Skills |
| CCE | Entrepreneurship |
| CCLFS | Learning for Sustainability |
| CCMAF | Money and Finance |
| CCSJE | Social Justice and Equalities |

Codes and names can be edited in place, and themes can be added or deleted (deleting a theme removes its tag everywhere). Selecting a theme lists every understanding tagged with it across the curriculum, with counts at each level.

Understandings are tagged on the **Knows & Dos** page: the *Cross-cutting themes* row under the understanding has **+ Add theme** to tick themes on or off, and × to remove one.

## Dashboard

The **Dashboard** page summarises the number of understanding, know and do statements across the full curriculum (or one curriculum area), at each level: headline totals, a column chart per measure, a table by level, and a table by curriculum area and level. Understanding statements are counted at the lowest level of each strand, where each has its own understanding ID.

## Views

- **Strands × Levels** – a grid of strands against levels. Solid cards are own statements, hatched cards are inherited (labelled with their source), empty cells are levels where the strand isn't taught, and red dashed cards need attention.
- **One level at a time** – everything learners should understand at one level, across all strands.

Click any card to edit it. Changes save in your browser; use Export/Import to move data as JSON.

## Running

It's a static site with no build step: open `index.html`, or serve the folder with any static server.
