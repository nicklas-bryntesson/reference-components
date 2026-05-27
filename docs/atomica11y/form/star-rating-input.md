How to test a star rating input

GIVEN THAT I am on a page with a star rating input

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a radio group I SEE focus is strongly visually indicated on the first unselected option or the selected option
- THEN when I use the spacebar to activate the radio button I SEE the radio button with focus change state to selected.
- THEN when I use the arrow keys to focus radio button I SEE the state is changed

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a radio group
  - I HEAR Its label and purpose is clear
  - I HEAR It identifies itself as a radio option
  - I HEAR Each option has an associated label and the radio group name
  - I HEAR It expresses its state (selected, checked, disabled)
- THEN when I use the spacebar to activate the radio button I HEAR the radio button with focus change state to selected.

- THEN when I use the arrow keys to focus radio button I HEAR the state is changed

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a radio button
  - I HEAR Its label and purpose is clear
  - I HEAR It identifies itself as a radio option
  - I HEAR Each option has an associated label and the radio group name
  - I HEAR It expresses its state (selected, checked, disabled)
- THEN when I doubletap with the radio in focus I HEAR the state is changed

Full information: https://www.atomica11y.com/accessible-web/star-rating/
