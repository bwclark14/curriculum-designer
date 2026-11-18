# Curriculum Designer

A demo site for defining a curriculum area visually.

- A **curriculum area** has a name, a purpose statement and one or more big ideas, each with a name and a description.
- An area has **strands**; strands can have **sub-strands**, nested as deep as needed.
- Each strand applies at one or more **levels**: Early, First, Second, Third, Fourth.
- At each level a strand applies at, it has one or more **understanding statements**,  either written for that strand or **inherited** from its parent strand.

## Understanding IDs

Understanding IDs (e.g. `TCH 2-01`) are entered at the **lowest level of understanding**. At a given level, a strand holds the IDs only if none of its sub-strands are taught at that level. Otherwise each sub-strand taught there gets its own IDs, even when it inherits its statements from the parent.

For example, in Technologies the *Systems* strand holds the ID at Early level. At Second level, *Systems* has the sub-strands *Engineering* and *Computing*, so each of those has its own understanding ID, and *Systems* shows "IDs on 2 sub-strands".

## Views

- **Strands × Levels** – a grid of strands against levels. Solid cards are own statements, hatched cards are inherited (labelled with their source), empty cells are levels where the strand isn't taught, and red dashed cards need attention.
- **One level at a time** – everything learners should understand at one level, across all strands.

Click any card to edit it. Changes save in your browser; use Export/Import to move data as JSON.

## Running

It's a static site with no build step: open `index.html`, or serve the folder with any static server.
