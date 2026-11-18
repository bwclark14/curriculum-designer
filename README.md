# Curriculum Designer

A demo site for defining a curriculum area visually.

- A **curriculum area** has a name, a purpose statement and one or more big ideas, each with a name and a description.
- An area has **strands**; strands can have **sub-strands**, nested as deep as needed.
- Each strand applies at one or more **levels**: Early, First, Second, Third, Fourth.
- At each level a strand applies at, it has one or more **understanding statements**, either written for that strand or **inherited** from its parent strand.

## Views

- **Strands × Levels** – a grid of strands against levels. Solid cards are own statements, hatched cards are inherited (labelled with their source), empty cells are levels where the strand isn't taught, and red dashed cards need attention.
- **One level at a time** – everything learners should understand at one level, across all strands.

Click any card to edit it. Changes save in your browser; use Export/Import to move data as JSON.

## Running

It's a static site with no build step: open `index.html`, or serve the folder with any static server.
