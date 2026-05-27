How to test a table

GIVEN THAT I am on a page with a table

1 - Keyboard for mobile & desktop browser
- WHEN I use the arrow keys I SEE the table scrolls into view (but is not focusable)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the arrow keys
  - I HEAR the table has a caption or a heading to describe its purpose
  - I HEAR it identifies itself as a table
  - I HEAR if sorted dynamically, sort order is identified (up/down, ascending/descending)
  - I HEAR column headers and row headers are identified with screenreader shortcuts
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focusable elements in the footer
  - I HEAR the table has a caption or a heading to describe its purpose
  - I HEAR it identifies itself as a table
  - I HEAR if sorted dynamically, sort order is identified (up/down, ascending/descending)
  - I HEAR column headers and row headers are identified with screenreader shortcuts

Full information: https://www.atomica11y.com/accessible-web/table/
