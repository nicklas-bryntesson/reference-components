How to test a checkbox

GIVEN THAT I am on a page with a checkbox

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a checkbox I SEE focus is strongly visually indicated
- THEN when I use the spacebar to activate the checkbox I SEE the state is changed

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a checkbox
  - I HEAR Its label and purpose is clear
  - I HEAR It identifies its role of checkbox
  - I HEAR It expresses its state (checked/unchecked, disabled)
  - I HEAR Hints or errors are read after the label and related inputs include a group name (ex: Account settings)
- THEN when I use the spacebar to activate the checkbox I HEAR the state is changed

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a checkbox input
  - I HEAR Its label and purpose is clear
  - I HEAR It identifies its role of checkbox
  - I HEAR It expresses its state (checked/unchecked, disabled)
  - I HEAR Hints or errors are read after the label and related inputs include a group name (ex: Account settings)
- THEN when I doubletap with the checkbox in focus I HEAR the state is changed

4 - Device settings
- WHEN I use custom font settings THEN I see text resizes up to 200% without losing information

Full information: https://www.atomica11y.com/accessible-web/checkbox/
