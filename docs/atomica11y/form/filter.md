How to test a filter

GIVEN THAT I am on a page with a filter

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to controls inside the filter I SEE focus is strongly visually indicated
- THEN when I use the focused control I SEE quantity and type of results updates

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to controls inside the filter
  - I HEAR each control's purpose is clear
  - I HEAR each control uses an appropriate role
  - I HEAR each control expresses its state
  - I HEAR sets of similar controls (like radio buttons) have a group name
- THEN when I use the focused control I HEAR quantity and type of results updates

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on controls inside the filter
  - I HEAR each control's purpose is clear
  - I HEAR each control uses an appropriate role
  - I HEAR each control expresses its state
  - I HEAR sets of similar controls (like radio buttons) have a group name
- THEN when I doubletap with controls in focus I HEAR quantity and type of results updates

Full information: https://www.atomica11y.com/accessible-web/filter/
