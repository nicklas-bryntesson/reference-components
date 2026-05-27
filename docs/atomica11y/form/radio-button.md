How to test a radio button

GIVEN THAT I am on a page with a radio button

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a radio group I SEE focus is strongly visually indicated on the first unselected option or the selected option
- THEN when I use the arrow keys to select a radio button I SEE the state is changed
- OR WHEN when I use the spacebar to activate a focused radio button I SEE the radio button is selected.

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a radio group
  - I HEAR its label and purpose is clear
  - I HEAR it identifies itself as a radio button
  - I HEAR it expresses its state (selected, checked, disabled/dimmed)
  - I HEAR hints or errors are read after the label and related inputs include a group name (ex: Shipping options)
- THEN when I use the arrow keys to select a radio button I HEAR the state is changed

- OR WHEN when I use the spacebar to activate a focused radio button I HEAR the radio button is selected.

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a radio button
  - I HEAR its label and purpose is clear
  - I HEAR it identifies itself as a radio button
  - I HEAR it expresses its state (selected, checked, disabled/dimmed)
  - I HEAR hints or errors are read after the label and related inputs include a group name (ex: Shipping options)
- THEN when I doubletap with the radio in focus I HEAR the state is changed

Full information: https://www.atomica11y.com/accessible-web/radio/
