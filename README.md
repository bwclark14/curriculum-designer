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

## Views

- **Strands × Levels** – a grid of strands against levels. Solid cards are own statements, hatched cards are inherited (labelled with their source), empty cells are levels where the strand isn't taught, and red dashed cards need attention.
- **One level at a time** – everything learners should understand at one level, across all strands.

Click any card to edit it. Changes save in your browser; use Export/Import to move data as JSON.

## Running

It's a static site with no build step: open `index.html`, or serve the folder with any static server.
