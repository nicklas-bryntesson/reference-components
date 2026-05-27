How to test a range slider input

GIVEN THAT I am on a page with a range slider input

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a range slider I SEE focus is strongly visually indicated
- THEN when I use the up/down/left/right arrow keys I SEE the value is changed one step

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a range slider
  - I HEAR its purpose is clear
  - I HEAR it identifies itself as a range or slider
  - I HEAR its label is read with the input
  - I HEAR its current value
- THEN when I use the up/down/left/right arrow keys I HEAR the value is changed one step

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to move focus to a range slider
  - I HEAR its purpose is clear
  - I HEAR it identifies itself as a range or slider
  - I HEAR its label is read with the input
  - I HEAR its current value
- THEN when I swipe up/down in iOS or use the volume buttons in Android I HEAR the value is changed one step

Full information: https://www.atomica11y.com/accessible-web/range-slider/
